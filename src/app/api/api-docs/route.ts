import { NextResponse } from 'next/server'
import { listRoutes } from '@/lib/engines/api-introspect'

export async function GET() {
  try {
    const routes = await listRoutes()
    return NextResponse.json({ success: true, routes, count: routes.length, generatedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
