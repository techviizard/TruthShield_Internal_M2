import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { analyzeFrames, type FrameInput } from '@/lib/engines/video-temporal'
import { fingerprint, sha256 } from '@/lib/engines/integrity'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'
import { appConfig } from '@/config/app.config'

/**
 * Frame-level video forensics.
 *
 * Frames arrive already decoded by the browser (canvas capture from the video
 * element), which keeps ffmpeg out of the deployment and means the operator's
 * own machine does the decoding. The server analyses pixels, not containers.
 *
 * Body: multipart/form-data
 *   frame_0, frame_1, …  JPEG blobs
 *   timestamps            JSON array of seconds, parallel to the frames
 *   fileName, duration    optional metadata about the source clip
 */
const MAX_FRAMES = 48

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const form = await request.formData()

    const timestampsRaw = form.get('timestamps')
    let timestamps: number[] = []
    if (typeof timestampsRaw === 'string') {
      try {
        const parsed = JSON.parse(timestampsRaw)
        if (Array.isArray(parsed)) timestamps = parsed.map(Number).filter((n) => Number.isFinite(n))
      } catch {
        return NextResponse.json({ error: '`timestamps` must be a JSON array of seconds' }, { status: 400 })
      }
    }

    const frames: FrameInput[] = []
    for (let i = 0; i < MAX_FRAMES; i++) {
      const blob = form.get(`frame_${i}`)
      if (!(blob instanceof File)) break
      frames.push({
        timestamp: timestamps[i] ?? i,
        buffer: Buffer.from(await blob.arrayBuffer()),
      })
    }

    if (!frames.length) {
      return NextResponse.json(
        { error: 'At least one frame is required (form fields frame_0, frame_1, …)' },
        { status: 400 }
      )
    }

    const maxMB = appConfig.limits.maxVideoUploadMB
    const totalBytes = frames.reduce((a, f) => a + f.buffer.length, 0)
    if (totalBytes > maxMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Frame payload exceeds ${maxMB}MB` },
        { status: 413 }
      )
    }

    const verdict = await analyzeFrames(frames)
    const processingTime = Date.now() - startTime

    const fileName = String(form.get('fileName') ?? `video-frames-${Date.now()}`)
    // The clip's own bytes never reach the server, so the evidence hash covers
    // exactly what was analysed: the concatenated frame data.
    const framesDigest = sha256(Buffer.concat(frames.map((f) => f.buffer)))
    const firstFrame = await fingerprint(frames[0].buffer, {
      fileName: `${fileName}-frame0.jpg`,
      mimeType: 'image/jpeg',
    })

    const trustScore = 100 - verdict.manipulationScore
    const riskLevel =
      verdict.manipulationScore >= 70 ? 'critical'
        : verdict.manipulationScore >= 45 ? 'high'
          : verdict.manipulationScore >= 22 ? 'medium'
            : 'low'

    const mediaUpload = await db.mediaUpload.create({
      data: {
        fileName,
        fileType: 'video',
        mimeType: 'video/frames',
        fileSize: totalBytes,
        status: 'completed',
        sha256: framesDigest,
        perceptualHash: firstFrame.perceptualHash,
        metadata: JSON.stringify({
          analysisMode: 'client-sampled-frames',
          frameCount: verdict.frameCount,
          durationCovered: verdict.durationCovered,
          sourceDuration: Number(form.get('duration')) || null,
        }),
      },
    })

    await recordAudit({
      action: 'evidence_ingested',
      resource: `media:${mediaUpload.id}`,
      ipAddress: clientIp(request),
      details: {
        fileName,
        frameCount: verdict.frameCount,
        sha256: framesDigest,
        note: 'SHA-256 covers the sampled frames, not the source container.',
        analysisType: 'video_frame_forensics',
      },
    })

    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: mediaUpload.id,
        analysisType: 'video_deepfake',
        status: 'completed',
        results: JSON.stringify(verdict),
        trustScore,
        riskLevel,
        aiModel: 'in-house:video-temporal-v1',
        processingTime,
        explanation: verdict.explanation,
        confidence: 0.6,
        flags: JSON.stringify(verdict.signals.map((s) => s.id)),
        recommendations: JSON.stringify([
          'Open the flagged frames and compare them against neighbouring frames before concluding.',
          'Face-swap identity checks and lip-sync scoring are not performed here and need a face model.',
        ]),
      },
    })

    await recordAudit({
      action: 'analysis_completed',
      resource: `Video Frame Analysis #${report.id.slice(-6).toUpperCase()}`,
      ipAddress: clientIp(request),
      details: {
        reportId: report.id,
        frameCount: verdict.frameCount,
        flaggedFrames: verdict.flaggedFrames.length,
        temporalConsistency: verdict.temporalConsistency,
        summary: `Frame forensics over ${verdict.frameCount} frames — trust ${trustScore}/100, ${verdict.flaggedFrames.length} frame(s) flagged.`,
      },
    })

    return NextResponse.json({
      success: true,
      reportId: report.id,
      mediaUploadId: mediaUpload.id,
      evidence: { sha256: framesDigest, coversFramesOnly: true },
      trustScore,
      riskLevel,
      analysis: verdict,
      processingTime,
    })
  } catch (error) {
    console.error('Video frame analysis error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyse frames',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
