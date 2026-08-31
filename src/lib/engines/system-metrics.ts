/**
 * Real OS / process metrics for System Health tab.
 * Uses Node `os` + `process` - no external monitor agent.
 */

import os from 'node:os'
import { db } from '@/lib/db'

let prevCpuSample: { idle: number; total: number; ts: number } | null = null

function sampleCpu() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const c of cpus) {
    for (const t of Object.values(c.times)) total += t as number
    idle += c.times.idle
  }
  return { idle, total, ts: Date.now() }
}

/**
 * CPU usage percentage. Requires two samples ~500ms apart.
 * First call returns 0; caller should poll on a schedule.
 */
export function getCpuUsagePct(): number {
  const now = sampleCpu()
  if (!prevCpuSample) {
    prevCpuSample = now
    return 0
  }
  const idleDelta = now.idle - prevCpuSample.idle
  const totalDelta = now.total - prevCpuSample.total
  prevCpuSample = now
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100))
}

export interface SystemHealth {
  cpu: { usagePct: number; cores: number; model: string; loadAvg: number[] }
  memory: { totalMB: number; freeMB: number; usedMB: number; usedPct: number; processRssMB: number; heapUsedMB: number }
  uptime: { systemSec: number; processSec: number }
  os: { platform: string; release: string; arch: string; hostname: string; nodeVersion: string }
  db: { totalReports: number; totalUploads: number; totalAlerts: number; totalInvestigations: number; lastReportAt: string | null; queuedAnalyses: number; failedAnalyses: number }
  net: { interfaces: { name: string; address: string; family: string }[] }
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const mem = process.memoryUsage()

  const [totalReports, totalUploads, totalAlerts, totalInvestigations, lastReport, queuedAnalyses, failedAnalyses] = await Promise.all([
    db.analysisReport.count(),
    db.mediaUpload.count(),
    db.alert.count(),
    db.investigation.count(),
    db.analysisReport.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.analysisReport.count({ where: { status: { in: ['pending', 'processing'] } } }),
    db.analysisReport.count({ where: { status: 'failed' } }),
  ])

  const interfaces: { name: string; address: string; family: string }[] = []
  const allIf = os.networkInterfaces()
  for (const [name, list] of Object.entries(allIf)) {
    if (!list) continue
    for (const it of list) {
      if (it.internal) continue
      interfaces.push({ name, address: it.address, family: it.family })
    }
  }

  return {
    cpu: {
      usagePct: Math.round(getCpuUsagePct() * 10) / 10,
      cores: cpus.length,
      model: cpus[0]?.model ?? 'unknown',
      loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    },
    memory: {
      totalMB: Math.round(totalMem / 1024 / 1024),
      freeMB: Math.round(freeMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      usedPct: Math.round((usedMem / totalMem) * 1000) / 10,
      processRssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    },
    uptime: {
      systemSec: Math.round(os.uptime()),
      processSec: Math.round(process.uptime()),
    },
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
    },
    db: {
      totalReports,
      totalUploads,
      totalAlerts,
      totalInvestigations,
      lastReportAt: lastReport?.createdAt.toISOString() ?? null,
      queuedAnalyses,
      failedAnalyses,
    },
    net: { interfaces },
  }
}
