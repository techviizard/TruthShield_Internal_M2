import { NextResponse } from 'next/server'

// Protected by src/proxy.ts: it answers 401 unless the session is valid.
// The dashboard calls this to find out quickly that it has been signed out.
export async function GET() {
  return NextResponse.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export const dynamic = 'force-dynamic'
