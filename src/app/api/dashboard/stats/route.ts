import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';
import { getTrustHistogram, getLanguageDistribution } from '@/lib/engines/dashboard-aggregator';

/**
 * GET /api/dashboard/stats
 *
 * Single aggregation endpoint for the dashboard. Everything here is computed
 * from the database - counts, trends, risk mix, recent activity, top threats,
 * trust histogram, detection timeline and language mix. No placeholder values.
 * Shapes match the `DashboardStats` UI type consumed by the Zustand store.
 */

const TYPE_LABEL: Record<string, string> = {
  text_fake_news: 'Text',
  image_forensics: 'Image',
  video_deepfake: 'Video',
  fact_check: 'Fact Check',
  audio_deepfake: 'Audio',
};

const UI_TYPE: Record<string, string> = {
  text_fake_news: 'text',
  image_forensics: 'image',
  video_deepfake: 'video',
  fact_check: 'factcheck',
  audio_deepfake: 'audio',
};

const ACTION_LABEL: Record<string, string> = {
  text_fake_news: 'Text analysis completed',
  image_forensics: 'Image forensics completed',
  video_deepfake: 'Video deepfake scan completed',
  fact_check: 'Fact check completed',
  audio_deepfake: 'Audio deepfake scan completed',
};

const THREAT_LABEL: Record<string, string> = {
  text_fake_news: 'fake_news',
  image_forensics: 'manipulation',
  video_deepfake: 'deepfake',
  fact_check: 'disputed_claim',
  audio_deepfake: 'voice_clone',
};

const TIMELINE_TYPE: Record<string, string> = {
  text_fake_news: 'fake_news',
  image_forensics: 'manipulation',
  video_deepfake: 'deepfake',
  fact_check: 'verified',
  audio_deepfake: 'deepfake',
};

/** Local calendar-day key (YYYY-MM-DD) - avoids UTC/local drift near midnight. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function relativeTime(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

/** First sentence of the model explanation - the human-readable detection summary. */
function summarize(explanation: string | null, fallback: string): string {
  if (!explanation) return fallback;
  const sentence = explanation.split(/(?<=[.!?])\s/)[0]?.trim();
  return sentence && sentence.length > 8 ? sentence : fallback;
}

