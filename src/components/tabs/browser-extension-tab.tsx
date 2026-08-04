'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Puzzle, Download, Globe, Globe2, Monitor, Star, Shield, ScanSearch,
  CheckCircle, AlertTriangle, Sliders, Chrome,
  Info, Eye, EyeOff, Settings, Bell, HardDrive, Lock,
  Store, Cog, ShieldCheck, Zap, X, Plus, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

// ─── Animation helpers ──────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

// ─── Browser data ───────────────────────────────────────────────────
const browsers = [
  { name: 'Chrome', icon: Chrome, version: 'v88+', status: 'planned' as const, color: 'border-green-500/40 hover:border-green-500/70' },
  { name: 'Firefox', icon: Globe2, version: 'v78+', status: 'planned' as const, color: 'border-orange-500/40 hover:border-orange-500/70' },
  { name: 'Edge', icon: Globe, version: 'v88+', status: 'planned' as const, color: 'border-blue-500/40 hover:border-blue-500/70' },
  { name: 'Brave', icon: Monitor, version: 'v1.20+', status: 'planned' as const, color: 'border-amber-500/40 hover:border-amber-500/70' },
]

// ─── Features data ──────────────────────────────────────────────────
const features = [
  { title: 'Real-time Detection', desc: 'Scans media as you scroll', icon: ScanSearch, color: 'text-zinc-500' },
  { title: 'Fact Check Overlay', desc: 'One-click verification on any claim', icon: CheckCircle, color: 'text-zinc-500' },
  { title: 'Warning Badges', desc: 'Visual alerts on suspicious content', icon: AlertTriangle, color: 'text-amber-500' },
  { title: 'Privacy First', desc: 'All processing happens locally', icon: Shield, color: 'text-cyan-500' },
  { title: 'Multi-platform', desc: 'Works on Chrome, Firefox, Edge, Brave', icon: Monitor, color: 'text-violet-500' },
  { title: 'Custom Rules', desc: 'Set your own detection sensitivity', icon: Sliders, color: 'text-rose-500' },
]

// ─── Permissions data ───────────────────────────────────────────────
const permissions = [
  { title: 'Read and modify web pages', reason: 'Required to scan page content, media, and text for deepfake & misinformation indicators', icon: Eye, trust: 85 },
  { title: 'Access browser tabs', reason: 'Enables cross-tab detection to track coordinated misinformation campaigns', icon: Monitor, trust: 72 },
  { title: 'Local storage', reason: 'Saves your preferences, whitelists, and detection history locally on your device', icon: HardDrive, trust: 95 },
  { title: 'Notifications', reason: 'Alerts you when suspicious content is detected on the current page', icon: Bell, trust: 80 },
]

// ─── Whitelist data ─────────────────────────────────────────────────
const defaultWhitelist = [
  'wikipedia.org',
  'gov.in',
  'who.int',
  'reuters.com',
  'bbc.com',
]

// ─── Sub-components ─────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= Math.floor(rating)
              ? 'text-amber-400 fill-amber-400'
              : i - 0.5 <= rating
                ? 'text-amber-400 fill-amber-400/50'
                : 'text-muted-foreground/30'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating}</span>
    </div>
  )
}

function TrustGaugeMini({ value, size = 48 }: { value: number; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, value / 100))
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={4} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={color}>
        {value}
      </text>
    </svg>
  )
}

// ─── Main component ─────────────────────────────────────────────────

