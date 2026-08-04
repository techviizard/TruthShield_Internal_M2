/**
 * Watchlist persistence + scan-against-recent endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'

export async function GET() {
  const items = await db.watchlistItem.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ success: true, items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const item = await db.watchlistItem.create({
      data: {
        keyword: body.keyword,
        type: body.type ?? 'keyword',
        language: body.language ?? 'en',
        isActive: body.active ?? true,
      },
    })
    await recordAudit({
      action: 'watchlist_added',
      resource: `Watchlist #${item.id.slice(-6).toUpperCase()}`,
      ipAddress: clientIp(req),
      details: { keyword: item.keyword, type: item.type },
    })
    return NextResponse.json({ success: true, item })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await db.watchlistItem.update({
      where: { id: body.id },
      data: { isActive: body.active },
    })
    return NextResponse.json({ success: true, item: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await db.watchlistItem.delete({ where: { id } })
    await recordAudit({
      action: 'watchlist_removed',
      resource: `Watchlist #${id.slice(-6).toUpperCase()}`,
      ipAddress: clientIp(req),
      details: { id },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
