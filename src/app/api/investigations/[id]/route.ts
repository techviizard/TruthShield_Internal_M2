import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAudit, clientIp } from '@/lib/engines/audit-logger';

/**
 * GET /api/investigations/[id] - Get investigation details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const investigation = await db.investigation.findUnique({
      where: { id },
      include: {
        analyses: {
          include: {
            mediaUpload: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                mimeType: true,
                createdAt: true,
              },
            },
            factChecks: {
              select: {
                id: true,
                source: true,
                claim: true,
                verdict: true,
                confidence: true,
                url: true,
                snippet: true,
                matchedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!investigation) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: investigation,
    });
  } catch (error) {
    console.error('Get investigation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get investigation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/investigations/[id] - Update investigation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if investigation exists
    const existing = await db.investigation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title, description, status, priority, tags, assignedTo,
      caseNumber, firNumber, officerName, officerBadge, jurisdiction,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json(
          { error: 'Title must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (status !== undefined) {
      const validStatuses = ['open', 'in_progress', 'closed', 'archived'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.priority = priority;
    }

    if (tags !== undefined) {
      updateData.tags = tags ? JSON.stringify(tags) : null;
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo?.trim() || null;
    }

    // Law-enforcement case metadata — all optional, all free text.
    for (const [key, value] of Object.entries({
      caseNumber, firNumber, officerName, officerBadge, jurisdiction,
    })) {
      if (value !== undefined) {
        updateData[key] = typeof value === 'string' && value.trim() ? value.trim() : null;
      }
    }

    const investigation = await db.investigation.update({
      where: { id },
      data: updateData,
    });

    await recordAudit({
      action: 'investigation_updated',
      resource: 'investigation',
      ipAddress: clientIp(request),
      details: {
        investigationId: id,
        caseNumber: investigation.caseNumber,
        firNumber: investigation.firNumber,
        changes: Object.keys(updateData),
      },
    });

    return NextResponse.json({
      success: true,
      data: investigation,
    });
  } catch (error) {
    console.error('Update investigation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update investigation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/investigations/[id] - Delete investigation
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if investigation exists
    const existing = await db.investigation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      );
    }

    // Delete the investigation (cascades to analyses, but analyses have their own cascade from factchecks)
    // First, unlink any analysis reports
    await db.analysisReport.updateMany({
      where: { investigationId: id },
      data: { investigationId: null },
    });

    await db.investigation.delete({
      where: { id },
    });

    await recordAudit({
      action: 'investigation_deleted',
      resource: 'investigation',
      ipAddress: clientIp(_request),
      details: {
        investigationId: id,
        title: existing.title,
        caseNumber: existing.caseNumber,
        firNumber: existing.firNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Investigation deleted successfully',
    });
  } catch (error) {
    console.error('Delete investigation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete investigation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