export function BrowserExtensionTab() {
  const [extensionEnabled, setExtensionEnabled] = useState(true)
  const [sensitivity, setSensitivity] = useState(75)
  const [autoScan, setAutoScan] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [extDarkMode, setExtDarkMode] = useState(false)
  const [whitelist, setWhitelist] = useState(defaultWhitelist)
  const [newSite, setNewSite] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  /** Packages `extension/` server-side and saves it via a temporary anchor. */
  const downloadExtension = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/download/extension')
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Server returned ${res.status}`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const named = /filename="([^"]+)"/.exec(disposition)?.[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = named ?? 'truthshield-extension.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Extension packaged', {
        description: 'Extract it, then load it unpacked from chrome://extensions.',
      })
      setShowInstall(true)
    } catch (e) {
      toast.error('Could not package the extension', {
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      setDownloading(false)
    }
  }

  const addToWhitelist = () => {
    const site = newSite.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (site && !whitelist.includes(site)) {
      setWhitelist((w) => [...w, site])
      setNewSite('')
      toast.success(`Added ${site} to whitelist`)
    }
  }
  const removeFromWhitelist = (site: string) => {
    setWhitelist((w) => w.filter((s) => s !== site))
    toast.success(`Removed ${site} from whitelist`)
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">

      {/* ── 1. Hero Section ──────────────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-zinc-500/10 via-zinc-500/5 to-cyan-500/10 dark:from-zinc-500/20 dark:via-zinc-500/10 dark:to-cyan-500/15">
          {/* Glow effect behind icon */}
          <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-zinc-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-zinc-500/15 blur-3xl" />

          <CardContent className="relative z-10 flex flex-col lg:flex-row items-center gap-8 p-8 lg:p-12">
            {/* Text side */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 mb-4">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative"
                >
                  <div className="absolute inset-0 rounded-2xl bg-zinc-500/30 blur-xl" />
                  <div className="relative p-4 rounded-2xl bg-zinc-500/20 border border-zinc-500/30">
                    <Puzzle className="h-10 w-10 text-zinc-500" />
                  </div>
                </motion.div>
                <Badge className="bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/30">
                  v1.2.0
                </Badge>
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
                TruthShield Browser Extension
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mb-6">
                Real-time deepfake detection &amp; fact verification while you browse
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="bg-zinc-600 hover:bg-zinc-700 text-white gap-2 shadow-lg shadow-zinc-500/25"
                  disabled={downloading}
                  onClick={downloadExtension}
                >
                  {downloading
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Download className="h-5 w-5" />}
                  {downloading ? 'Packaging…' : 'Download extension (.zip)'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 border-zinc-500/40 hover:border-zinc-500/70 text-zinc-600 dark:text-zinc-400"
                  onClick={() => setShowInstall((v) => !v)}
                >
                  <Globe className="h-4 w-4" />
                  How to load it
                </Button>
              </div>

              {showInstall && (
                <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-left text-sm">
                  <p className="font-medium">Load the unpacked extension</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Download the zip above and extract it.</li>
                    <li>Open <code>chrome://extensions</code> (or <code>edge://extensions</code>).</li>
                    <li>Turn on <b>Developer mode</b>, then choose <b>Load unpacked</b> and pick the extracted folder.</li>
                    <li>Open the extension&rsquo;s <b>Settings</b> and point it at this console&rsquo;s URL.</li>
                  </ol>
                  <p className="mt-2 text-xs">
                    Manifest V3. It adds right-click actions for selected text and images, and a popup
                    that verifies whatever you paste or have selected.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 mt-5 justify-center lg:justify-start text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-zinc-500" /> Unpacked build — not published to any store
                </span>
                <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-cyan-500" /> Manifest V3</span>
              </div>
            </div>

            {/* Floating browser mockup */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative shrink-0"
            >
              <div className="w-64 h-44 rounded-xl bg-background/80 border border-border/60 shadow-2xl overflow-hidden backdrop-blur-sm">
                {/* Browser chrome */}
                <div className="h-8 bg-muted/60 border-b border-border/50 flex items-center gap-1.5 px-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                  <div className="flex-1 ml-2 h-4 rounded bg-muted/80" />
                </div>
                {/* Page content mockup */}
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted/60" />
                  <div className="h-3 w-1/2 rounded bg-muted/40" />
                  <div className="h-12 w-full rounded bg-muted/30" />
                  <div className="h-3 w-2/3 rounded bg-muted/50" />
                </div>
                {/* Extension badge overlay */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="absolute top-10 right-2"
                >
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500 text-white text-[10px] font-bold shadow-lg shadow-zinc-500/40">
                    <Shield className="h-3 w-3" />
                    Active
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── 2. Browser Compatibility ─────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-zinc-500" />
          Browser Compatibility
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {browsers.map((b) => (
            <motion.div key={b.name} variants={fadeUp}>
              <Card className={`glass transition-colors ${b.color}`}>
                <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                  <b.icon className="h-8 w-8 text-muted-foreground" />
                  <h3 className="font-semibold">{b.name}</h3>
                  <p className="text-xs text-muted-foreground">{b.version}</p>

                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Planned
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── 3. Live Demo Section ─────────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <Card className="glass overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-zinc-500" />
              Live Demo
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Extension</span>
              <Switch checked={extensionEnabled} onCheckedChange={setExtensionEnabled} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full bg-muted/30 dark:bg-muted/10 border-t border-b border-border/30" style={{ minHeight: 320 }}>
              {/* Mock webpage */}
              <div className="p-6 max-w-2xl mx-auto">
                <div className="h-5 w-3/5 rounded bg-muted/70 mb-3" />
                <div className="h-3 w-full rounded bg-muted/50 mb-1.5" />
                <div className="h-3 w-5/6 rounded bg-muted/40 mb-4" />
                <div className="h-32 w-full rounded-lg bg-muted/30 mb-4" />
                <div className="h-3 w-full rounded bg-muted/50 mb-1.5" />
                <div className="h-3 w-4/5 rounded bg-muted/40 mb-1.5" />
                <div className="h-3 w-full rounded bg-muted/50" />
              </div>

              {/* Extension overlay */}
              <AnimatePresence>
                {extensionEnabled && (
                  <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute inset-0 pointer-events-none"
                  >
                    {/* Highlighted suspicious text overlay */}
                    <div className="absolute top-[104px] left-6 right-6 lg:right-auto lg:left-auto lg:right-6 max-w-2xl lg:max-w-none">
                      <div className="h-3 w-full rounded bg-red-500/20 border border-red-500/30" />
                    </div>
                    <div className="absolute top-[124px] left-6 right-6 lg:right-auto lg:left-auto lg:right-6 max-w-2xl lg:max-w-none">
                      <div className="h-3 w-5/6 rounded bg-red-500/15 border border-red-500/25" />
                    </div>

                    {/* DEEPFAKE DETECTED floating badge */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: 'spring' }}
                      className="absolute top-16 left-6 pointer-events-auto"
                    >
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-xs font-bold shadow-lg shadow-red-500/40 backdrop-blur-sm">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        DEEPFAKE DETECTED
                      </div>
                    </motion.div>

                    {/* Side panel */}
                    <motion.div
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.4 }}
                      className="absolute top-0 right-0 bottom-0 w-64 bg-background/95 border-l border-border/50 backdrop-blur-md pointer-events-auto p-4 flex flex-col gap-4 overflow-y-auto"
                    >
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-zinc-500" />
                        Analysis Panel
                      </h4>

                      <div className="flex flex-col items-center gap-2">
                        <TrustGaugeMini value={23} size={72} />
                        <span className="text-xs text-red-500 font-semibold">Low Trust Score</span>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Flagged Issues</div>
                        {['Manipulated image', 'False claim detected', 'Unreliable source'].map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Verdict</div>
                        <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30">
                          Likely Misinformation
                        </Badge>
                      </div>

                      <Button size="sm" className="mt-auto bg-zinc-600 hover:bg-zinc-700 text-white w-full gap-1.5 text-xs" onClick={() => toast.info('Full analysis would open in a new tab')}>
                        <CheckCircle className="h-3.5 w-3.5" />
                        View Full Report
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!extensionEnabled && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <EyeOff className="h-4 w-4" />
                Enable the extension toggle to see the live demo overlay
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* ── 4. Features Grid ─────────────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-zinc-500" />
          Extension Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i}>
              <Card className="glass group hover:border-zinc-500/40 transition-colors h-full">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-muted/50 group-hover:bg-zinc-500/10 transition-colors shrink-0">
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── 5. Installation Steps ────────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-zinc-500" />
          Get Started in 3 Steps
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-zinc-500/50 via-zinc-500/50 to-cyan-500/50" />

          {[
            { step: 1, title: 'Download and extract', desc: 'Use the button above to package the extension from this console, then unzip it', icon: Store, badges: ['Manifest V3', 'unpacked'] },
            { step: 2, title: 'Load unpacked', desc: 'chrome://extensions → Developer mode → Load unpacked → pick the extracted folder', icon: Cog, badges: ['Chrome', 'Edge', 'Brave'] },
            { step: 3, title: 'Point it at this console', desc: 'Open the extension settings and set the console URL, then right-click any text or image to verify', icon: ShieldCheck, badges: ['Context menu', 'Popup'] },
          ].map((s) => (
            <motion.div key={s.step} variants={fadeUp}>
              <Card className="glass text-center h-full">
                <CardContent className="p-6 flex flex-col items-center gap-4">
                  {/* Step badge */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-zinc-500/20 blur-md" />
                    <div className="relative h-12 w-12 rounded-full bg-zinc-500/15 border-2 border-zinc-500/40 flex items-center justify-center">
                      <span className="text-lg font-bold text-zinc-600 dark:text-zinc-400">{s.step}</span>
                    </div>
                  </div>
                  <s.icon className="h-7 w-7 text-zinc-500" />
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {s.badges.map((b) => (
                      <Badge key={b} variant="secondary" className="text-[10px]">{b}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── 6. Extension Settings Preview ─────────────────────────── */}
      <motion.section variants={fadeUp}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-500" />
          Extension Settings Preview
        </h2>
        <Card className="glass">
          <CardContent className="p-6 space-y-6">
            {/* Sensitivity slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-zinc-500" />
                  Detection Sensitivity
                </label>
                <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-zinc-500 bg-muted"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Low (fewer alerts)</span>
                <span>Balanced</span>
                <span>High (more alerts)</span>
              </div>
            </div>

            {/* Toggles row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2">
                  <ScanSearch className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm">Auto-scan</span>
                </div>
                <Switch checked={autoScan} onCheckedChange={setAutoScan} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Notifications</span>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-violet-500" />
                  <span className="text-sm">Dark Mode</span>
                </div>
                <Switch checked={extDarkMode} onCheckedChange={setExtDarkMode} />
              </div>
            </div>

            {/* Whitelist management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  Whitelisted Sites
                </label>
                <Badge variant="secondary" className="text-[10px]">{whitelist.length} sites</Badge>
              </div>
              <div className="flex gap-2">
                <input
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
                  placeholder="e.g. example.com"
                  className="flex-1 h-9 rounded-lg border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-zinc-500/40"
                />
                <Button size="sm" className="bg-zinc-600 hover:bg-zinc-700 text-white gap-1" onClick={addToWhitelist}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {whitelist.map((site) => (
                  <Badge key={site} variant="secondary" className="gap-1 pr-1">
                    {site}
                    <button
                      onClick={() => removeFromWhitelist(site)}
                      className="ml-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      aria-label={`Remove ${site}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── 7. Permissions Section ────────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-zinc-500" />
          Permissions &amp; Privacy
        </h2>
        <Card className="glass">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground mb-2">
              TruthShield requires the following permissions. All data is processed locally — nothing is sent to external servers.
            </p>
            {permissions.map((p, i) => (
              <motion.div
                key={p.title}
                variants={fadeUp}
                className="flex items-start gap-4 p-4 rounded-xl border border-border/40 hover:border-zinc-500/30 transition-colors"
              >
                <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                  <p.icon className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium">{p.title}</h4>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                      <ShieldCheck className="h-3 w-3" />
                      {p.trust}% trust
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.reason}</p>
                </div>
                <div className="shrink-0 mt-1">
                  <Info className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
                </div>
              </motion.div>
            ))}

            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-500/5 border border-zinc-500/20 mt-2">
              <ShieldCheck className="h-5 w-5 text-zinc-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">Privacy Guarantee:</span>{' '}
                TruthShield processes all content locally in your browser. No page content, browsing history, or personal data is ever transmitted to external servers.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.section>

    </motion.div>
  )
}
