/**
 * TruthShield service worker.
 *
 * Field deployments in low-connectivity areas need the console to open and stay
 * usable without a network. Strategy per request class:
 *
 *   hashed build assets → stale-while-revalidate (instant open, updates in background).
 *                         Safe cache-first because the URL changes when the file does.
 *   documents / RSC     → network-first with a cache fallback. NEVER cache-first: a
 *                         cached document references build-hashed chunk URLs that no
 *                         longer exist after a redeploy, which renders a blank page.
 *   API GET             → network-first with a cache fallback, so a dropped link
 *                         shows the last known data instead of an error page
 *   API POST            → never cached; the page queues these itself in IndexedDB
 *                         (see use-offline-queue.ts) because a POST body cannot be
 *                         meaningfully replayed from here without the app's context
 *
 * Analyses submitted offline are queued in the page, not here, so the user can
 * see and manage the queue rather than have work replay invisibly.
 */

const VERSION = 'truthshield-v2'
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

/**
 * Only content-hashed assets may be served cache-first. Everything else can go
 * stale against a newer build, and a stale document is a blank page.
 */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

/** Documents and React Server Component payloads - both are build-coupled. */
function isDocument(request, url) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.headers.get('RSC') === '1' ||
    url.searchParams.has('_rsc') ||
    (request.headers.get('Accept') || '').includes('text/html')
  )
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

/**
 * Documents always try the network first, so a new deployment is picked up on the
 * first load instead of replaying a document that points at deleted chunks. The
 * cached copy is only a fallback for a genuinely failed request.
 */
async function documentNetworkFirst(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok && request.mode === 'navigate') cache.put(request, fresh.clone())
    return fresh
  } catch {
    const cached = (await cache.match(request)) ?? (await cache.match('/'))
    if (cached) return cached
    return (await cache.match('/offline')) ?? new Response('Offline', { status: 503 })
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
  return new Response('', { status: 504 })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // POSTs are queued by the page, not here

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (isApi(url)) {
    event.respondWith(networkFirst(request))
  } else if (isDocument(request, url)) {
    event.respondWith(documentNetworkFirst(request))
  } else if (isImmutableAsset(url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
  // Anything else falls through to the network untouched.
})
