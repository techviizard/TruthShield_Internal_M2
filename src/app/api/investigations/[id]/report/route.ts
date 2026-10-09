import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateReport } from '@/lib/engines/report-generator'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const investigation = await db.investigation.findUnique({
      where: { id },
      include: {
        analyses: {
          include: {
            mediaUpload: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                mimeType: true,
                fileSize: true,
                sha256: true,
                perceptualHash: true,
                createdAt: true,
              },
            },
            factChecks: {
              select: {
                id: true,
                source: true,
                claim: true,
                verdict: true,
                confidence: true,
                url: true,
                snippet: true,
                matchedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!investigation) {
      return NextResponse.json(
        { success: false, error: 'Investigation not found' },
        { status: 404 }
      )
    }

    const report = await generateReport({
      reportIds: investigation.analyses.map((analysis) => analysis.id),
      title: `Investigation Report - ${investigation.title}`,
      format: 'json',
      includeMetadata: true,
      includeRawJson: true,
      courtReady: true,
    })

    const generatedReport = JSON.parse(report.content)

    await recordAudit({
      action: 'report_exported',
      resource: `Investigation ${investigation.id}`,
      ipAddress: clientIp(req),
      details: {
        count: investigation.analyses.length,
        format: 'json',
        summary: `Generated report for investigation ${investigation.id}.`,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        investigation,
        generatedReport,
      },
    })
  } catch (error) {
    console.error('Investigation report generation failed:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to generate investigation report' },
      { status: 500 }
    )
  }
}