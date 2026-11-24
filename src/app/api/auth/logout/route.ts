import { NextRequest, NextResponse } from 'next/server'
import { revokeSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session'

export async function POST(request: NextRequest) {
  // 1. Kill the session on the server: a copied cookie stops working immediately.
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) revokeSessionToken(token)

  // 2. Remove the cookie from this browser.
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(0), expires: new Date(0) })

  // 3. Ask the browser to drop cached pages/data so Back / a new tab cannot show them.
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('Clear-Site-Data', '"cache"')
  return response
}
