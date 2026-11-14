'use client'

import { useState, useRef, useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { useAppStore, type TabId } from '@/lib/store'
import { DashboardTab } from '@/components/tabs/dashboard-tab'
import { TextAnalysisTab } from '@/components/tabs/text-analysis-tab'
import { ImageForensicsTab } from '@/components/tabs/image-forensics-tab'
import { VideoAnalysisTab } from '@/components/tabs/video-analysis-tab'
import { FactCheckTab } from '@/components/tabs/fact-check-tab'
import { InvestigationsTab } from '@/components/tabs/investigations-tab'
import { AlertsTab } from '@/components/tabs/alerts-tab'
import { WatchlistTab } from '@/components/tabs/watchlist-tab'
import { CrowdsourceTab } from '@/components/tabs/crowdsource-tab'
import { SettingsTab } from '@/components/tabs/settings-tab'
import { HistoryTab } from '@/components/tabs/history-tab'
import { ReverseSearchTab } from '@/components/tabs/reverse-search-tab'
import { ChatTab } from '@/components/tabs/chat-tab'
import { BatchAnalysis } from '@/components/batch-analysis'
import { AuditLogTab } from '@/components/tabs/audit-log-tab'
import { MediaComparisonTab } from '@/components/tabs/media-comparison-tab'
import { BrowserExtensionTab } from '@/components/tabs/browser-extension-tab'
import { ModelMetricsTab } from '@/components/tabs/model-metrics-tab'
import { ApiDocsTab } from '@/components/tabs/api-docs-tab'
import { NetworkAnalysisTab } from '@/components/tabs/network-analysis-tab'
import { CampaignDetectionTab } from '@/components/tabs/campaign-detection-tab'
import { OcrScannerTab } from '@/components/tabs/ocr-scanner-tab'
import { AudioDeepfakeTab } from '@/components/tabs/audio-deepfake-tab'
import { SourceCredibilityTab } from '@/components/tabs/source-credibility-tab'
import { LiveThreatFeedTab } from '@/components/tabs/live-threat-feed-tab'
import { EducationResourcesTab } from '@/components/tabs/education-resources-tab'
import { ReportGeneratorTab } from '@/components/tabs/report-generator-tab'
import { SystemHealthTab } from '@/components/tabs/system-health-tab'
import { DataVisualizationTab } from '@/components/tabs/data-visualization-tab'
import { WorkflowAutomationTab } from '@/components/tabs/workflow-automation-tab'
import { NotificationCenter } from '@/components/notification-center'
import { OfflineStatus } from '@/components/offline-status'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useTranslations } from 'next-intl'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button as HButton, Chip, Kbd, Avatar, Separator } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, LayoutDashboard, FileText, ImageIcon, Video, Search,
  Briefcase, Bell, Eye, Users, Settings, Menu, Sun, Moon, ChevronRight,
  LogOut, Clock, MessageSquare, Layers, Command, ClipboardList, GitCompare,
  Puzzle, BarChart3, BookOpen, Network, Keyboard, Radar, ScanText, Mic, GraduationCap, Radio, ShieldCheck, Server, Workflow, Lock,
} from 'lucide-react'

