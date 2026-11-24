import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Runs before every page and API request (Node.js runtime, Next.js 16+).
 * DELETE the old middleware.ts / src/middleware.ts - this file replaces it.
 */
const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout'])

function noStore(response: NextResponse): NextResponse {
  // Stops the browser keeping (or re-showing via Back) any protected page or data.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const signedIn = token ? verifySessionToken(token) !== null : false

  if (PUBLIC_API.has(pathname)) return noStore(NextResponse.next())
  if (pathname === '/offline') return NextResponse.next() // static offline shell, no data

  if (pathname === '/login') {
    if (signedIn) {
      const home = request.nextUrl.clone()
      home.pathname = '/'
      home.search = ''
      return noStore(NextResponse.redirect(home))
    }
    return noStore(NextResponse.next())
  }

  if (signedIn) return noStore(NextResponse.next())

  // Not signed in (no cookie, bad cookie, logged out, or the server restarted).
  let response: NextResponse
  if (pathname.startsWith('/api/')) {
    response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  } else {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = ''
    login.searchParams.set('next', pathname)
    response = NextResponse.redirect(login)
  }
  if (token) response.cookies.delete(SESSION_COOKIE) // drop the dead cookie
  return noStore(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg|icons/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|webmanifest)$).*)'],
}
