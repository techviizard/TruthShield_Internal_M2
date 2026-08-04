/**
 * Thin wrapper to write AuditLog rows from any API route.
 * Keeps Audit Log tab fed with real events.
 */

import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { linkHash, verifyChain, GENESIS_HASH, type ChainVerification } from '@/lib/engines/integrity'

export type AuditAction =
  | 'analysis_completed'
  | 'analysis_failed'
  | 'alert_triggered'
  | 'alert_read'
  | 'investigation_created'
  | 'investigation_updated'
  | 'investigation_deleted'
  | 'fact_check_completed'
  | 'watchlist_hit'
  | 'watchlist_added'
  | 'watchlist_removed'
  | 'report_exported'
  | 'user_login'
  | 'system_update'
  // Chain-of-custody events
  | 'evidence_ingested'
  | 'evidence_exported'
  | 'custody_transferred'
  | 'chain_verified'

export interface AuditEntry {
  userId?: string | null
  action: AuditAction
  resource: string
  details?: Record<string, unknown>
  ipAddress?: string | null
}

/**
 * Appends are serialized through this promise so two concurrent requests cannot
 * read the same chain head and fork it. Single-process only — a multi-instance
 * deployment needs the same guarantee from a DB transaction or advisory lock.
 */
let appendLock: Promise<unknown> = Promise.resolve()

export async function recordAudit(entry: AuditEntry) {
  const run = appendLock.then(async () => {
    const head = await db.auditLog.findFirst({
      orderBy: [{ seq: 'desc' }, { createdAt: 'desc' }],
      select: { seq: true, entryHash: true },
    })
    const seq = (head?.seq ?? -1) + 1
    const prevHash = head?.entryHash ?? GENESIS_HASH
    const createdAt = new Date()
    const details = entry.details ? JSON.stringify(entry.details) : null

    const entryHash = linkHash(prevHash, {
      seq,
      action: entry.action,
      resource: entry.resource,
      userId: entry.userId ?? null,
      details,
      ipAddress: entry.ipAddress ?? null,
      createdAt,
    })

    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource,
        details,
        ipAddress: entry.ipAddress ?? null,
        createdAt,
        seq,
        prevHash,
        entryHash,
      },
    })
    return entryHash
  })

  // Keep the lock chain alive even when a write fails.
  appendLock = run.catch(() => undefined)

  try {
    return await run
  } catch (err) {
    console.error('audit write failed', err)
    return null
  }
}

/**
 * Recompute the whole audit chain and report any divergence.
 * `limit` bounds how many of the most recent entries are checked; the chain is
 * still replayed from the oldest of those, so the link check stays meaningful.
 */
export async function verifyAuditChain(limit = 5000): Promise<ChainVerification> {
  const rows = await db.auditLog.findMany({
    orderBy: [{ seq: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true, seq: true, action: true, resource: true, userId: true,
      details: true, ipAddress: true, createdAt: true, prevHash: true, entryHash: true,
    },
  })
  return verifyChain(rows.reverse())
}

/** Current chain head — the single value to quote in a court-ready report. */
export async function auditChainHead() {
  const head = await db.auditLog.findFirst({
    orderBy: [{ seq: 'desc' }, { createdAt: 'desc' }],
    select: { seq: true, entryHash: true, createdAt: true },
  })
  return {
    seq: head?.seq ?? -1,
    hash: head?.entryHash ?? null,
    at: head?.createdAt?.toISOString() ?? null,
  }
}

export function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xrip = req.headers.get('x-real-ip')
  if (xrip) return xrip
  return null
}

/**
 * Cursor-paginated read for Audit Log tab.
 */
export async function listAudit(opts: {
  cursor?: string
  limit?: number
  action?: AuditAction
  search?: string
}) {
  const limit = Math.min(100, opts.limit ?? 50)
  const where: Record<string, unknown> = {}
  if (opts.action) where.action = opts.action
  if (opts.search) {
    where.OR = [
      { resource: { contains: opts.search } },
      { details: { contains: opts.search } },
    ]
  }
  const items = await db.auditLog.findMany({
    where,
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
  })
  const hasNext = items.length > limit
  return {
    items: items.slice(0, limit).map((i) => ({
      ...i,
      details: i.details ? safeParse(i.details) : null,
    })),
    nextCursor: hasNext ? items[limit - 1].id : null,
  }
}

function safeParse(s: string) {
  try { return JSON.parse(s) } catch { return s }
}
