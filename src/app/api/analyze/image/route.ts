import { NextRequest, NextResponse } from 'next/server';
import { vlmImageAnalysis, bufferToDataUrl, getModelLabelSafe, type AnalysisResult } from '@/lib/ai';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fingerprint } from '@/lib/engines/integrity';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';
import { analyzeImageForensics } from '@/lib/engines/image-verdict';
import { matchKnownHoaxImages, recordHoaxHit } from '@/lib/engines/hoax-match';
import { error } from 'console';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required. Use "image" as the form field name.' },
        { status: 400 }
      );
    }

    //check image size(max 20MB)
    const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
    if (imageFile.size > MAX_IMAGE_SIZE) {
      return NextResponse.json (
        {error: "Image too large. Max size 20MB" },
        { status: 400}
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${imageFile.type}. Supported types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    //validate file extension matches expected types (defence against MIME spoofing)
    const allowedExtensions = ['.jpg','.jpeg','.png','.webp','.gif','.bmp','.tiff'];
    const fileExtension = imageFile.name.toLocaleLowerCase().slice(imageFile.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)){
      return NextResponse.json(
        { error: `Unsupported file extension: ${fileExtension}. Supported: ${allowedExtensions.join(',')}`},
        { status: 400 }
      );
    }

    // Validate file size (limit from central config)
    const maxImageMB = appConfig.limits.maxImageUploadMB;
    if (imageFile.size > maxImageMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Image file size exceeds maximum of ${maxImageMB}MB` },
        { status: 400 }
      );
    }

    // Read the file buffer
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    // Fingerprint before anything touches the bytes - this is the value quoted
    // in the custody record and the court-ready report.
    const evidence = await fingerprint(imageBuffer, {
      fileName: imageFile.name,
      mimeType: imageFile.type,
    });

    // Save temporarily to /tmp
    const tempFileName = `image-${randomUUID()}-${imageFile.name}`;
    const tempFilePath = path.join('/tmp', tempFileName);
    await writeFile(tempFilePath, imageBuffer);

    try {
      // Convert to base64 data URL for VLM
      const dataUrl = bufferToDataUrl(imageBuffer, imageFile.type);

      const systemPrompt = `You are an expert digital image forensics analyst specializing in deepfake detection and image manipulation analysis. You have extensive expertise in:

- Detecting signs of AI-generated images (GAN artifacts, synthetic textures, unusual patterns)
- Identifying image manipulation (inconsistent lighting, clone detection, splicing artifacts)
- Analyzing metadata anomalies
- Detecting splicing and compositing artifacts
- Identifying deepfake indicators in face regions
- Evaluating noise patterns and compression artifacts
- Checking for inconsistent shadows, reflections, and perspective errors

You MUST respond in strict JSON format with the following structure:
{
  "trustScore": <number 0-100, where 100 = authentic image, 0 = definitely manipulated/fake>,
  "riskLevel": "<low|medium|high|critical>",
  "flags": [<array of detected issues like "ai_generated", "manipulation_detected", "splicing_artifact", "inconsistent_lighting", "clone_detection", "face_manipulation", "noise_inconsistency", "compression_artifact", "metadata_anomaly", "perspective_error", "shadow_inconsistency", "reflection_anomaly">],
  "explanation": "<detailed explanation of the forensic analysis>",
  "confidence": <number 0-1, how confident you are in this analysis>,
  "recommendations": [<array of actionable recommendations>],
  "details": {
    "aiGenerationProbability": <number 0-100>,
    "manipulationIndicators": [<list of specific manipulations detected>],
    "forensicFindings": {
      "lightingConsistency": "<consistent|inconsistent|partially_consistent>",
      "noisePatternAnalysis": "<uniform|irregular|suspicious>",
      "edgeAnalysis": "<natural|artificial|mixed>",
      "textureConsistency": "<consistent|inconsistent>"
    },
    "faceRegionAnalysis": {
      "facesDetected": <number>,
      "manipulationIndicators": [<list>],
      "blendingArtifacts": <boolean>,
      "skinTextureConsistency": <boolean>
    },
    "metadataAnalysis": {
      "hasMetadata": <boolean>,
      "anomalies": [<list>],
      "editingSoftware": "<string or null>"
    },
    "overallAssessment": "<authentic|likely_manipulated|likely_ai_generated|uncertain>"
  }
}

IMPORTANT: Respond ONLY with valid JSON. No additional text or explanation outside the JSON.`;

      const userPrompt = `Perform a comprehensive forensic analysis of this image. Look for any signs of AI generation, manipulation, splicing, or deepfake artifacts. Analyze lighting consistency, noise patterns, edge quality, and face regions if present.`;

      // In-house forensics always run: pixel-level evidence (ELA, sensor noise,
      // frequency residual, provenance metadata) does not depend on a model
      // being reachable, and it is what the score attribution is built from.
      const forensics = await analyzeImageForensics(imageBuffer);

      // Perceptual-hash match against images recorded in the hoax registry.
      const hoaxMatches = evidence.perceptualHash
        ? await matchKnownHoaxImages(evidence.perceptualHash)
        : [];
      for (const m of hoaxMatches) await recordHoaxHit(m.id);

      let analysisResult: Record<string, unknown>;
      let usedFallback = false;
      try {
        analysisResult = await vlmImageAnalysis(dataUrl, `${systemPrompt}\n\n${userPrompt}`);
      } catch (vlmError) {
        usedFallback = true;
        console.warn('Vision model unavailable, serving in-house forensics only:', vlmError);
        analysisResult = {
          trustScore: forensics.trustScore,
          riskLevel: forensics.riskLevel,
          flags: forensics.signals.filter((s) => s.contribution > 0).map((s) => s.id),
          explanation: `${forensics.explanation} (Vision model unavailable - this verdict comes from pixel-level forensics and metadata alone; no semantic scene reasoning was performed.)`,
          confidence: 0.55,
          recommendations: [
            'Inspect the highlighted ELA regions against the visible image before concluding.',
            'Re-run once the vision model is reachable for scene-level checks such as lighting and shadow consistency.',
          ],
          details: {},
        };
      }

      const processingTime = Date.now() - startTime;

      // Ensure the result has all required fields with defaults
      const result: AnalysisResult = {
        trustScore: typeof analysisResult.trustScore === 'number'
          ? Math.max(0, Math.min(100, analysisResult.trustScore))
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

      // Attach the measured evidence, and let it move the score. Pixel-level
      // findings are not decoration on a model opinion - where they disagree
      // with the model, the disagreement is reported rather than hidden.
      const modelTrust = usedFallback ? null : result.trustScore;
      const gap = modelTrust === null ? null : Math.abs(modelTrust - forensics.trustScore);
      if (!usedFallback) {
        // Weighted blend: the model reads the scene, the engines read the pixels.
        result.trustScore = Math.round(0.55 * result.trustScore + 0.45 * forensics.trustScore);
        result.riskLevel =
          result.trustScore <= 30 ? 'critical'
            : result.trustScore <= 55 ? 'high'
              : result.trustScore <= 75 ? 'medium'
                : 'low';
      }
      result.details = {
        ...result.details,
        forensics: {
          manipulationScore: forensics.manipulationScore,
          trustScore: forensics.trustScore,
          riskLevel: forensics.riskLevel,
          signals: forensics.signals,
          explanation: forensics.explanation,
          ela: forensics.ela,
          elaOverlay: forensics.elaOverlay,
          elaRegions: forensics.elaRegions,
          noise: forensics.noise,
          edges: forensics.edges,
          spectral: forensics.spectral,
        },
        provenance: forensics.provenance,
        knownHoaxMatches: hoaxMatches,
        detectorBreakdown: {
          model: modelTrust === null ? null : { trustScore: modelTrust, label: 'vision-model' },
          forensicTrustScore: forensics.trustScore,
          agreement: gap === null
            ? 'model_unavailable'
            : gap <= 15 ? 'agree' : gap <= 35 ? 'partial' : 'conflict',
          scoreGap: gap === null ? null : Math.round(gap),
        },
      };

      // Create a MediaUpload record
      const mediaUpload = await db.mediaUpload.create({
        data: {
          fileName: imageFile.name,
          fileType: 'image',
          mimeType: imageFile.type,
          fileSize: imageFile.size,
          storagePath: tempFilePath,
          status: 'completed',
          sha256: evidence.sha256,
          perceptualHash: evidence.perceptualHash,
          metadata: JSON.stringify({
            hasExif: forensics.provenance.hasExif,
            c2paPresent: forensics.provenance.c2paPresent,
            editingSoftware: forensics.provenance.editingSoftware,
            cameraMake: forensics.provenance.cameraMake,
            generatorHints: forensics.provenance.generatorHints,
          }),
        },
      });

      await recordAudit({
        action: 'evidence_ingested',
        resource: `media:${mediaUpload.id}`,
        ipAddress: clientIp(request),
        details: {
          fileName: evidence.fileName,
          mimeType: evidence.mimeType,
          fileSize: evidence.fileSize,
          sha256: evidence.sha256,
          perceptualHash: evidence.perceptualHash,
          analysisType: 'image_forensics',
        },
      });

      // Create an AnalysisReport record
      const report = await db.analysisReport.create({
        data: {
          mediaUploadId: mediaUpload.id,
          analysisType: 'image_forensics',
          status: 'completed',
          results: JSON.stringify(result),
          trustScore: result.trustScore,
          riskLevel: result.riskLevel,
          aiModel: usedFallback ? 'in-house:image-forensics-v1' : getModelLabelSafe(),
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
    } finally {
      // Clean up temp file
      try {
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error('Image analysis error:', error);
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      },
      { status: 500 }
    );
  }
}
