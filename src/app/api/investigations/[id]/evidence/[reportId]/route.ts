import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type RouteContext = { params: Promise<{ id: string; reportId: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, reportId } = await params
    const investigation = await db.investigation.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!investigation) {
      return NextResponse.json({ error: 'Investigation not found' }, { status: 404 })
    }

    const report = await db.analysisReport.findUnique({
      where: { id: reportId },
      select: { id: true, investigationId: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'Analysis report not found' }, { status: 404 })
    }
    if (report.investigationId && report.investigationId !== id) {
      return NextResponse.json(
        { error: 'Analysis report is already attached to another investigation' },
        { status: 409 }
      )
    }

    if (report.investigationId !== id) {
      const attached = await db.analysisReport.updateMany({
        where: { id: reportId, investigationId: null },
        data: { investigationId: id },
      })
      if (attached.count === 0) {
        const latest = await db.analysisReport.findUnique({
          where: { id: reportId },
          select: { investigationId: true },
        })
        if (latest?.investigationId !== id) {
          return NextResponse.json(
            { error: 'Analysis report is already attached to another investigation' },
            { status: 409 }
          )
        }
      }
    }

    return NextResponse.json({ success: true, data: { reportId, investigationId: id } })
  } catch (error) {
    console.error('Attach evidence error:', error)
    return NextResponse.json({ error: 'Failed to attach evidence' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, reportId } = await params
    const investigation = await db.investigation.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!investigation) {
      return NextResponse.json({ error: 'Investigation not found' }, { status: 404 })
    }

    const report = await db.analysisReport.findUnique({
      where: { id: reportId },
      select: { id: true, investigationId: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'Analysis report not found' }, { status: 404 })
    }
    if (report.investigationId !== id) {
      return NextResponse.json(
        { error: 'Analysis report is not linked to this investigation' },
        { status: 409 }
      )
    }

    const detached = await db.analysisReport.updateMany({
      where: { id: reportId, investigationId: id },
      data: { investigationId: null },
    })
    if (detached.count === 0) {
      return NextResponse.json(
        { error: 'Analysis report is not linked to this investigation' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data: { reportId, investigationId: null } })
  } catch (error) {
    console.error('Detach evidence error:', error)
    return NextResponse.json({ error: 'Failed to detach evidence' }, { status: 500 })
  }
}
