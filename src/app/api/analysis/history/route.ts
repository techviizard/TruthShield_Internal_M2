import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const riskLevel = searchParams.get('riskLevel');
    const search = searchParams.get('search');
    const unattachedOnly = searchParams.get('unattachedOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(
      searchParams.get('limit') || String(appConfig.limits.historyPageSize),
      10
    );
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.analysisType = type;
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    if (unattachedOnly) {
      where.investigationId = null;
    }

    if (search) {
      where.OR = [
        { explanation: { contains: search } },
        { mediaUpload: { fileName: { contains: search } } },
        { analysisType: { contains: search } },
      ];
    }

    // Build order by
    const orderBy: Record<string, string> = {};
    if (sortBy === 'trustScore') {
      orderBy.trustScore = sortOrder === 'asc' ? 'asc' : 'desc';
    } else if (sortBy === 'riskLevel') {
      orderBy.riskLevel = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = sortOrder === 'asc' ? 'asc' : 'desc';
    }

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      db.analysisReport.findMany({
        where,
        include: {
          mediaUpload: {
            select: {
              fileName: true,
              fileType: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.analysisReport.count({ where }),
    ]);

    const items = reports.map((report) => ({
      id: report.id,
      investigationId: report.investigationId,
      createdAt: report.createdAt.toISOString(),
      analysisType: report.analysisType,
      trustScore: report.trustScore,
      riskLevel: report.riskLevel,
      status: report.status,
      explanation: report.explanation,
      mediaFileName: report.mediaUpload.fileName,
      mediaFileType: report.mediaUpload.fileType,
      results: report.results,
      flags: report.flags,
      recommendations: report.recommendations,
      confidence: report.confidence,
      processingTime: report.processingTime,
    }));

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis history' },
      { status: 500 }
    );
  }
}
