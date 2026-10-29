import { NextRequest, NextResponse } from 'next/server';
import {
  vlmImageAnalysis,
  bufferToDataUrl,
  getModelLabelSafe,
  type AnalysisResult,
} from '@/lib/ai';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fingerprint } from '@/lib/engines/integrity';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';
import { analyzeImageForensics } from '@/lib/engines/image-verdict';
import {
  matchKnownHoaxImages,
  recordHoaxHit,
} from '@/lib/engines/hoax-match';
import { tmpdir } from 'os';
import { safeApiError } from '@/lib/api-error';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
] as const;

const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
] as const;

/**
 * Sanitize a user supplied filename before using it in a filesystem path.
 * The original filename can still be retained separately as evidence metadata.
 */
function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName);

  const sanitized = baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120);

  return sanitized || 'upload';
}

/**
 * Validate the actual file signature.
 *
 * MIME type and filename extension are client-controlled values,
 * so they should not be trusted on their own.
 */
function hasValidImageSignature(
  buffer: Buffer,
  mimeType: string,
): boolean {
  if (buffer.length < 4) {
    return false;
  }

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WEBP: RIFF....WEBP
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  // GIF: GIF87a or GIF89a
  if (mimeType === 'image/gif') {
    if (buffer.length < 6) {
      return false;
    }

    const signature = buffer.toString('ascii', 0, 6);

    return signature === 'GIF87a' || signature === 'GIF89a';
  }

  // BMP: BM
  if (mimeType === 'image/bmp') {
    return (
      buffer.length >= 2 &&
      buffer[0] === 0x42 &&
      buffer[1] === 0x4d
    );
  }

  // TIFF: II 2A 00 or MM 00 2A
  if (mimeType === 'image/tiff') {
    return (
      buffer.length >= 4 &&
      (
        (
          buffer[0] === 0x49 &&
          buffer[1] === 0x49 &&
          buffer[2] === 0x2a &&
          buffer[3] === 0x00
        ) ||
        (
          buffer[0] === 0x4d &&
          buffer[1] === 0x4d &&
          buffer[2] === 0x00 &&
          buffer[3] === 0x2a
        )
      )
    );
  }

  return false;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const aiPayload = formData.get('aiPayload') as string | null; // The compressed string for OpenRouter

    if (!(imageFile instanceof File)) {
      return NextResponse.json(
        {
          error:
            'Image file is required. Use "image" as the form field name.',
        },
        { status: 400 },
      );
    }

    /*
     * Validate that the file is not empty.
     */
    if (imageFile.size <= 0) {
      return NextResponse.json(
        {
          error: 'The uploaded image is empty.',
        },
        { status: 400 },
      );
    }

    /*
     * Validate MIME type.
     *
     * This is only the first layer because MIME type is supplied
     * by the client and cannot be fully trusted.
     */
    if (!ALLOWED_IMAGE_TYPES.includes(
      imageFile.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )) {
      return NextResponse.json(
        {
          error: 'Unsupported image type.',
        },
        { status: 400 },
      );
    }

    /*
     * Validate file extension.
     */
    const fileExtension = path
      .extname(imageFile.name)
      .toLowerCase();

    if (!ALLOWED_IMAGE_EXTENSIONS.includes(
      fileExtension as (typeof ALLOWED_IMAGE_EXTENSIONS)[number],
    )) {
      return NextResponse.json(
        {
          error: 'Unsupported image file extension.',
        },
        { status: 400 },
      );
    }

    /*
     * Ensure the extension matches the MIME type.
     */
    const mimeToExtensions: Record<string, readonly string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tif', '.tiff'],
    };

    const validExtensionsForMime = mimeToExtensions[imageFile.type];

    if (
      !validExtensionsForMime ||
      !validExtensionsForMime.includes(fileExtension)
    ) {
      return NextResponse.json(
        {
          error: 'Image file type and extension do not match.',
        },
        { status: 400 },
      );
    }

    /*
     * Validate file size using the centralized application config.
     *
     * Do not keep another hard-coded image-size limit here.
     */
    const maxImageMB = appConfig.limits.maxImageUploadMB;
    const maxImageBytes = maxImageMB * 1024 * 1024;

    if (imageFile.size > maxImageBytes) {
      return NextResponse.json(
        {
          error: `Image file size exceeds maximum of ${maxImageMB}MB.`,
        },
        { status: 400 },
      );
    }

    /*
     * Read the uploaded file into memory.
     */
    const imageBuffer = Buffer.from(
      await imageFile.arrayBuffer(),
    );

    /*
     * Validate the actual binary signature.
     *
     * This prevents a user from simply changing a file extension
     * or MIME type and bypassing the upload validation.
     */
    if (!hasValidImageSignature(imageBuffer, imageFile.type)) {
      return NextResponse.json(
        {
          error:
            'The uploaded file does not match the declared image type.',
        },
        { status: 400 },
      );
    }

    /*
     * Fingerprint before anything touches the bytes.
     * This value is used in the custody record and report.
     */
    const evidence = await fingerprint(imageBuffer, {
      fileName: imageFile.name,
      mimeType: imageFile.type,
    });

    /*
     * Never use the raw user supplied filename directly in a filesystem path.
     */
    const safeFileName = sanitizeFileName(imageFile.name);

    const tempFileName = `image-${randomUUID()}-${safeFileName}`;
    const tempFilePath = path.join(tmpdir(), tempFileName);

    await writeFile(tempFilePath, imageBuffer);

    try {
      /*
       * Convert image to base64 data URL for VLM.
       */
      const dataUrl = bufferToDataUrl(
        imageBuffer,
        imageFile.type,
      );

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

      const userPrompt =
        `Perform a comprehensive forensic analysis of this image. Look for any signs of AI generation, manipulation, splicing, or deepfake artifacts. Analyze lighting consistency, noise patterns, edge quality, and face regions if present.`;

      /*
       * In-house forensics always run.
       * Pixel-level evidence does not depend on the external
       * vision model being reachable.
       */
      const forensics = await analyzeImageForensics(
        imageBuffer,
      );

      /*
       * Perceptual-hash match against images recorded
       * in the hoax registry.
       */
      const hoaxMatches = evidence.perceptualHash
        ? await matchKnownHoaxImages(
            evidence.perceptualHash,
          )
        : [];

      for (const match of hoaxMatches) {
        await recordHoaxHit(match.id);
      }

      let analysisResult: Record<string, unknown>;
      let usedFallback = true;
      try {
       analysisResult = await vlmImageAnalysis(aiPayload || dataUrl, `${systemPrompt}\n\n${userPrompt}`);
      } catch (vlmError) {
        usedFallback = true;

        /*
         * Detailed VLM errors remain server-side.
         */
        console.warn(
          'Vision model unavailable, serving in-house forensics only:',
          vlmError,
        );

        analysisResult = {
          trustScore: forensics.trustScore,
          riskLevel: forensics.riskLevel,
          flags: forensics.signals.filter((s) => s.contribution > 0).map((s) => s.id),
          explanation: `${forensics.explanation} (Vision model unavailable - this verdict comes from pixel-level forensics and metadata alone; no semantic scene reasoning was performed.)`,
          forensicFindings: ["Vision model analysis failed due to size/timeout. Relying on pixel-level forensics."],
          confidence: 0.55,
          recommendations: [
            'Inspect the highlighted ELA regions against the visible image before concluding.',
            'Re-run once the vision model is reachable for scene-level checks such as lighting and shadow consistency.',
          ],
          details: {},
        };
      }

      const processingTime = Date.now() - startTime;

      /*
       * Ensure the result has all required fields with safe defaults.
       */
      const result: AnalysisResult = {
        trustScore:
          typeof analysisResult.trustScore === 'number'
            ? Math.max(
                0,
                Math.min(100, analysisResult.trustScore),
              )
            : 50,

        riskLevel:
          ['low', 'medium', 'high', 'critical'].includes(
            analysisResult.riskLevel as string,
          )
            ? (analysisResult.riskLevel as AnalysisResult['riskLevel'])
            : 'medium',

        flags:
          Array.isArray(analysisResult.flags)
            ? analysisResult.flags
            : [],

        explanation:
          typeof analysisResult.explanation === 'string'
            ? analysisResult.explanation
            : 'Analysis completed',

        confidence:
          typeof analysisResult.confidence === 'number'
            ? Math.max(
                0,
                Math.min(1, analysisResult.confidence),
              )
            : 0.5,

        recommendations:
          Array.isArray(analysisResult.recommendations)
            ? analysisResult.recommendations
            : [],

        details:
          (analysisResult.details as Record<string, unknown>) ||
          {},
      };

      /*
       * Attach measured forensic evidence.
       *
       * If the external model is available, combine the model
       * result with in-house pixel-level forensic evidence.
       */
      const modelTrust = usedFallback
        ? null
        : result.trustScore;

      const gap =
        modelTrust === null
          ? null
          : Math.abs(
              modelTrust - forensics.trustScore,
            );

      if (!usedFallback) {
        /*
         * Weighted blend:
         * 55% vision model
         * 45% in-house forensics
         */
        result.trustScore = Math.round(
          0.55 * result.trustScore +
            0.45 * forensics.trustScore,
        );

        result.riskLevel =
          result.trustScore <= 30
            ? 'critical'
            : result.trustScore <= 55
              ? 'high'
              : result.trustScore <= 75
                ? 'medium'
                : 'low';
      }

      result.details = {
        ...result.details,

        forensics: {
          manipulationScore:
            forensics.manipulationScore,
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
          model:
            modelTrust === null
              ? null
              : {
                  trustScore: modelTrust,
                  label: 'vision-model',
                },

          forensicTrustScore:
            forensics.trustScore,

          agreement:
            gap === null
              ? 'model_unavailable'
              : gap <= 15
                ? 'agree'
                : gap <= 35
                  ? 'partial'
                  : 'conflict',

          scoreGap:
            gap === null
              ? null
              : Math.round(gap),
        },
      };

      /*
       * Create MediaUpload record.
       */
      const mediaUpload =
        await db.mediaUpload.create({
          data: {
            fileName: imageFile.name,
            fileType: 'image',
            mimeType: imageFile.type,
            fileSize: imageFile.size,
            storagePath: tempFilePath,
            status: 'completed',
            sha256: evidence.sha256,
            perceptualHash:
              evidence.perceptualHash,

            metadata: JSON.stringify({
              hasExif:
                forensics.provenance.hasExif,
              c2paPresent:
                forensics.provenance.c2paPresent,
              editingSoftware:
                forensics.provenance.editingSoftware,
              cameraMake:
                forensics.provenance.cameraMake,
              generatorHints:
                forensics.provenance.generatorHints,
            }),
          },
        });

      /*
       * Audit evidence ingestion.
       */
      await recordAudit({
        action: 'evidence_ingested',
        resource: `media:${mediaUpload.id}`,
        ipAddress: clientIp(request),
        details: {
          fileName: evidence.fileName,
          mimeType: evidence.mimeType,
          fileSize: evidence.fileSize,
          sha256: evidence.sha256,
          perceptualHash:
            evidence.perceptualHash,
          analysisType: 'image_forensics',
        },
      });

      /*
       * Create AnalysisReport record.
       */
      const report =
        await db.analysisReport.create({
          data: {
            mediaUploadId: mediaUpload.id,
            analysisType: 'image_forensics',
            status: 'completed',
            results: JSON.stringify(result),
            trustScore: result.trustScore,
            riskLevel: result.riskLevel,
            aiModel: usedFallback
              ? 'in-house:image-forensics-v1'
              : getModelLabelSafe(),
            processingTime,
            explanation: result.explanation,
            confidence: result.confidence,
            flags: JSON.stringify(
              result.flags,
            ),
            recommendations: JSON.stringify(
              result.recommendations,
            ),
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
      /*
       * Always remove temporary file after processing.
       */
      try {
        await unlink(tempFilePath);
      } catch {
        /*
         * Ignore cleanup errors.
         */
      }
    }
  } catch (error) {
    /*
     * Detailed error is logged server-side by safeApiError().
     * The client receives only a generic error + requestId.
     */
    return safeApiError(
      error,
      'Image analysis',
      500,
    );
  }
}