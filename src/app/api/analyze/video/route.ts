import { NextRequest, NextResponse } from 'next/server';
import { vlmVideoAnalysis, vlmImageAnalysis, bufferToDataUrl, getModelLabel, type AnalysisResult } from '@/lib/ai';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';
import { writeFile, unlink, readFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fingerprint, type EvidenceFingerprint } from '@/lib/engines/integrity';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let evidence: EvidenceFingerprint | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';

    let videoUrl: string | null = null;
    let videoFile: File | null = null;
    let tempFilePath: string | null = null;

    // Handle different input methods
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('video') as File | null;
      const url = formData.get('url') as string | null;

      if (file) {
        videoFile = file;
      } else if (url) {
        videoUrl = url;
      }
    } else {
      const body = await request.json();
      if (body.url) {
        videoUrl = body.url;
      }
    }

    if (!videoFile && !videoUrl) {
      return NextResponse.json(
        { error: 'Either a video file (form field "video") or a video URL (field "url") is required.' },
        { status: 400 }
      );
    }

    // Validate video file if uploaded
    if (videoFile) {
      const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
      if (!allowedTypes.includes(videoFile.type)) {
        return NextResponse.json(
          { error: `Unsupported video type: ${videoFile.type}. Supported types: ${allowedTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate file size (limit from central config)
      const maxVideoMB = appConfig.limits.maxVideoUploadMB;
      if (videoFile.size > maxVideoMB * 1024 * 1024) {
        return NextResponse.json(
          { error: `Video file size exceeds maximum of ${maxVideoMB}MB` },
          { status: 400 }
        );
      }

      if (videoFile.size === 0) {
        return NextResponse.json(
          { error: 'Uploaded video file is empty.' },
          { status: 400 }
        );
      }
    }

    const systemPrompt = `You are an expert video deepfake detection and digital forensics analyst. You specialize in analyzing videos for signs of AI manipulation and deepfake creation. You have deep expertise in:

- Detecting face manipulation and deepfake indicators (face swapping, lip-sync manipulation, expression transfer)
- Identifying temporal inconsistencies between frames (flickering, unnatural transitions)
- Analyzing audio-visual synchronization issues
- Detecting blink irregularities and unnatural eye movements
- Identifying compression artifacts that may indicate manipulation
- Evaluating skin texture consistency and blending artifacts
- Detecting GAN-generated video content
- Analyzing head pose and facial landmark consistency

You MUST respond in strict JSON format with the following structure:
{
  "trustScore": <number 0-100, where 100 = authentic video, 0 = definitely deepfake/manipulated>,
  "riskLevel": "<low|medium|high|critical>",
  "flags": [<array of detected issues like "face_manipulation", "temporal_inconsistency", "audio_visual_desync", "blink_irregularity", "compression_artifact", "skin_blending_artifact", "unnatural_movement", "lighting_inconsistency", "gan_artifact", "head_pose_anomaly", "lip_sync_anomaly">],
  "explanation": "<detailed explanation of the forensic analysis>",
  "confidence": <number 0-1, how confident you are in this analysis>,
  "recommendations": [<array of actionable recommendations>],
  "details": {
    "deepfakeProbability": <number 0-100>,
    "faceAnalysis": {
      "facesDetected": <number>,
      "manipulationIndicators": [<list>],
      "blinkPattern": "<natural|irregular|absent>",
      "eyeMovementConsistency": "<consistent|inconsistent>"
    },
    "temporalAnalysis": {
      "frameConsistency": "<consistent|irregular|suspicious>",
      "flickeringDetected": <boolean>,
      "unnaturalTransitions": <number>
    },
    "audioVisualSync": {
      "lipSyncScore": <number 0-100>,
      "desyncDetected": <boolean>,
      "audioAnomalies": [<list>]
    },
    "overallAssessment": "<authentic|likely_manipulated|likely_deepfake|uncertain>"
  }
}

IMPORTANT: Respond ONLY with valid JSON. No additional text or explanation outside the JSON.`;

    const userPrompt = `Perform a comprehensive deepfake detection analysis of this video. Examine faces, temporal consistency, audio-visual synchronization, and look for any signs of AI manipulation or deepfake creation.`;

    let analysisResult: Record<string, unknown>;

    if (videoFile) {
      // Save video temporarily and analyze
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      evidence = await fingerprint(videoBuffer, {
        fileName: videoFile.name,
        mimeType: videoFile.type,
      });
      tempFilePath = path.join('/tmp', `video-${randomUUID()}-${videoFile.name}`);
      await writeFile(tempFilePath, videoBuffer);

      try {
        // For uploaded video, we'll use VLM with the video content
        // Convert to base64 data URL for the VLM
        const videoBase64 = videoBuffer.toString('base64');
        const dataUrl = `data:${videoFile.type};base64,${videoBase64}`;

        // Use VLM with image_url (for frame extraction from video)
        analysisResult = await vlmImageAnalysis(
          dataUrl,
          `${systemPrompt}\n\n${userPrompt}`
        );
      } finally {
        // Clean up temp file
        try {
          await unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    } else if (videoUrl) {
      // For URL, pass directly to VLM with video_url content type
      analysisResult = await vlmVideoAnalysis(
        videoUrl,
        `${systemPrompt}\n\n${userPrompt}`
      );
    } else {
      return NextResponse.json(
        { error: 'No video source provided' },
        { status: 400 }
      );
    }

    const processingTime = Date.now() - startTime;

    // Ensure the result has all required fields with defaults
    const result: AnalysisResult = {
      trustScore: typeof analysisResult.trustScore === 'number'
        ? Math.max(0, Math.min(100, analysisResult.trustScore ?? 0))
        : 50,
      riskLevel: ['low', 'medium', 'high', 'critical'].includes(analysisResult.riskLevel as string)
        ? (analysisResult.riskLevel as AnalysisResult['riskLevel'])
        : 'medium',
      flags: Array.isArray(analysisResult.flags) ? analysisResult.flags : [],
      explanation: typeof analysisResult.explanation === 'string'
        ? analysisResult.explanation
        : 'Analysis completed',
      confidence: typeof analysisResult.confidence === 'number'
        ? Math.max(0, Math.min(1, analysisResult.confidence))
        : 0.5,
      recommendations: Array.isArray(analysisResult.recommendations)
        ? analysisResult.recommendations
        : [],
      details: (analysisResult.details as Record<string, unknown>) || {},
    };

    // Create a MediaUpload record
    const mediaUpload = await db.mediaUpload.create({
      data: {
        fileName: videoFile ? videoFile.name : `video-url-${Date.now()}`,
        fileType: 'video',
        mimeType: videoFile ? videoFile.type : 'video/unknown',
        fileSize: videoFile ? videoFile.size : 0,
        storagePath: videoUrl || tempFilePath,
        metadata: JSON.stringify({ sourceType: videoFile ? 'upload' : 'url', url: videoUrl }),
        status: 'completed',
        sha256: evidence?.sha256 ?? null,
        perceptualHash: evidence?.perceptualHash ?? null,
      },
    });

    await recordAudit({
      action: 'evidence_ingested',
      resource: `media:${mediaUpload.id}`,
      ipAddress: clientIp(request),
      details: {
        fileName: mediaUpload.fileName,
        mimeType: mediaUpload.mimeType,
        fileSize: mediaUpload.fileSize,
        // A URL source has no local bytes to hash - recorded as such rather than faked.
        sha256: evidence?.sha256 ?? null,
        sourceType: videoFile ? 'upload' : 'url',
        sourceUrl: videoUrl,
        analysisType: 'video_deepfake',
      },
    });

    // Create an AnalysisReport record
    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: mediaUpload.id,
        analysisType: 'video_deepfake',
        status: 'completed',
        results: JSON.stringify(result),
        trustScore: result.trustScore,
        riskLevel: result.riskLevel,
        aiModel: getModelLabel(),
        processingTime,
        explanation: result.explanation,
        confidence: result.confidence,
        flags: JSON.stringify(result.flags),
        recommendations: JSON.stringify(result.recommendations),
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      mediaUploadId: mediaUpload.id,
      evidence,
      analysis: result,
      processingTime,
    });
  } catch (error) {
    console.error('Video analysis error:', error);
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to analyze video',
        details: 'An unexpected error occurred. Please try again later.',
        processingTime,
      },
      { status: 500 }
    );
  }
}
