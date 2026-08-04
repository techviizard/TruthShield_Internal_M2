'use client'

import { useEffect, useState } from 'react'
import type { PublicConfig } from '@/config/app.config'

/**
 * Client access to the secret-free central configuration (`GET /api/config`).
 *
 * Fetched once per page load and cached in module scope, so upload limits,
 * feature flags and provider info shown in the UI always match what the server
 * actually enforces - no duplicated constants in components.
 */
let cache: PublicConfig | null = null
let inflight: Promise<PublicConfig | null> | null = null

async function load(): Promise<PublicConfig | null> {
  if (cache) return cache
  if (!inflight) {
    inflight = fetch('/api/config')
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) cache = j.config as PublicConfig
        return cache
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useAppConfig(): PublicConfig | null {
  const [cfg, setCfg] = useState<PublicConfig | null>(cache)

  useEffect(() => {
    if (cache) return
    let aborted = false
    void load().then((c) => {
      if (!aborted && c) setCfg(c)
    })
    return () => {
      aborted = true
    }
  }, [])

  return cfg
}