export async function GET() {
  try {
    const { trendDays, recentActivityLimit, topThreatsLimit } = appConfig.dashboard;

    const [
      totalAnalyses,
      fakeNewsDetected,
      deepfakesDetected,
      imagesAnalyzed,
      factChecksRun,
      activeAlerts,
      openInvestigations,
      recentReports,
      trustAgg,
      riskCounts,
      typeCounts,
    ] = await Promise.all([
      db.analysisReport.count(),
      db.analysisReport.count({
        where: { analysisType: 'text_fake_news', riskLevel: { in: ['high', 'critical'] } },
      }),
      db.analysisReport.count({
        where: { analysisType: 'video_deepfake', riskLevel: { in: ['high', 'critical'] } },
      }),
      db.analysisReport.count({ where: { analysisType: 'image_forensics' } }),
      db.analysisReport.count({ where: { analysisType: 'fact_check' } }),
      db.alert.count({ where: { isRead: false } }),
      db.investigation.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      db.analysisReport.findMany({
        take: Math.max(recentActivityLimit, topThreatsLimit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          analysisType: true,
          trustScore: true,
          riskLevel: true,
          status: true,
          confidence: true,
          explanation: true,
          createdAt: true,
          mediaUpload: { select: { fileName: true, fileType: true } },
        },
      }),
      db.analysisReport.aggregate({ _avg: { trustScore: true }, where: { trustScore: { not: null } } }),
      db.analysisReport.groupBy({ by: ['riskLevel'], _count: { _all: true } }),
      db.analysisReport.groupBy({ by: ['analysisType'], _count: { _all: true } }),
    ]);

    const avgTrustScore = trustAgg._avg.trustScore || 0;

    // ── Trend series: analyses vs threats per day ──────────────────────────
    const since = new Date();
    since.setDate(since.getDate() - (trendDays - 1));
    since.setHours(0, 0, 0, 0);

    const trendRows = await db.analysisReport.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, analysisType: true, riskLevel: true, trustScore: true },
    });

    const trendData: Array<{ date: string; analyses: number; threats: number }> = [];
    const trendDetail: Array<{
      date: string;
      total: number;
      textAnalysis: number;
      imageAnalysis: number;
      videoAnalysis: number;
      factChecks: number;
    }> = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = dayKey(day);
      const rows = trendRows.filter((r) => dayKey(r.createdAt) === key);
      const threats = rows.filter(
        (r) =>
          r.riskLevel === 'high' ||
          r.riskLevel === 'critical' ||
          (r.trustScore ?? 100) <= appConfig.analysis.threatTrustThreshold,
      ).length;

      trendData.push({
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        analyses: rows.length,
        threats,
      });
      trendDetail.push({
        date: key,
        total: rows.length,
        textAnalysis: rows.filter((r) => r.analysisType === 'text_fake_news').length,
        imageAnalysis: rows.filter((r) => r.analysisType === 'image_forensics').length,
        videoAnalysis: rows.filter((r) => r.analysisType === 'video_deepfake').length,
        factChecks: rows.filter((r) => r.analysisType === 'fact_check').length,
      });
    }

    // ── Distributions ─────────────────────────────────────────────────────
    const countByRisk = (level: string) =>
      riskCounts.find((r) => r.riskLevel === level)?._count._all ?? 0;

    const riskDistribution = [
      { level: 'Critical', count: countByRisk('critical'), color: '#ef4444' },
      { level: 'High', count: countByRisk('high'), color: '#f97316' },
      { level: 'Medium', count: countByRisk('medium'), color: '#eab308' },
      { level: 'Low', count: countByRisk('low'), color: '#22c55e' },
    ];

    const analysisByType = typeCounts
      .map((t) => ({ type: TYPE_LABEL[t.analysisType] ?? t.analysisType, count: t._count._all }))
      .sort((a, b) => b.count - a.count);

    const typeDistribution = Object.fromEntries(
      typeCounts.map((t) => [t.analysisType, t._count._all]),
    );

    // ── Recent activity + detection timeline (same source rows) ───────────
    const recentActivity = recentReports.slice(0, recentActivityLimit).map((r) => ({
      id: r.id,
      action: summarize(
        r.explanation,
        `${ACTION_LABEL[r.analysisType] ?? 'Analysis completed'}${r.mediaUpload?.fileName ? ` - ${r.mediaUpload.fileName}` : ''}`,
      ),
      timestamp: relativeTime(r.createdAt),
      type: UI_TYPE[r.analysisType] ?? 'system',
      risk: (r.riskLevel ?? 'low') as 'low' | 'medium' | 'high' | 'critical',
    }));

    const detectionTimeline = recentReports.slice(0, recentActivityLimit).map((r) => ({
      time: r.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      type: r.riskLevel === 'low' ? 'verified' : TIMELINE_TYPE[r.analysisType] ?? 'fake_news',
      confidence: Math.round((r.confidence ?? 0) * 100),
      desc: summarize(r.explanation, ACTION_LABEL[r.analysisType] ?? 'Analysis completed'),
    }));

    // ── Top threats: most recent high/critical findings ───────────────────
    const threatRows = await db.analysisReport.findMany({
      where: { riskLevel: { in: ['high', 'critical'] } },
      orderBy: [{ createdAt: 'desc' }],
      take: topThreatsLimit,
      select: {
        analysisType: true,
        riskLevel: true,
        explanation: true,
        createdAt: true,
        mediaUpload: { select: { fileName: true } },
      },
    });

    const topThreats = threatRows.map((r) => ({
      title: summarize(
        r.explanation,
        `${TYPE_LABEL[r.analysisType] ?? r.analysisType} threat - ${r.mediaUpload?.fileName ?? 'unknown source'}`,
      ),
      type: THREAT_LABEL[r.analysisType] ?? r.analysisType,
      risk: (r.riskLevel ?? 'high') as 'low' | 'medium' | 'high' | 'critical',
      timestamp: relativeTime(r.createdAt),
    }));

    const [trustScoreDistribution, languages] = await Promise.all([
      getTrustHistogram(),
      getLanguageDistribution(),
    ]);

    // Persist the rollup so the DashboardStats table mirrors live values.
    const rollup = {
      totalAnalyses,
      fakeNewsDetected,
      deepfakesDetected,
      imagesAnalyzed,
      factChecksRun,
      activeAlerts,
      openInvestigations,
      avgTrustScore,
    };
    const existingStats = await db.dashboardStats.findFirst();
    if (existingStats) {
      await db.dashboardStats.update({ where: { id: existingStats.id }, data: rollup });
    } else {
      await db.dashboardStats.create({ data: rollup });
    }

    const recentAlerts = await db.alert.findMany({
      take: topThreatsLimit,
      orderBy: { createdAt: 'desc' },
      where: { isRead: false },
    });

    return NextResponse.json({
      success: true,
      stats: { ...rollup, avgTrustScore: Math.round(avgTrustScore * 100) / 100 },
      trendData,
      trendDetail,
      riskDistribution,
      analysisByType,
      typeDistribution,
      recentActivity,
      detectionTimeline,
      topThreats,
      trustScoreDistribution,
      languages,
      recentAlerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get dashboard stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
