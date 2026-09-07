import { NextRequest, NextResponse } from 'next/server';
import {
  structuredLLMAnalysis,
  getModelLabelSafe,
  type AnalysisResult,
} from '@/lib/ai';
import { db } from '@/lib/db';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';
import { sha256Text } from '@/lib/engines/integrity';
import { scoreText } from '@/lib/engines/text-heuristics';
import {
  matchKnownHoaxes,
  recordHoaxHit,
} from '@/lib/engines/hoax-match';
import { safeApiError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { text, language } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 },
      );
    }

    if (text.length > 50000) {
      return NextResponse.json(
        {
          error:
            'Text content exceeds maximum length of 50000 characters',
        },
        { status: 400 },
      );
    }

    const systemPrompt = `You are an expert misinformation detection and media verification AI system. You specialize in analyzing text content for signs of misinformation, propaganda, clickbait, and manipulation. You have deep expertise in:

- Identifying misinformation indicators (factual errors, unsubstantiated claims, conspiracy theories)
- Detecting clickbait language patterns and sensationalism
- Recognizing propaganda techniques (bandwagon, fear-mongering, false dichotomy, etc.)
- Performing sentiment analysis to detect emotional manipulation
- Assessing toxicity levels in content
- Extracting and evaluating verifiable claims
- Detecting the language of the text

You MUST respond in strict JSON format with the following structure:
{
  "trustScore": <number 0-100, where 100 = completely trustworthy, 0 = definitely misinformation>,
  "riskLevel": "<low|medium|high|critical>",
  "flags": [<array of detected issues like "clickbait", "emotional_language", "unsubstantiated_claims", "propaganda", "conspiracy_theory", "misleading_statistics", "false_equivalence", "cherry_picking", "appeal_to_fear", "ad_hominem", "straw_man", "fake_expert", "toxic_language">],
  "explanation": "<detailed explanation of the analysis>",
  "confidence": <number 0-1, how confident you are in this analysis>,
  "recommendations": [<array of actionable recommendations for the reader>],
  "details": {
    "misinformationIndicators": [<list of specific misinformation patterns found>],
    "clickbaitScore": <number 0-100>,
    "propagandaTechniques": [<list of techniques detected>],
    "sentiment": {
      "overall": "<positive|negative|neutral|mixed>",
      "score": <number -1 to 1>,
      "emotionalManipulation": <boolean>
    },
    "toxicity": {
      "score": <number 0-100>,
      "categories": [<list of toxicity categories like "insult", "threat", "identity_hate", "obscenity">]
    },
    "claimsExtracted": [<list of verifiable claims found in the text>],
    "languageDetected": "<detected language>"
  }
}

IMPORTANT: Respond ONLY with valid JSON. No additional text or explanation outside the JSON.`;

    const userPrompt = language
      ? `Analyze the following text (language: ${language}) for misinformation, propaganda, clickbait, and manipulation:\n\n"${text}"`
      : `Analyze the following text for misinformation, propaganda, clickbait, and manipulation:\n\n"${text}"`;

    // In-house lexical pass. Always runs: it needs no network,
    // so it is both a second opinion on the LLM verdict and
    // the answer when the LLM is unreachable.
    const heuristic = scoreText(text);

    // Known-narrative check runs before the model.
    const hoaxMatches = await matchKnownHoaxes(text);

    for (const m of hoaxMatches) {
      await recordHoaxHit(m.id);
    }

    let analysisResult: Record<string, unknown>;
    let usedFallback = false;

    try {
      analysisResult = await structuredLLMAnalysis(
        systemPrompt,
        userPrompt,
      );
    } catch (llmError) {
      usedFallback = true;

      // Detailed LLM error stays server-side.
      console.warn(
        'LLM unavailable, serving lexical heuristics only:',
        llmError,
      );

      analysisResult = {
        trustScore: heuristic.trustScore,
        riskLevel: heuristic.riskLevel,
        flags: heuristic.signals
          .filter((s) => s.weight > 0)
          .map((s) => s.id),
        explanation:
          `${heuristic.explanation} ` +
          `(Language model unavailable - this verdict comes from the in-house pattern detector alone.)`,
        confidence: 0.5,
        recommendations: [
          'Corroborate with a fact-check source before acting on this verdict.',
          'Re-run once the language model is reachable for claim-level analysis.',
        ],
        details: {},
      };
    }

    const processingTime = Date.now() - startTime;

    // Ensure the result has all required fields with defaults.
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
        (analysisResult.details as Record<string, unknown>) || {},
    };

    // Signal-level evidence for the "why was this flagged" panel.
    const scoreGap = Math.abs(
      result.trustScore - heuristic.trustScore,
    );

    result.details = {
      ...result.details,

      detectorBreakdown: {
        model: usedFallback
          ? null
          : {
              trustScore: result.trustScore,
              label: getModelLabelSafe(),
            },

        heuristic: {
          trustScore: heuristic.trustScore,
          riskLevel: heuristic.riskLevel,
          script: heuristic.script,
          explanation: heuristic.explanation,
          signals: heuristic.signals,
        },

        agreement: usedFallback
          ? 'model_unavailable'
          : scoreGap <= 15
            ? 'agree'
            : scoreGap <= 35
              ? 'partial'
              : 'conflict',

        scoreGap: usedFallback
          ? null
          : Math.round(scoreGap),
      },

      knownHoaxMatches: hoaxMatches,
    };

    // A strong registry match is decisive on its own.
    const strongHoax = hoaxMatches.find(
      (m) => m.similarity >= 45,
    );

    if (strongHoax && result.trustScore > 30) {
      result.trustScore = 25;
      result.riskLevel = 'high';

      result.explanation =
        `${result.explanation} ` +
        `Overridden by the recurring-hoax registry: this text is ${strongHoax.similarity}% similar to the known narrative "${strongHoax.title}".`;

      result.flags = [
        ...new Set([
          ...result.flags,
          'known_hoax_narrative',
        ]),
      ];
    }

    // Create a MediaUpload record for the text.
    const mediaUpload = await db.mediaUpload.create({
      data: {
        fileName: `text-analysis-${Date.now()}.txt`,
        fileType: 'text',
        mimeType: 'text/plain',
        fileSize: new TextEncoder().encode(text).length,
        metadata: JSON.stringify({
          language: language || 'auto',
          charCount: text.length,
        }),
        status: 'completed',
        sha256: sha256Text(text),
      },
    });

    // Create an AnalysisReport record.
    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: mediaUpload.id,
        analysisType: 'text_fake_news',
        status: 'completed',
        results: JSON.stringify(result),
        trustScore: result.trustScore,
        riskLevel: result.riskLevel,
        aiModel: usedFallback
          ? 'in-house:lexical-heuristics-v1'
          : getModelLabelSafe(),
        processingTime,
        explanation: result.explanation,
        confidence: result.confidence,
        flags: JSON.stringify(result.flags),
        recommendations: JSON.stringify(
          result.recommendations,
        ),
      },
    });

    await recordAudit({
      action: 'analysis_completed',
      resource: `Text Analysis #${report.id
        .slice(-6)
        .toUpperCase()}`,
      ipAddress: clientIp(request),
      details: {
        reportId: report.id,
        model: usedFallback
          ? 'in-house:lexical-heuristics-v1'
          : getModelLabelSafe(),
        processingTime: `${processingTime}ms`,
        flagsFound: String(result.flags.length),
        riskLevel: result.riskLevel,
        trustScore: result.trustScore,
        summary:
          `Text analysis completed. Trust score: ${result.trustScore}/100 - ${result.riskLevel} risk.`,
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      analysis: result,
      processingTime,
    });
  } catch (error) {
    /*
     * Keep detailed error server-side.
     * Client receives only a generic message and requestId.
     */
    console.error(
      'Text analysis error:',
      error,
    );

    /*
     * Create a failed report if possible.
     *
     * IMPORTANT:
     * Do not save error.message because it may contain
     * database paths, provider details, stack information,
     * or other internal implementation details.
     */
    try {
      const body = await new NextRequest(
        request.clone(),
      )
        .json()
        .catch(() => null);

      if (body?.text) {
        const mediaUpload =
          await db.mediaUpload.create({
            data: {
              fileName: `text-analysis-failed-${Date.now()}.txt`,
              fileType: 'text',
              mimeType: 'text/plain',
              fileSize: 0,
              status: 'failed',
            },
          });

        await db.analysisReport.create({
          data: {
            mediaUploadId: mediaUpload.id,
            analysisType: 'text_fake_news',
            status: 'failed',
            processingTime:
              Date.now() - startTime,

            explanation:
              'Text analysis failed due to an internal processing error.',
          },
        });
      }
    } catch {
      // Ignore database errors in error handler.
    }

    return safeApiError(
      error,
      'Text analysis',
      500,
    );
  }
}