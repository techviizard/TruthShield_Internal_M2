/**
 * Real report generator. No external PDF lib - emit standards-compliant HTML
 * that browsers can Print-to-PDF, plus a structured JSON download.
 * Avoids adding heavy deps; works offline.
 */

import { db } from '@/lib/db'
import { auditChainHead, verifyAuditChain } from '@/lib/engines/audit-logger'
import { sha256Text } from '@/lib/engines/integrity'

export interface ReportOptions {
  reportIds: string[]
  title?: string
  includeMetadata?: boolean
  includeRawJson?: boolean
  format?: 'html' | 'json'
  /** Adds the evidence-integrity annex: per-artifact hashes, case record, chain head. */
  courtReady?: boolean
}

export async function generateReport(opts: ReportOptions): Promise<{ content: string; mime: string; filename: string }> {
  const reports = await db.analysisReport.findMany({
    where: { id: { in: opts.reportIds } },
    include: {
      mediaUpload: true,
      factChecks: true,
      investigation: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const title = opts.title ?? 'TruthShield Verification Report'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')

  // Integrity annex - computed for every export so the JSON and HTML forms of a
  // report carry the same provenance claims.
  const generatedAt = new Date().toISOString()
  const [chainHead, chainCheck] = await Promise.all([auditChainHead(), verifyAuditChain()])
  const evidence = reports.map((r) => ({
    reportId: r.id,
    fileName: r.mediaUpload.fileName,
    mimeType: r.mediaUpload.mimeType,
    fileSize: r.mediaUpload.fileSize,
    sha256: r.mediaUpload.sha256,
    perceptualHash: r.mediaUpload.perceptualHash,
    ingestedAt: r.mediaUpload.createdAt.toISOString(),
    analysedAt: r.createdAt.toISOString(),
    model: r.aiModel,
  }))
  // Digest over the report bodies themselves, so a later edit to this document
  // can be detected independently of the audit chain.
  const documentDigest = sha256Text(
    JSON.stringify({ title, generatedAt, evidence, reportIds: opts.reportIds })
  )
  const integrity = {
    documentDigest,
    auditChainHead: chainHead,
    auditChainValid: chainCheck.valid,
    auditChainBreaks: chainCheck.breaks.length,
    auditRecordsVerified: `${chainCheck.verifiedEntries}/${chainCheck.totalEntries}`,
    evidence,
    cases: dedupeCases(reports),
  }

  if (opts.format === 'json') {
    return {
      content: JSON.stringify({ title, generatedAt, integrity, reports }, null, 2),
      mime: 'application/json',
      filename: `truthshield-report-${ts}.json`,
    }
  }

  const rows = reports.map((r) => {
    const flags: string[] = r.flags ? safeJson(r.flags, []) : []
    const recs: string[] = r.recommendations ? safeJson(r.recommendations, []) : []
    const fc = r.factChecks ?? []
    return `
      <section class="report">
        <h2>${escapeHtml(r.analysisType)} - ${escapeHtml(r.mediaUpload.fileName)}</h2>
        <div class="grid">
          <div><b>Trust Score</b><span class="big">${r.trustScore ?? ' - '}/100</span></div>
          <div><b>Risk Level</b><span class="risk ${r.riskLevel ?? ''}">${r.riskLevel ?? ' - '}</span></div>
          <div><b>Confidence</b><span>${r.confidence != null ? `${Math.round(r.confidence * 100)}%` : ' - '}</span></div>
          <div><b>Processing Time</b><span>${r.processingTime ?? ' - '}ms</span></div>
        </div>
        <p><b>Explanation:</b> ${escapeHtml(r.explanation ?? 'n/a')}</p>
        ${flags.length > 0 ? `<p><b>Flags:</b> ${flags.map(escapeHtml).join(', ')}</p>` : ''}
        ${recs.length > 0 ? `<ul class="recs">${recs.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        ${fc.length > 0 ? `<details><summary>Fact Check Matches (${fc.length})</summary><ul>${fc.map((m) => `<li>[${escapeHtml(m.verdict ?? '?')}] <a href="${escapeHtml(m.url ?? '#')}">${escapeHtml(m.source)}</a> - ${escapeHtml(m.snippet ?? '')}</li>`).join('')}</ul></details>` : ''}
        ${opts.includeMetadata && r.mediaUpload.metadata ? `<details><summary>Media Metadata</summary><pre>${escapeHtml(r.mediaUpload.metadata)}</pre></details>` : ''}
        ${opts.includeRawJson && r.results ? `<details><summary>Raw Analysis</summary><pre>${escapeHtml(r.results)}</pre></details>` : ''}
        <hr/>
      </section>
    `
  }).join('\n')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:880px;margin:2rem auto;padding:0 1rem;color:#222}
  h1{border-bottom:2px solid #10b981;padding-bottom:.5rem}
  .meta{color:#666;font-size:.9em}
  section.report{margin:2rem 0;padding:1rem;border:1px solid #ddd;border-radius:8px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin:1rem 0}
  .grid div{background:#f6f6f6;padding:.5rem;border-radius:4px}
  .grid b{display:block;font-size:.8em;color:#666;margin-bottom:.25rem}
  .grid span{font-weight:600}
  .big{font-size:1.4em;color:#10b981}
  .risk{padding:.15rem .5rem;border-radius:12px;font-size:.85em}
  .risk.critical{background:#fee;color:#c00}
  .risk.high{background:#fef0e0;color:#c50}
  .risk.medium{background:#fff8d0;color:#a80}
  .risk.low{background:#e0f5e0;color:#070}
  details{margin:.5rem 0}
  pre{background:#f6f6f6;padding:.5rem;border-radius:4px;overflow:auto;max-height:240px;font-size:.8em}
  .recs li{margin:.2rem 0}
  .annex-box{border:1px solid #10b981;border-radius:8px;padding:1rem;margin:1.5rem 0;background:#f6fffb}
  .annex-box h2{margin-top:0;font-size:1.1rem}
  .annex-box h3{font-size:.9rem;margin:1rem 0 .35rem;color:#444}
  table.annex{width:100%;border-collapse:collapse;font-size:.78em}
  table.annex th,table.annex td{border:1px solid #d8e6e0;padding:.3rem .45rem;text-align:left;vertical-align:top}
  table.annex th{background:#eaf7f1}
  table.annex code{word-break:break-all}
  .ok{color:#067a49;font-weight:600}
  .bad{color:#c00;font-weight:600}
  @media print { body { max-width:none } section { page-break-inside:avoid } }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Generated ${new Date().toLocaleString()} - ${reports.length} report(s) - TruthShield v3.3.0</p>
  ${opts.courtReady === false ? '' : renderIntegrityAnnex(integrity)}
  ${rows}
  <footer><p class="meta">End of report. To convert to PDF: File → Print → Save as PDF.</p></footer>
</body></html>`

  return {
    content: html,
    mime: 'text/html',
    filename: `truthshield-report-${ts}.html`,
  }
}

type CaseRow = {
  caseNumber: string | null
  firNumber: string | null
  officerName: string | null
  officerBadge: string | null
  jurisdiction: string | null
  title: string
}

/** One row per distinct case referenced by the selected reports. */
function dedupeCases(
  reports: { investigation: CaseRow | null }[]
): CaseRow[] {
  const seen = new Map<string, CaseRow>()
  for (const r of reports) {
    const inv = r.investigation
    if (!inv) continue
    const key = inv.caseNumber ?? inv.firNumber ?? inv.title
    if (!seen.has(key)) seen.set(key, inv)
  }
  return [...seen.values()]
}

interface IntegrityAnnex {
  documentDigest: string
  auditChainHead: { seq: number; hash: string | null; at: string | null }
  auditChainValid: boolean
  auditChainBreaks: number
  auditRecordsVerified: string
  evidence: {
    reportId: string
    fileName: string
    mimeType: string
    fileSize: number
    sha256: string | null
    perceptualHash: string | null
    ingestedAt: string
    analysedAt: string
    model: string | null
  }[]
  cases: CaseRow[]
}

/**
 * Evidence-integrity annex. Placed before the findings so a reader sees what the
 * findings are about - which artifact, which case, and whether the trail behind
 * them still verifies - before reading any conclusion.
 */
function renderIntegrityAnnex(a: IntegrityAnnex): string {
  const caseRows = a.cases.length
    ? `<table class="annex">
        <tr><th>Case</th><th>FIR</th><th>Officer</th><th>Jurisdiction</th></tr>
        ${a.cases.map((c) => `<tr>
          <td>${escapeHtml(c.caseNumber ?? c.title)}</td>
          <td>${escapeHtml(c.firNumber ?? ' - ')}</td>
          <td>${escapeHtml([c.officerName, c.officerBadge].filter(Boolean).join(' · ') || ' - ')}</td>
          <td>${escapeHtml(c.jurisdiction ?? ' - ')}</td>
        </tr>`).join('')}
      </table>`
    : '<p class="meta">No case record is linked to these reports.</p>'

  return `
  <section class="annex-box">
    <h2>Evidence Integrity Annex</h2>
    <p class="meta">
      Document digest <code>${escapeHtml(a.documentDigest)}</code>
    </p>
    <p class="${a.auditChainValid ? 'ok' : 'bad'}">
      Audit chain: ${a.auditChainValid ? 'INTACT' : `INTEGRITY FAILURE - ${a.auditChainBreaks} break(s)`}
      &nbsp;·&nbsp; ${escapeHtml(a.auditRecordsVerified)} records verified
      &nbsp;·&nbsp; head #${a.auditChainHead.seq}
      <code>${escapeHtml(a.auditChainHead.hash ?? ' - ')}</code>
    </p>
    <h3>Case record</h3>
    ${caseRows}
    <h3>Artifact fingerprints</h3>
    <table class="annex">
      <tr><th>File</th><th>Type</th><th>Size</th><th>SHA-256 (at ingest)</th><th>Ingested</th></tr>
      ${a.evidence.map((e) => `<tr>
        <td>${escapeHtml(e.fileName)}</td>
        <td>${escapeHtml(e.mimeType)}</td>
        <td>${e.fileSize.toLocaleString()} B</td>
        <td><code>${escapeHtml(e.sha256 ?? 'not recorded')}</code></td>
        <td>${escapeHtml(e.ingestedAt.replace('T', ' ').slice(0, 19))}</td>
      </tr>`).join('')}
    </table>
    <p class="meta">
      Hashes are computed on the received bytes before analysis. Recomputing SHA-256 over the
      seized copy must reproduce the value above; any difference means the copy is not the
      artifact that was analysed.
    </p>
  </section>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T } catch { return fallback }
}
