/**
 * Simple rule engine for workflow automation.
 * Rules persist to DB; execute on POST /api/workflows/run.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rules = await db.workflowRule.findMany({
    orderBy: { createdAt: 'desc' },
    include: { executions: { take: 5, orderBy: { triggeredAt: 'desc' } } },
  })
  return NextResponse.json({ success: true, rules })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rule = await db.workflowRule.create({
      data: {
        name: body.name,
        description: body.description ?? '',
        triggerType: body.triggerType,
        conditions: JSON.stringify(body.conditions ?? {}),
        actions: JSON.stringify(body.actions ?? []),
        isActive: body.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, rule })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const rule = await db.workflowRule.update({
      where: { id: body.id },
      data: { isActive: body.isActive },
    })
    return NextResponse.json({ success: true, rule })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
