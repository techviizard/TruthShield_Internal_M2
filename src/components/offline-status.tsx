'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff, Wifi, CloudUpload, Loader2, Check, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  listQueue, drainQueue, clearSynced, removeFromQueue, type QueuedAnalysis,
} from '@/lib/offline-queue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Subscribe to connectivity through the browser's own events rather than
 * mirroring `navigator.onLine` into state — no effect, no cascading render, and
 * the server snapshot is `true` so the markup matches on hydration.
 */
function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

/**
 * Connectivity indicator, install prompt, and the offline analysis queue.
 *
 * Registering the service worker here rather than in a layout effect keeps the
 * registration next to the UI that depends on it.
 */
export function OfflineStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  )
  const [queue, setQueue] = useState<QueuedAnalysis[]>([])
  const [syncing, setSyncing] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  const refresh = useCallback(async () => {
    try {
      setQueue(await listQueue())
    } catch {
      // IndexedDB unavailable (private mode / older browser) — the app still works online.
    }
  }, [])

  useEffect(() => {
    // `refresh` awaits IndexedDB before setting state, so no render cascades here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err)
      })
    }

    const goOnline = () => { void refresh() }
    const goOffline = () => {
      toast.warning('Offline', {
        description: 'Analyses will be scored on-device and queued for sync.',
      })
    }
    const onInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('beforeinstallprompt', onInstall)
    const poll = setInterval(refresh, 15000)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', onInstall)
      clearInterval(poll)
    }
  }, [refresh])

  const pending = queue.filter((q) => q.status === 'queued' || q.status === 'failed').length

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await drainQueue(() => void refresh())
      await refresh()
      if (res.synced > 0) {
        toast.success(`Synced ${res.synced} queued analysis${res.synced > 1 ? 'es' : ''}`, {
          description: res.remaining > 0 ? `${res.remaining} still pending.` : 'Queue is clear.',
        })
      } else if (res.failed > 0) {
        toast.error('Sync failed', { description: 'Items remain queued and can be retried.' })
      } else {
        toast.info('Nothing to sync')
      }
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  const install = useCallback(async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') toast.success('TruthShield installed for offline use')
    setInstallEvent(null)
  }, [installEvent])

  return (
    <div className="flex items-center gap-1.5">
      {installEvent && (
        <Button variant="outline" size="sm" onClick={install} className="hidden h-8 gap-1 text-xs sm:flex">
          <Download className="h-3 w-3" />
          Install
        </Button>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 gap-1.5 px-2 text-xs ${online ? '' : 'text-amber-600 dark:text-amber-400'}`}
            title={online ? 'Online' : 'Offline — analyses are scored on-device and queued'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={online ? 'on' : 'off'}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
              >
                {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              </motion.span>
            </AnimatePresence>
            <span className="hidden lg:inline">{online ? 'Online' : 'Offline'}</span>
            {pending > 0 && (
              <Badge variant="outline" className="ml-0.5 h-4 border-amber-500/40 px-1 text-[10px] text-amber-600 dark:text-amber-400">
                {pending}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-96 p-0">
          <div className="border-b p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {online ? 'Connected' : 'Working offline'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {online
                    ? 'Full pipeline available.'
                    : 'On-device pattern detection only — no model reasoning or web corroboration.'}
                </p>
              </div>
              <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={sync} disabled={syncing || !online || pending === 0}>
                {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                Sync {pending > 0 ? `(${pending})` : ''}
              </Button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {queue.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Nothing queued. Analyses submitted while offline appear here.
              </p>
            ) : (
              queue.map((q) => (
                <div key={q.id} className="flex items-start gap-2 border-b p-3 last:border-0">
                  <Badge
                    variant="outline"
                    className={`mt-0.5 text-[10px] ${
                      q.status === 'synced' ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : q.status === 'failed' ? 'border-red-500/30 text-red-600 dark:text-red-400'
                          : q.status === 'syncing' ? 'border-sky-500/30 text-sky-600 dark:text-sky-400'
                            : 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {q.status}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">
                      {q.payload.text ?? q.payload.claim ?? '(empty)'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      on-device trust {q.localVerdict.trustScore} · {q.localVerdict.riskLevel} ·{' '}
                      {new Date(q.createdAt).toLocaleTimeString()}
                    </p>
                    {q.error && <p className="text-[10px] text-red-600 dark:text-red-400">{q.error}</p>}
                  </div>
                  <Button
                    variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={async () => { await removeFromQueue(q.id); void refresh() }}
                    title="Remove from queue"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {queue.some((q) => q.status === 'synced') && (
            <div className="border-t p-2">
              <Button
                variant="ghost" size="sm" className="h-7 w-full gap-1 text-[11px]"
                onClick={async () => { const n = await clearSynced(); void refresh(); toast.info(`Cleared ${n} synced item(s)`) }}
              >
                <Check className="h-3 w-3" /> Clear synced
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