const navItems: { id: TabId; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview' },
  { id: 'dataVisualization', label: 'Data Visualization', icon: BarChart3, section: 'Overview' },
  { id: 'liveThreatFeed', label: 'Live Threat Feed', icon: Radio, section: 'Overview' },
  { id: 'text', label: 'Text Analysis', icon: FileText, section: 'Analysis' },
  { id: 'image', label: 'Image Forensics', icon: ImageIcon, section: 'Analysis' },
  { id: 'video', label: 'Video Analysis', icon: Video, section: 'Analysis' },
  { id: 'factcheck', label: 'Fact Check', icon: Search, section: 'Analysis' },
  { id: 'batch', label: 'Batch Analysis', icon: Layers, section: 'Analysis' },
  { id: 'comparison', label: 'Media Compare', icon: GitCompare, section: 'Analysis' },
  { id: 'networkAnalysis', label: 'Network Analysis', icon: Network, section: 'Analysis' },
  { id: 'campaignDetection', label: 'Campaign Detection', icon: Radar, section: 'Analysis' },
  { id: 'ocrScanner', label: 'OCR Scanner', icon: ScanText, section: 'Analysis' },
  { id: 'audioDeepfake', label: 'Audio Deepfake', icon: Mic, section: 'Analysis' },
  { id: 'history', label: 'History', icon: Clock, section: 'Tools' },
  { id: 'reverseSearch', label: 'Reverse Search', icon: Search, section: 'Tools' },
  { id: 'chat', label: 'AI Assistant', icon: MessageSquare, section: 'Tools' },
  { id: 'browserExtension', label: 'Browser Extension', icon: Puzzle, section: 'Tools' },
  { id: 'apiDocs', label: 'API Docs', icon: BookOpen, section: 'Tools' },
  { id: 'educationResources', label: 'Learn & Resources', icon: GraduationCap, section: 'Tools' },
  { id: 'reportGenerator', label: 'Report Generator', icon: FileText, section: 'Tools' },
  { id: 'investigations', label: 'Investigations', icon: Briefcase, section: 'Manage' },
  { id: 'alerts', label: 'Alerts', icon: Bell, section: 'Manage' },
  { id: 'watchlist', label: 'Watchlist', icon: Eye, section: 'Manage' },
  { id: 'community', label: 'Community', icon: Users, section: 'Manage' },
  { id: 'sourceCredibility', label: 'Source Credibility', icon: ShieldCheck, section: 'Manage' },
  { id: 'workflowAutomation', label: 'Workflows', icon: Workflow, section: 'Manage' },
  { id: 'modelMetrics', label: 'Model Metrics', icon: BarChart3, section: 'System' },
  { id: 'systemHealth', label: 'System Health', icon: Server, section: 'System' },
  { id: 'auditLog', label: 'Audit Log', icon: ClipboardList, section: 'System' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'System' },
]

