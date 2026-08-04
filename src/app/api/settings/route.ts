/**
 * User preferences persistence. Single-tenant default user "self".
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_USER = 'self'

export async function GET() {
  try {
    const prefs = await db.userPreferences.upsert({
      where: { userId: DEFAULT_USER },
      update: {},
      create: { userId: DEFAULT_USER },
    })
    return NextResponse.json({ success: true, preferences: prefs })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const prefs = await db.userPreferences.upsert({
      where: { userId: DEFAULT_USER },
      update: {
        theme: body.theme,
        analysisSensitivity: body.analysisSensitivity,
        notificationsEnabled: body.notificationsEnabled,
        defaultExportFormat: body.defaultExportFormat,
        language: body.language,
      },
      create: {
        userId: DEFAULT_USER,
        theme: body.theme ?? 'system',
        analysisSensitivity: body.analysisSensitivity ?? 75,
        notificationsEnabled: body.notificationsEnabled ?? true,
        defaultExportFormat: body.defaultExportFormat ?? 'json',
        language: body.language ?? 'en',
      },
    })
    return NextResponse.json({ success: true, preferences: prefs })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
