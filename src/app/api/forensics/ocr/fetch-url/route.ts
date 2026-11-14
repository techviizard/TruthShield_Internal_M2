import { NextRequest, NextResponse } from 'next/server'
import dns from 'node:dns/promises'
import net from 'node:net'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/tiff']
const MAX_BYTES = 10 * 1024 * 1024

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') ||
    v.startsWith('fe80') || v.startsWith('::ffff:')
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    let u: URL
    try { u = new URL(String(url)) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    if (!['http:', 'https:'].includes(u.protocol)) {
      return NextResponse.json({ error: 'Only http and https links are allowed' }, { status: 400 })
    }
    const addrs = await dns.lookup(u.hostname, { all: true })
    if (addrs.some((a) => isPrivateIp(a.address))) {
      return NextResponse.json({ error: 'This address is not allowed' }, { status: 400 })
    }
    const res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not download the image' }, { status: 502 })
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ error: 'URL is not a PNG, JPG, WebP or TIFF image' }, { status: 415 })
    }
    const reader = res.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'Empty response' }, { status: 502 })
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) {
        await reader.cancel()
        return NextResponse.json({ error: 'Image is larger than 10 MB' }, { status: 413 })
      }
      chunks.push(value)
    }
    return new NextResponse(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': type } })
  } catch {
    return NextResponse.json({ error: 'Could not load this URL' }, { status: 502 })
  }
}