// Global search items for quick navigation
const searchItems = [
  { label: 'Analyze text for fake news', tab: 'text' as TabId, icon: FileText, keywords: 'text analysis fake news verify' },
  { label: 'Upload image for forensics', tab: 'image' as TabId, icon: ImageIcon, keywords: 'image forensics upload detect manipulation' },
  { label: 'Detect deepfake in video', tab: 'video' as TabId, icon: Video, keywords: 'video deepfake detect analyze' },
  { label: 'Verify a claim with fact check', tab: 'factcheck' as TabId, icon: Search, keywords: 'fact check verify claim truth' },
  { label: 'Batch analyze multiple files', tab: 'batch' as TabId, icon: Layers, keywords: 'batch analysis multiple files upload' },
  { label: 'Compare two media files', tab: 'comparison' as TabId, icon: GitCompare, keywords: 'compare media side by side difference' },
  { label: 'Reverse image search', tab: 'reverseSearch' as TabId, icon: Search, keywords: 'reverse image search origin' },
  { label: 'Chat with AI assistant', tab: 'chat' as TabId, icon: MessageSquare, keywords: 'chat ai assistant help ask question' },
  { label: 'View analysis history', tab: 'history' as TabId, icon: Clock, keywords: 'history past analyses records' },
  { label: 'Manage investigations', tab: 'investigations' as TabId, icon: Briefcase, keywords: 'investigations cases manage track' },
  { label: 'View alerts', tab: 'alerts' as TabId, icon: Bell, keywords: 'alerts notifications warnings' },
  { label: 'Watchlist monitoring', tab: 'watchlist' as TabId, icon: Eye, keywords: 'watchlist monitor keywords hashtags' },
  { label: 'Community verification', tab: 'community' as TabId, icon: Users, keywords: 'community crowdsource verify vote' },
  { label: 'Platform settings', tab: 'settings' as TabId, icon: Settings, keywords: 'settings configuration preferences api' },
  { label: 'Audit log & activity timeline', tab: 'auditLog' as TabId, icon: ClipboardList, keywords: 'audit log activity timeline events history' },
  { label: 'Browser extension demo', tab: 'browserExtension' as TabId, icon: Puzzle, keywords: 'browser extension install chrome firefox plugin deepfake detection' },
  { label: 'Model metrics & performance', tab: 'modelMetrics' as TabId, icon: BarChart3, keywords: 'model metrics performance accuracy comparison ab testing api usage' },
  { label: 'API Documentation', tab: 'apiDocs' as TabId, icon: BookOpen, keywords: 'api docs documentation endpoints rest sdk webhooks authentication' },
  { label: 'Network & Watermark Analysis', tab: 'networkAnalysis' as TabId, icon: Network, keywords: 'network watermark analysis distribution provenance steganography metadata tracing' },
  { label: 'Campaign Detection Dashboard', tab: 'campaignDetection' as TabId, icon: Radar, keywords: 'campaign detection coordinated disinformation tracking network' },
  { label: 'OCR Scanner for Indian Scripts', tab: 'ocrScanner' as TabId, icon: ScanText, keywords: 'ocr scanner text extraction indian script hindi tamil bengali image' },
  { label: 'Audio Deepfake Detection', tab: 'audioDeepfake' as TabId, icon: Mic, keywords: 'audio deepfake voice cloning synthetic speech detection analysis' },
  { label: 'Education & Resources', tab: 'educationResources' as TabId, icon: GraduationCap, keywords: 'education resources learn courses tutorials quiz media literacy training deepfake detection' },
  { label: 'Live Threat Feed', tab: 'liveThreatFeed' as TabId, icon: Radio, keywords: 'live threat feed real-time monitoring deepfake misinformation phishing manipulation stream' },
  { label: 'Source Credibility Analyzer', tab: 'sourceCredibility' as TabId, icon: ShieldCheck, keywords: 'source credibility reliability bias fact-check trust news analyzer indian' },
  { label: 'Generate custom reports', tab: 'reportGenerator' as TabId, icon: FileText, keywords: 'report generator builder custom pdf docx export template verification' },
  { label: 'Data Visualization Dashboard', tab: 'dataVisualization' as TabId, icon: BarChart3, keywords: 'data visualization charts analytics dashboard threat trends radar pie bar geographic heatmap' },
  { label: 'System Health Monitor', tab: 'systemHealth' as TabId, icon: Server, keywords: 'system health monitor infrastructure performance metrics uptime cpu memory disk network services status alerts deployment' },
  { label: 'Dashboard overview', tab: 'dashboard' as TabId, icon: LayoutDashboard, keywords: 'dashboard overview stats home' },
  { label: 'Workflow Automation & Pipelines', tab: 'workflowAutomation' as TabId, icon: Workflow, keywords: 'workflow automation pipeline builder trigger verify notify export schedule' },
]

