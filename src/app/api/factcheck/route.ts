import { NextRequest, NextResponse } from 'next/server';
import {
  structuredLLMAnalysis,
  webSearchFactCheck,
  getDomainCredibility,
  getModelLabelSafe,
  type FactCheckResult,
  type FactCheckSource,
} from '@/lib/ai';
import { db } from '@/lib/db';
import { detectStance, rollupStances } from '@/lib/engines/semantic';
import { matchKnownHoaxes, recordHoaxHit } from '@/lib/engines/hoax-match';

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h — viral claims get re-checked often

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { claim, language, skipCache } = body;

    if (!claim || typeof claim !== 'string') {
      return NextResponse.json(
        { error: 'Claim text is required' },
        { status: 400 }
      );
    }

    if (claim.length > 10000) {
      return NextResponse.json(
        { error: 'Claim text exceeds maximum length of 10000 characters' },
        { status: 400 }
      );
    }

    const normalizedClaim = claim.trim();

    // Step 0: Cache — return a recent identical check instead of re-running search + LLM
    if (!skipCache) {
      const cached = await db.analysisReport.findFirst({
        where: {
          analysisType: 'fact_check',
          status: 'completed',
          createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
          mediaUpload: {
            metadata: { contains: `"claim":${JSON.stringify(normalizedClaim)}` },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (cached?.results) {
        try {
          const cachedResult = JSON.parse(cached.results) as FactCheckResult;
          return NextResponse.json({
            success: true,
            reportId: cached.id,
            factCheck: cachedResult,
            processingTime: Date.now() - startTime,
            cached: true,
          });
        } catch {
          // corrupt cache entry — fall through to a fresh check
        }
      }
    }

    // Step 1a: Match against recurring hoax narratives before any network call.
    // A re-worded known hoax is answerable offline and in milliseconds.
    const hoaxMatches = await matchKnownHoaxes(normalizedClaim);
    for (const m of hoaxMatches) await recordHoaxHit(m.id);

    // Step 1b: Search for existing fact-checks using web search
    const searchResults = await webSearchFactCheck(normalizedClaim, 10).catch(() => []);

    // Step 2: Use LLM to analyze the claim and search results
    const systemPrompt = `You are an expert fact-checker and media verification specialist. You verify claims by cross-referencing with known fact-checking sources and applying rigorous analytical reasoning. You specialize in:

- Evaluating claims against known fact-checks from reputable sources
- Identifying logical fallacies and unsupported assertions
- Assessing the credibility and reliability of claims
- Distinguishing between true, false, misleading, and unverified claims
- Recognizing cherry-picked data and out-of-context information
- Providing evidence-based reasoning for verdicts

You MUST respond in strict JSON format with the following structure:
{
  "verdict": "<true|false|misleading|unverified|partially_true>",
  "confidence": <number 0-1, how confident you are in this verdict>,
  "explanation": "<detailed explanation of the fact-check reasoning>",
  "claimAnalysis": {
    "claimType": "<factual|opinion|statistical|anecdotal|prediction>",
    "verifiability": "<easily_verifiable|partially_verifiable|difficult_to_verify|subjective>",
    "logicalFallacies": [<list of any logical fallacies detected>],
    "keyEntities": [<list of key people, organizations, events mentioned>]
  },
  "reasoning": "<step-by-step reasoning for the verdict>",
  "sourceStances": [<for each numbered search result provided, an object {"index": <1-based result number>, "stance": "<supports|refutes|mixed|unrelated>"} describing whether that source supports or refutes the claim>]
}

IMPORTANT: Respond ONLY with valid JSON. No additional text or explanation outside the JSON.`;

    const searchContext = searchResults.length > 0
      ? `\n\nSearch results from fact-checking sources:\n${searchResults.map((r, i) => `${i + 1}. ${r.title || 'Untitled'} - ${r.snippet || 'No snippet'} (${r.url || 'No URL'})`).join('\n')}`
      : '\n\nNo relevant fact-check search results were found.';

    const userPrompt = language
      ? `Verify the following claim (language: ${language}):\n\n"${normalizedClaim}"${searchContext}`
      : `Verify the following claim:\n\n"${normalizedClaim}"${searchContext}`;

    // In-house stance pass over every snippet. Runs regardless of the model so
    // the per-source stances have a second, inspectable opinion behind them.
    const localStances = searchResults
      .slice(0, 10)
      .map((r) => detectStance(normalizedClaim, `${r.title ?? ''} ${r.snippet ?? ''}`.trim()));
    const stanceRollup = rollupStances(localStances);

    let analysisResult: Record<string, unknown>;
    let degraded = false;
    try {
      analysisResult = await structuredLLMAnalysis(systemPrompt, userPrompt);
    } catch (llmError) {
      degraded = true;
      console.warn('LLM unavailable, deriving verdict from stance + hoax registry:', llmError);
      const strongHoax = hoaxMatches.find((m) => m.similarity >= 45);
      const hint = stanceRollup.verdictHint;
      const derivedVerdict = strongHoax
        ? 'false'
        : hint === 'likely_false' ? 'false'
          : hint === 'likely_true' ? 'true'
            : hint === 'disputed' ? 'misleading'
              : 'unverified';
      analysisResult = {
        verdict: derivedVerdict,
        confidence: strongHoax ? 0.7 : stanceRollup.support + stanceRollup.refute > 0 ? 0.5 : 0.3,
        explanation: strongHoax
          ? `This claim matches a recurring hoax narrative already in the registry ("${strongHoax.title}", ${strongHoax.similarity}% similar). Language model unavailable, so no claim-level reasoning was performed.`
          : `Verdict derived from in-house stance detection over ${localStances.length} search result(s): ${stanceRollup.refute} refuting, ${stanceRollup.support} supporting. Language model unavailable.`,
        reasoning: 'Degraded mode: stance detection and hoax matching only, no model reasoning.',
        sourceStances: localStances.map((s, i) => ({
          index: i + 1,
          stance: s.stance === 'support' ? 'supports' : s.stance === 'refute' ? 'refutes' : s.stance === 'neutral' ? 'mixed' : 'unrelated',
        })),
      };
    }

    // Per-source stance map from the LLM (1-based index → stance)
    const stanceMap = new Map<number, FactCheckSource['stance']>();
    const validStances = new Set(['supports', 'refutes', 'mixed', 'unrelated']);
    if (Array.isArray(analysisResult.sourceStances)) {
      for (const entry of analysisResult.sourceStances as Array<Record<string, unknown>>) {
        if (
          entry && typeof entry.index === 'number' &&
          typeof entry.stance === 'string' && validStances.has(entry.stance)
        ) {
          stanceMap.set(entry.index, entry.stance as FactCheckSource['stance']);
        }
      }
    }

    // Build structured sources with stance + static domain credibility
    const sources: FactCheckSource[] = searchResults.slice(0, 10).map((r, i) => {
      let name = r.title || '';
      if (!name && r.url) {
        try {
          name = new URL(r.url).hostname.replace(/^www\./, '');
        } catch {
          name = 'External Source';
        }
      }
      if (!name) name = 'External Source';
      const cred = getDomainCredibility(r.url || '');
      const local = localStances[i];
      // Fall back to the in-house stance when the model did not label this result.
      const localAsSource: FactCheckSource['stance'] =
        local?.stance === 'support' ? 'supports'
          : local?.stance === 'refute' ? 'refutes'
            : local?.stance === 'neutral' ? 'mixed'
              : 'unrelated';
      return {
        name,
        url: r.url || '',
        snippet: r.snippet || '',
        stance: stanceMap.get(i + 1) ?? localAsSource,
        credibility: cred.rating,
        type: cred.type,
        localStance: local,
        similarity: local ? Math.round(local.relatedness * 100) : undefined,
      };
    });

    // Ensure proper verdict
    const validVerdicts = ['true', 'false', 'misleading', 'unverified', 'partially_true'];
    const verdict = validVerdicts.includes(analysisResult.verdict as string)
      ? analysisResult.verdict
      : 'unverified';

    const claimAnalysisRaw = analysisResult.claimAnalysis;
    const claimAnalysis = claimAnalysisRaw && typeof claimAnalysisRaw === 'object'
      ? claimAnalysisRaw as FactCheckResult['claimAnalysis']
      : undefined;

    const result: FactCheckResult = {
      verdict: verdict as FactCheckResult['verdict'],
      confidence: typeof analysisResult.confidence === 'number'
        ? Math.max(0, Math.min(1, analysisResult.confidence))
        : 0.5,
      sources,
      explanation: typeof analysisResult.explanation === 'string'
        ? analysisResult.explanation
        : 'Fact-check analysis completed',
      reasoning: typeof analysisResult.reasoning === 'string'
        ? analysisResult.reasoning
        : undefined,
      claimAnalysis,
      stanceRollup,
      knownHoaxMatches: hoaxMatches.map((m) => ({
        id: m.id,
        title: m.title,
        narrative: m.narrative,
        category: m.category,
        verdict: m.verdict,
        similarity: m.similarity,
        matchType: m.matchType,
        debunkUrl: m.debunkUrl,
        debunkSource: m.debunkSource,
        hitCount: m.hitCount,
      })),
      degraded,
    };

    const processingTime = Date.now() - startTime;

    // Persist: MediaUpload → AnalysisReport → batched FactCheckMatch rows
    const mediaUpload = await db.mediaUpload.create({
      data: {
        fileName: `factcheck-${Date.now()}.txt`,
        fileType: 'text',
        mimeType: 'text/plain',
        fileSize: new TextEncoder().encode(normalizedClaim).length,
        metadata: JSON.stringify({ language: language || 'auto', claim: normalizedClaim }),
        status: 'completed',
      },
    });

    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: mediaUpload.id,
        analysisType: 'fact_check',
        status: 'completed',
        results: JSON.stringify(result),
        trustScore: verdict === 'true' ? 90 : verdict === 'partially_true' ? 60 : verdict === 'misleading' ? 30 : verdict === 'false' ? 10 : 50,
        riskLevel: verdict === 'false' ? 'critical' : verdict === 'misleading' ? 'high' : verdict === 'unverified' ? 'medium' : 'low',
        aiModel: degraded ? 'in-house:stance+hoax-registry' : getModelLabelSafe(),
        processingTime,
        explanation: result.explanation,
        confidence: result.confidence,
        flags: JSON.stringify([verdict]),
        recommendations: JSON.stringify(sources.map(s => `Check source: ${s.name}`)),
      },
    });

    const matchRows = sources
      .filter((s) => s.url)
      .map((s) => ({
        analysisReportId: report.id,
        source: determineSource(s.url),
        claim: normalizedClaim,
        verdict: verdict as string,
        confidence: result.confidence,
        url: s.url,
        snippet: s.snippet,
      }));
    if (matchRows.length > 0) {
      await db.factCheckMatch.createMany({ data: matchRows });
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      factCheck: result,
      processingTime,
    });
  } catch (error) {
    console.error('Fact-check error:', error);
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to perform fact-check',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      },
      { status: 500 }
    );
  }
}

/**
 * Determine the fact-checking source from a URL
 */
function determineSource(url: string): string {
  if (url.includes('pib.gov.in')) return 'pib';
  if (url.includes('altnews.in')) return 'altnews';
  if (url.includes('boomlive.in')) return 'boomlive';
  if (url.includes('factly.in')) return 'factly';
  if (url.includes('snopes.com')) return 'snopes';
  if (url.includes('politifact.com')) return 'politifact';
  if (url.includes('factcheck.org')) return 'factcheck_org';
  if (url.includes('google.com') && url.includes('factcheck')) return 'google_fact_check';
  if (url.includes('reuters.com')) return 'reuters';
  if (url.includes('apnews.com')) return 'apnews';
  if (url.includes('bbc.com')) return 'bbc';
  if (url.includes('fullfact.org')) return 'fullfact';
  return 'other';
}
