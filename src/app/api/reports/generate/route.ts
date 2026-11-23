import { NextRequest, NextResponse } from 'next/server'
import { generateReport } from '@/lib/engines/report-generator'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      reportIds, title, format, includeMetadata, includeRawJson, courtReady,
      sections, author, classification, coverPage, includeRecommendations,
    } = body
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json({ error: 'reportIds[] required' }, { status: 400 })
    }
    const out = await generateReport({
      reportIds, title, format, includeMetadata, includeRawJson, courtReady,
      sections: Array.isArray(sections) ? sections.filter((x: unknown) => typeof x === 'string') : undefined,
      author: typeof author === 'string' ? author : undefined,
      classification: typeof classification === 'string' ? classification : undefined,
      coverPage: coverPage === true,
      includeRecommendations,
    })
    await recordAudit({
      action: 'report_exported',
      resource: `Report Generator`,
      ipAddress: clientIp(req),
      details: { count: reportIds.length, reportIds, format: format ?? 'html', summary: `Generated ${format ?? 'html'} report for ${reportIds.length} analyses.` },
    })
    return new NextResponse(out.content, {
      status: 200,
      headers: {
        'Content-Type': out.mime,
        'Content-Disposition': `attachment; filename="${out.filename}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
