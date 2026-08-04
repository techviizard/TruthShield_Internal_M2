import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appConfig } from '@/config/app.config';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';

/**
 * GET /api/alerts - List alerts with filtering
 * Query params: type, severity, isRead, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const isRead = searchParams.get('isRead');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(
      searchParams.get('limit') || String(appConfig.limits.alertsPageSize),
      10
    );

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (severity) {
      where.severity = severity;
    }

    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const [alerts, total] = await Promise.all([
      db.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.alert.count({ where }),
    ]);

    // Count unread alerts
    const unreadCount = await db.alert.count({
      where: { isRead: false },
    });

    return NextResponse.json({
      success: true,
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error('List alerts error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts - Create new alert
 * Body: { type, severity, title, message, source?, actionUrl? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, severity, title, message, source, actionUrl } = body;

    // Validation
    if (!type || typeof type !== 'string') {
      return NextResponse.json(
        { error: 'Alert type is required' },
        { status: 400 }
      );
    }

    const validTypes = ['threat', 'verification_complete', 'system', 'escalation'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const validSeverities = ['info', 'warning', 'error', 'critical'];
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    const alert = await db.alert.create({
      data: {
        type,
        severity: severity || 'info',
        title: title.trim(),
        message: message.trim(),
        source: source?.trim() || null,
        actionUrl: actionUrl?.trim() || null,
      },
    });

    // Chained audit write - never db.auditLog.create directly, that breaks the hash chain.
    await recordAudit({
      action: 'alert_triggered',
      resource: 'alert',
      ipAddress: clientIp(request),
      details: {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
      },
    });

    return NextResponse.json({
      success: true,
      data: alert,
    }, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create alert',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts - Mark alerts as read
 * Body: { alertIds?: string[], markAllRead?: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertIds, markAllRead } = body;

    if (markAllRead) {
      // Mark all alerts as read
      const result = await db.alert.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} alerts marked as read`,
        count: result.count,
      });
    }

    if (alertIds && Array.isArray(alertIds) && alertIds.length > 0) {
      // Mark specific alerts as read
      const result = await db.alert.updateMany({
        where: {
          id: { in: alertIds },
        },
        data: { isRead: true },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} alerts marked as read`,
        count: result.count,
      });
    }

    return NextResponse.json(
      { error: 'Provide either alertIds array or markAllRead boolean' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update alerts error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