const emptySubscribe = () => () => { }

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  if (!mounted) return <HButton variant="ghost" isIconOnly size="sm" className="h-9 w-9" aria-label="Toggle theme"><Sun className="h-4 w-4" /></HButton>

  return (
    <HButton
      variant="ghost"
      isIconOnly
      size="sm"
      className="h-9 w-9"
      onPress={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </HButton>
  )
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [query, setQuery] = useState('')
  const { setActiveTab } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const tApp = useTranslations('app')

  // Reset query when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setQuery('')
    onOpenChange(v)
  }

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const filtered = query.trim()
    ? searchItems.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.keywords.toLowerCase().includes(query.toLowerCase())
    )
    : searchItems

  const handleSelect = (tab: TabId) => {
    setActiveTab(tab)
    onOpenChange(false)
    setQuery('')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{tApp('searchTitle')}</DialogTitle>
          <DialogDescription>{tApp('searchDesc')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
          <input
            ref={inputRef}
            placeholder={tApp('searchPlaceholder')}
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                handleSelect(filtered[0].tab)
              }
            }}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted rounded border">
            ESC
          </kbd>
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="p-2">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {tApp('noResults', { query })}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((item) => (
                  <button
                    key={item.tab}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left"
                    onClick={() => handleSelect(item.tab)}
                  >
                    <div className="p-1.5 rounded-md bg-muted/50">
                      <item.icon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function SidebarNav({ activeTab, setActiveTab, onClose }: { activeTab: TabId; setActiveTab: (t: TabId) => void; onClose?: () => void }) {
  const { alerts } = useAppStore()
  const unreadAlerts = alerts.filter((a) => !a.read).length
  const tNav = useTranslations('nav')
  const tSections = useTranslations('sections')

  // Group nav items by section
  const sections = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    const section = item.section || 'Other'
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})

  return (
    <nav className="space-y-0.5 px-3">
      {Object.entries(sections).map(([section, items]) => (
        <div key={section}>
          <div className="px-3 pt-4 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {tSections(section.toLowerCase())}
            </span>
          </div>
          {items.map((item) => {
            const isActive = activeTab === item.id
            const showBadge = item.id === 'alerts' && unreadAlerts > 0

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  onClose?.()
                }}
                className={`group relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                  ? 'nav-active'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-[var(--brand-teal)]" style={{ width: 3 }} />
                )}
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-teal' : ''}`} />
                <span className="flex-1 text-left">{tNav(item.id)}</span>
                {showBadge && (
                  <Chip size="sm" className="h-[18px] min-w-[18px] justify-center bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                    {unreadAlerts}
                  </Chip>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function IstClock() {
  const fmt = () =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())

  const [now, setNow] = useState<string>(() => fmt())

  useEffect(() => {
    const t = setInterval(() => setNow(fmt()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="ops-label text-muted-foreground tabular-nums" suppressHydrationWarning>
      {now ? `${now} IST` : '--:--:-- IST'}
    </span>
  )
}

export default function Home() {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen, alerts, dashboardStats } = useAppStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const unreadAlerts = alerts.filter((a) => !a.read).length

  // Keyboard shortcuts: Cmd+K for search, ? for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K for global search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      // ? or Shift+/ for keyboard shortcuts
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        // Don't trigger if typing in an input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />
      case 'text': return <TextAnalysisTab />
      case 'image': return <ImageForensicsTab />
      case 'video': return <VideoAnalysisTab />
      case 'factcheck': return <FactCheckTab />
      case 'batch': return <BatchAnalysis />
      case 'history': return <HistoryTab />
      case 'reverseSearch': return <ReverseSearchTab />
      case 'chat': return <ChatTab />
      case 'investigations': return <InvestigationsTab />
      case 'alerts': return <AlertsTab />
      case 'watchlist': return <WatchlistTab />
      case 'community': return <CrowdsourceTab />
      case 'auditLog': return <AuditLogTab />
      case 'comparison': return <MediaComparisonTab />
      case 'networkAnalysis': return <NetworkAnalysisTab />
      case 'browserExtension': return <BrowserExtensionTab />
      case 'modelMetrics': return <ModelMetricsTab />
      case 'apiDocs': return <ApiDocsTab />
      case 'campaignDetection': return <CampaignDetectionTab />
      case 'ocrScanner': return <OcrScannerTab />
      case 'audioDeepfake': return <AudioDeepfakeTab />
      case 'educationResources': return <EducationResourcesTab />
      case 'liveThreatFeed': return <LiveThreatFeedTab />
      case 'sourceCredibility': return <SourceCredibilityTab />
      case 'reportGenerator': return <ReportGeneratorTab />
      case 'dataVisualization': return <DataVisualizationTab />
      case 'systemHealth': return <SystemHealthTab />
      case 'workflowAutomation': return <WorkflowAutomationTab />
      case 'settings': return <SettingsTab />
      default: return <DashboardTab />
    }
  }

  const tNav = useTranslations('nav')
  const tApp = useTranslations('app')
  const activeLabel = tNav(activeTab)

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-background">
      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} onOpenSearch={() => setSearchOpen(true)} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        {/* Thin brand accent line: orange → teal */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[var(--brand-orange)] via-[var(--brand-orange)]/40 to-[var(--brand-teal)]" />
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <HButton variant="ghost" isIconOnly size="sm" className="lg:hidden h-9 w-9 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={tApp('openMenu')}>
                <Menu className="h-5 w-5" />
              </HButton>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar">
              <SheetTitle className="sr-only">{tApp('navMenu')}</SheetTitle>
              <SheetDescription className="sr-only">{tApp('navDesc')}</SheetDescription>
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border/60">
                  <Shield className="h-6 w-6 text-brand-orange" />
                  <span className="font-bold text-lg tracking-tight">TruthShield</span>
                </div>
                <ScrollArea className="flex-1 py-4">
                  <SidebarNav
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onClose={() => setSidebarOpen(false)}
                  />
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center">
              <img
                src="/TruthS.png"
                alt="TruthShield Logo"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-bold text-[15px] tracking-tight">TruthShield</span>
              <span className="text-[11px] font-medium text-muted-foreground/70 -mt-0.5">{tApp('tagline')}</span>
            </div>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Current tab label */}
          <h1 className="hidden sm:block text-sm font-medium text-foreground/80">{activeLabel}</h1>

          <div className="flex-1" />

          {/* Global Search Trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-muted/20 text-sm text-muted-foreground hover:bg-muted/40 hover:border-border transition-colors min-w-[220px]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{tApp('search')}</span>
            <Kbd>⌘K</Kbd>
          </button>

          {/* Keyboard Shortcuts Hint */}
          <HButton
            variant="ghost"
            isIconOnly
            size="sm"
            className="hidden md:flex h-9 w-9"
            onPress={() => setShortcutsOpen(true)}
            aria-label={tApp('shortcuts')}
          >
            <Keyboard className="h-4 w-4" />
          </HButton>

          {/* System Status */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-teal)] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-teal)]" />
            </span>
            <span className="font-medium text-brand-teal">{tApp('operational')}</span>
            <span className="h-3 w-px bg-border" />
            <IstClock />
          </div>

          {/* UI language */}
          <LanguageSwitcher />

          {/* Connectivity + offline analysis queue */}
          <OfflineStatus />

          {/* Notification bell */}
          <NotificationCenter>
            <HButton variant="ghost" isIconOnly size="sm" className="relative h-9 w-9" aria-label={tApp('notifications')}>
              <Bell className="h-4 w-4" />
              {unreadAlerts > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background" />
              )}
            </HButton>
          </NotificationCenter>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User avatar */}
          <Avatar className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-teal)]/15 text-brand-teal text-xs font-bold ring-1 ring-[var(--brand-teal)]/25">DS</Avatar>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-60 border-r border-border/60 flex-col shrink-0 bg-sidebar">
          <ScrollArea className="flex-1 min-h-0 py-4">
            <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </ScrollArea>
          <div className="p-3 border-t border-border/60">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors">
              <Avatar className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal)]/15 text-brand-teal text-xs font-bold ring-1 ring-[var(--brand-teal)]/25">DS</Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tApp('role')}</p>
                <p className="text-[11px] text-muted-foreground truncate">{tApp('clearance')}</p>
              </div>
              <LogOut className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 min-h-0 bg-background outline-none">
          <ScrollArea className="h-full">
            <div className="p-4 md:p-6 lg:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderTab()}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>
        </main>
      </div>

      {/* Footer */}
      <footer className="relative h-12 flex items-center justify-between px-4 text-xs text-muted-foreground shrink-0 border-t border-border/60 bg-sidebar">
        <div className="flex items-center gap-2">
          <Shield className="h-3 w-3 text-brand-orange" />
          <span className="font-medium text-foreground/80">TruthShield</span>
          <Chip size="sm" className="h-[18px] bg-muted/50 px-1.5 text-[10px] font-semibold text-muted-foreground">v3.3.0</Chip>
          <span className="hidden sm:inline text-border">|</span>
          <span className="hidden sm:inline">{dashboardStats ? `${dashboardStats.totalAnalyses.toLocaleString()} analyses` : ''}</span>
          <span className="hidden sm:inline text-border">|</span>
          <span className="hidden sm:inline">{dashboardStats ? `${dashboardStats.fakeNewsDetected.toLocaleString()} threats detected` : ''}</span>
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-teal)] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-teal)]" />
            </span>
            <span className="text-brand-teal font-medium">System Active</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Information Integrity Operations Console</span>
          <IstClock />
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  )
}
