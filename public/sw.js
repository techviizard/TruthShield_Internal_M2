/**
 * TruthShield service worker (security-hardened).
 *
 * The previous version cached dashboard pages and API responses and served them
 * when the network failed - so a signed-out user (or one whose server was
 * stopped) could still open the console and read old data. This version caches
 * ONLY public, non-sensitive static files:
 *
 *   /_next/static/* and /icons/*  -> stale-while-revalidate (content-hashed files)
 *   /offline                      -> shown when a page cannot be reached
 *   pages and /api/*              -> NEVER cached, always straight to the network
 *
 * Bumping VERSION makes the activate step delete every cache written by older
 * versions (including the ones that held pages and API data).
 */
const VERSION = 'truthshield-v3'
const SHELL_CACHE = `${VERSION}-shell`

const SHELL_ASSETS = ['/offline', '/logo.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
  if (event.data === 'clear-caches') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
  }
})

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

function isDocument(request) {
  return request.mode === 'navigate' || request.destination === 'document'
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res })
    .catch(() => null)
  if (cached) return cached
  return (await network) || new Response('', { status: 504 })
}

async function documentNetworkOnly(request) {
  try {
    return await fetch(request) // never stored
  } catch {
    const offline = await (await caches.open(SHELL_CACHE)).match('/offline')
    return offline || new Response('Offline', { status: 503 })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // API traffic is never touched or cached

  if (isDocument(request)) event.respondWith(documentNetworkOnly(request))
  else if (isImmutableAsset(url)) event.respondWith(staleWhileRevalidate(request))
})
