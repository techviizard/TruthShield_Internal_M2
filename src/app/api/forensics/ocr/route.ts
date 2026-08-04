import { NextRequest, NextResponse } from 'next/server'
import { runOcr } from '@/lib/engines/ocr'
import { db } from '@/lib/db'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'
import { fingerprint } from '@/lib/engines/integrity'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'image field required' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())

    const result = await runOcr(buf, file.type || 'image/png')
    const processingTime = Date.now() - start

    const evidence = await fingerprint(buf, {
      fileName: file.name,
      mimeType: file.type || 'image/png',
    })

    const media = await db.mediaUpload.create({
      data: {
        fileName: file.name,
        fileType: 'image',
        mimeType: file.type || 'image/png',
        fileSize: buf.length,
        sha256: evidence.sha256,
        perceptualHash: evidence.perceptualHash,
        metadata: JSON.stringify({
          language: result.language,
          detectedScripts: result.detectedScripts.map((s: { code: string }) => s.code),
          preprocessing: result.preprocessing,
        }),
        status: 'completed',
      },
    })

    // Persist the scan as an analysis report so it shows up in history/dashboards.
    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: media.id,
        analysisType: 'ocr_scan',
        status: 'completed',
        results: JSON.stringify({
          language: result.language,
          detectedScripts: result.detectedScripts,
          characterCount: result.text.length,
          confidence: result.confidence,
          textPreview: result.text.slice(0, 160),
        }),
        trustScore: result.confidence,
        riskLevel: result.confidence >= 70 ? 'low' : result.confidence >= 40 ? 'medium' : 'high',
        aiModel: 'in-house-ocr',
        processingTime,
        explanation: result.text.slice(0, 400),
        confidence: result.confidence / 100,
      },
    })

    await recordAudit({
      action: 'evidence_ingested',
      resource: `media:${media.id}`,
      ipAddress: clientIp(req),
      details: {
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        fileSize: evidence.fileSize,
        sha256: evidence.sha256,
        perceptualHash: evidence.perceptualHash,
        analysisType: 'ocr_scan',
      },
    })

    await recordAudit({
      action: 'analysis_completed',
      resource: `OCR Scan #${media.id.slice(-6).toUpperCase()}`,
      ipAddress: clientIp(req),
      details: {
        mediaId: media.id,
        language: result.language,
        confidence: result.confidence,
        charCount: result.text.length,
        summary: `OCR extracted ${result.text.length} chars in ${result.language} (${result.confidence}% confidence).`,
      },
    })

    return NextResponse.json({
      success: true,
      mediaId: media.id,
      reportId: report.id,
      evidence,
      ...result,
      processingTime,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
