'use client'

import { useEffect } from 'react'

const CHANNEL = 'truthshield-auth'

function goToLogin() {
  if (window.location.pathname !== '/login') window.location.replace('/login')
}

async function clearClientCaches() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('truthshield-')).map((k) => caches.delete(k)))
    }
  } catch { /* nothing to clear */ }
}

/** Full sign-out: server session + cookie + browser caches + every other open tab. */
export async function signOut() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
  } catch { /* server unreachable: still leave this page */ }
  await clearClientCaches()
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage('logout')
    channel.close()
  } catch { /* BroadcastChannel unsupported */ }
  window.location.replace('/login') // full reload: no leftover page state
}

/**
 * Mount once on the dashboard. Sends the user to /login as soon as the session
 * is gone, whatever the reason (signed out in another tab, server restarted,
 * session expired, Back button).
 */
export function AuthGuard() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    // 1. Any 401 from our API means "not signed in".
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args)
      if (response.status === 401) {
        try {
          const input = args[0]
          const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          const path = new URL(raw, window.location.origin).pathname
          if (path.startsWith('/api/') && path !== '/api/auth/login') goToLogin()
        } catch { /* ignore unparsable URLs */ }
      }
      return response
    }

    // 2. Signed out in another tab.
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = (event) => { if (event.data === 'logout') goToLogin() }
    } catch { /* unsupported */ }

    // 3. Re-check when the tab is shown again, restored by Back, and every 30 s.
    const verify = () => {
      originalFetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => { if (r.status === 401) goToLogin() })
        .catch(() => { /* offline: nothing to decide */ })
    }
    const onVisible = () => { if (document.visibilityState === 'visible') verify() }
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) verify() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    const timer = window.setInterval(onVisible, 30_000)
    verify()

    return () => {
      window.fetch = originalFetch
      channel?.close()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.clearInterval(timer)
    }
  }, [])

  return null
}
