import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';

/**
 * GET /api/investigations - List all investigations with filtering
 * Query params: status, priority, search, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(
      searchParams.get('limit') || String(appConfig.limits.investigationsPageSize),
      10
    );

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { caseNumber: { contains: search } },
        { firNumber: { contains: search } },
      ];
    }

    const [investigations, total] = await Promise.all([
      db.investigation.findMany({
        where,
        include: {
          analyses: {
            select: {
              id: true,
              analysisType: true,
              status: true,
              trustScore: true,
              riskLevel: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.investigation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: investigations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List investigations error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list investigations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/investigations - Create new investigation
 * Body: { title, description?, status?, priority?, tags?, assignedTo? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title, description, status, priority, tags, assignedTo,
      caseNumber, firNumber, officerName, officerBadge, jurisdiction,
    } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['open', 'in_progress', 'closed', 'archived'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    const investigation = await db.investigation.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: status || 'open',
        priority: priority || 'medium',
        tags: tags ? JSON.stringify(tags) : null,
        assignedTo: assignedTo?.trim() || null,
        caseNumber: caseNumber?.trim() || null,
        firNumber: firNumber?.trim() || null,
        officerName: officerName?.trim() || null,
        officerBadge: officerBadge?.trim() || null,
        jurisdiction: jurisdiction?.trim() || null,
      },
    });

    await recordAudit({
      action: 'investigation_created',
      resource: 'investigation',
      ipAddress: clientIp(request),
      details: {
        investigationId: investigation.id,
        title: investigation.title,
        caseNumber: investigation.caseNumber,
        firNumber: investigation.firNumber,
        officerName: investigation.officerName,
      },
    });

    return NextResponse.json({
      success: true,
      data: investigation,
    }, { status: 201 });
  } catch (error) {
    console.error('Create investigation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create investigation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
