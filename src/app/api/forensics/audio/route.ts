/**
 * Audio deepfake forensics endpoint.
 * Accepts WAV (PCM16). For other formats, frontend should decode via WebAudio and POST PCM as WAV.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseWav, analyzeAudio } from '@/lib/engines/audio-dsp'
import { db } from '@/lib/db'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'
import { fingerprint } from '@/lib/engines/integrity'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null
    if (!file) return NextResponse.json({ error: 'audio field required' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())

    const parsed = parseWav(buf)
    if (!parsed) {
      return NextResponse.json({
        error: 'Only PCM16 WAV supported server-side. Decode in browser via WebAudio API and re-encode as WAV.',
      }, { status: 415 })
    }

    const features = analyzeAudio(parsed.samples, parsed.sampleRate)
    const processingTime = Date.now() - start

    const evidence = await fingerprint(buf, {
      fileName: file.name,
      mimeType: file.type || 'audio/wav',
    })

    const media = await db.mediaUpload.create({
      data: {
        fileName: file.name,
        fileType: 'audio',
        mimeType: file.type || 'audio/wav',
        fileSize: buf.length,
        metadata: JSON.stringify({ durationSec: features.durationSec, sampleRate: features.sampleRate }),
        status: 'completed',
        sha256: evidence.sha256,
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
        analysisType: 'audio_deepfake',
      },
    })

    const trustScore = Math.max(0, 100 - features.estimatedDeepfakeProbability)
    const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
      features.estimatedDeepfakeProbability >= 75 ? 'critical' :
      features.estimatedDeepfakeProbability >= 50 ? 'high' :
      features.estimatedDeepfakeProbability >= 25 ? 'medium' : 'low'

    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: media.id,
        analysisType: 'audio_deepfake',
        status: 'completed',
        results: JSON.stringify(features),
        trustScore,
        riskLevel,
        aiModel: 'in-house-fft-dsp',
        processingTime,
        explanation: features.artifacts.join(' | '),
        confidence: 0.85,
        flags: JSON.stringify(features.artifacts.length > 1 ? ['synthetic_voice_indicators'] : []),
        recommendations: JSON.stringify([
          'Compare with verified speaker samples',
          'Check for known voice-cloning model signatures',
          'Examine background noise consistency',
        ]),
      },
    })

    await recordAudit({
      action: 'analysis_completed',
      resource: `Audio Analysis #${report.id.slice(-6).toUpperCase()}`,
      ipAddress: clientIp(req),
      details: {
        reportId: report.id,
        deepfakeProbability: features.estimatedDeepfakeProbability,
        spectralCutoffHz: features.spectralCutoffHz,
        summary: `Audio forensics: ${features.estimatedDeepfakeProbability}% deepfake probability.`,
      },
    })

    return NextResponse.json({
      success: true,
      reportId: report.id,
      analysis: { trustScore, riskLevel, ...features },
      processingTime,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
