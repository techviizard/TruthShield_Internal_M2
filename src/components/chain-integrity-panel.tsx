'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ShieldAlert, Link2, Loader2, Fingerprint, Copy, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface ChainBreak {
  id: string
  seq: number
  reason: 'hash_mismatch' | 'link_mismatch' | 'unhashed' | 'sequence_gap'
  expected?: string
  actual?: string
  createdAt: string
  action: string
  resource: string
}

interface ChainState {
  valid: boolean
  totalEntries: number
  verifiedEntries: number
  breaks: ChainBreak[]
  headHash: string | null
  checkedAt: string
}

const REASON_LABEL: Record<ChainBreak['reason'], string> = {
  hash_mismatch: 'Record content altered after it was written',
  link_mismatch: 'Predecessor link does not match',
  unhashed: 'Record written outside the chain',
  sequence_gap: 'Record missing from the sequence',
}

function HashChip({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }, [value])

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      title={value ?? undefined}
      className="group flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/70 disabled:cursor-default disabled:opacity-60"
    >
      <Fingerprint className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">
        {value ? `${value.slice(0, 10)}…${value.slice(-6)}` : ' - '}
      </span>
      {value && (copied
        ? <Check className="h-3 w-3 text-emerald-500" />
        : <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />)}
    </button>
  )
}

/**
 * Tamper-evidence panel for the audit hash chain.
 * "Verify" replays every entry server-side and reports the first divergence - 
 * the check an officer runs before a record is relied on in a case file.
 */
export function ChainIntegrityPanel() {
  const [state, setState] = useState<ChainState | null>(null)
  const [head, setHead] = useState<{ seq: number; hash: string | null; at: string | null } | null>(null)
  // Mounts busy: the first verification is kicked off by an effect immediately.
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (record: boolean, initial = false) => {
    // On the first (effect-driven) run the component already renders busy, so
    // no state is set before the first await - which keeps the effect free of
    // synchronous cascading renders.
    if (!initial) {
      setBusy(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/audit/verify', { method: record ? 'POST' : 'GET' })
      const j = await res.json()
      if (!j?.success) throw new Error(j?.error ?? 'Verification failed')
      setState(j.chain)
      setHead(j.head)
      if (record) {
        if (j.chain.valid) {
          toast.success('Chain intact', {
            description: `${j.chain.verifiedEntries} of ${j.chain.totalEntries} records verified.`,
          })
        } else {
          toast.error('Chain integrity failure', {
            description: `${j.chain.breaks.length} record(s) diverge from the recomputed chain.`,
          })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }, [])

  // `load(…, true)` sets no state before its first await, so this cannot cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(false, true) }, [load])

  const valid = state?.valid ?? true
  const tone = error
    ? { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-600 dark:text-amber-400' }
    : valid
      ? { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400' }
      : { border: 'border-red-500/40', bg: 'bg-red-500/5', text: 'text-red-600 dark:text-red-400' }

  return (
    <Card className={`${tone.border} ${tone.bg}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${valid && !error ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {valid && !error
                ? <ShieldCheck className={`h-5 w-5 ${tone.text}`} />
                : <ShieldAlert className={`h-5 w-5 ${tone.text}`} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Chain of Custody</h3>
                <Badge variant="outline" className={`${tone.text} border-current/30 text-[10px]`}>
                  {error ? 'UNKNOWN' : valid ? 'TAMPER-EVIDENT' : 'INTEGRITY FAILURE'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                Every audit record is hashed together with its predecessor. Editing or deleting any
                past record changes its hash and every hash that follows, so an alteration cannot be
                made silently.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => load(true)} disabled={busy} className="gap-1.5 shrink-0">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Verify chain
          </Button>
        </div>

        {error && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
        )}

        {state && !error && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Records', value: state.totalEntries },
                { label: 'Verified', value: state.verifiedEntries },
                { label: 'Breaks', value: state.breaks.length },
                { label: 'Head seq', value: head ? `#${head.seq}` : ' - ' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="text-lg font-semibold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <HashChip label="Head hash" value={head?.hash ?? state.headHash} />
              <div className="flex items-center rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Last checked&nbsp;
                <span className="font-medium text-foreground">
                  {new Date(state.checkedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {state.breaks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {state.breaks.slice(0, 6).map((b) => (
                    <div key={`${b.id}-${b.reason}`} className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                          #{b.seq} · {REASON_LABEL[b.reason]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {b.action} · {b.resource}
                      </div>
                      {b.expected && b.actual && (
                        <div className="mt-2 grid gap-1 font-mono text-[10px]">
                          <div className="truncate"><span className="text-muted-foreground">expected </span>{b.expected}</div>
                          <div className="truncate"><span className="text-muted-foreground">stored&nbsp;&nbsp;&nbsp;</span>{b.actual}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {state.breaks.length > 6 && (
                    <p className="text-xs text-muted-foreground">
                      +{state.breaks.length - 6} further break(s).
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </CardContent>
    </Card>
  )
}
