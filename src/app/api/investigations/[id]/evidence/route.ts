import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: investigationId } = await params
    const body = await request.json()
    const analysisId = body.analysisId

    if (typeof analysisId !== 'string' || !analysisId.trim()) {
      return NextResponse.json(
        { error: 'analysisId is required' },
        { status: 400 }
      )
    }

    const investigation = await db.investigation.findUnique({
      where: { id: investigationId },
      select: { id: true },
    })

    if (!investigation) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      )
    }

    const analysis = await db.analysisReport.findUnique({
      where: { id: analysisId },
      select: { id: true, investigationId: true },
    })

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }

    if (analysis.investigationId && analysis.investigationId !== investigationId) {
      return NextResponse.json(
        { error: 'This analysis is already attached to another investigation' },
        { status: 409 }
      )
    }

    await db.analysisReport.update({
      where: { id: analysisId },
      data: { investigationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attach evidence error:', error)
    return NextResponse.json(
      { error: 'Failed to attach evidence' },
      { status: 500 }
    )
  }
}