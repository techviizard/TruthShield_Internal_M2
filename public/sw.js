/**
 * TruthShield service worker.
 *
 * Field deployments in low-connectivity areas need the console to open and stay
 * usable without a network. Strategy per request class:
 *
 *   app shell / static  → stale-while-revalidate (instant open, updates in background)
 *   API GET             → network-first with a cache fallback, so a dropped link
 *                         shows the last known data instead of an error page
 *   API POST            → never cached; the page queues these itself in IndexedDB
 *                         (see use-offline-queue.ts) because a POST body cannot be
 *                         meaningfully replayed from here without the app's context
 *
 * Analyses submitted offline are queued in the page, not here, so the user can
 * see and manage the queue rather than have work replay invisibly.
 */

const VERSION = 'truthshield-v1'
const SHELL_CACHE = `${VERSION}-shell`
const DATA_CACHE = `${VERSION}-data`

const SHELL_ASSETS = [
  '/',
  '/offline',
  '/logo.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Individual failures must not abort the install; a missing optional asset
      // should not leave the app with no service worker at all.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

function isApi(url) {
  return url.pathname.startsWith('/api/')
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) {
      // Mark it so the UI can label stale data rather than presenting it as live.
      const headers = new Headers(cached.headers)
      headers.set('x-truthshield-cache', 'stale')
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      })
    }
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        error: 'Offline and no cached copy of this request is available.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)

  if (cached) return cached
  const fresh = await network
  if (fresh) return fresh

  // Navigations get the offline page; other misses simply fail.
  if (request.mode === 'navigate') {
    return (await cache.match('/offline')) ?? (await cache.match('/')) ??
      new Response('Offline', { status: 503 })
  }
  return new Response('', { status: 504 })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // POSTs are queued by the page, not here

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(isApi(url) ? networkFirst(request) : staleWhileRevalidate(request))
})
