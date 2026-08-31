'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, type TabId } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Keyboard, Search, LayoutDashboard, FileText, ImageIcon, Video,
  Layers, GitCompare, Clock, MessageSquare,
  Moon, Sun, PlusCircle, Download, Maximize2, X,
} from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  description: string
  context?: string
  icon?: React.ElementType
  tab?: TabId
  action?: () => void
}

interface ShortcutSection {
  title: string
  items: ShortcutItem[]
}

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSearch?: () => void
}

export function KeyboardShortcuts({ open, onOpenChange, onOpenSearch }: KeyboardShortcutsProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { setActiveTab } = useAppStore()
  const { setTheme, resolvedTheme } = useTheme()

  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? '⌘' : 'Ctrl'

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setQuery('')
  }, [onOpenChange])

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) {
      setQuery('')
    }
    onOpenChange(v)
  }, [onOpenChange])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  // Build sections with actions
  const sections: ShortcutSection[] = [
    {
      title: 'Navigation',
      items: [
        { keys: ['1'], description: 'Dashboard', icon: LayoutDashboard, tab: 'dashboard', context: 'Anywhere' },
        { keys: ['2'], description: 'Text Analysis', icon: FileText, tab: 'text', context: 'Anywhere' },
        { keys: ['3'], description: 'Image Forensics', icon: ImageIcon, tab: 'image', context: 'Anywhere' },
        { keys: ['4'], description: 'Video Analysis', icon: Video, tab: 'video', context: 'Anywhere' },
        { keys: ['5'], description: 'Fact Check', icon: Search, tab: 'factcheck', context: 'Anywhere' },
        { keys: ['6'], description: 'Batch Analysis', icon: Layers, tab: 'batch', context: 'Anywhere' },
        { keys: ['7'], description: 'Media Compare', icon: GitCompare, tab: 'comparison', context: 'Anywhere' },
        { keys: ['8'], description: 'AI Assistant', icon: MessageSquare, tab: 'chat', context: 'Anywhere' },
        { keys: ['9'], description: 'History', icon: Clock, tab: 'history', context: 'Anywhere' },
        { keys: ['0'], description: 'Settings', icon: Sun, tab: 'settings', context: 'Anywhere' },
        { keys: ['D'], description: 'Go to Dashboard', icon: LayoutDashboard, tab: 'dashboard', context: 'Anywhere' },
        { keys: ['T'], description: 'Go to Text Analysis', icon: FileText, tab: 'text', context: 'Anywhere' },
        { keys: ['I'], description: 'Go to Image Forensics', icon: ImageIcon, tab: 'image', context: 'Anywhere' },
        { keys: ['V'], description: 'Go to Video Analysis', icon: Video, tab: 'video', context: 'Anywhere' },
      ],
    },
    {
      title: 'Actions',
      items: [
        { keys: [modKey, 'K'], description: 'Global Search', icon: Search, context: 'Anywhere', action: () => { handleClose(); onOpenSearch?.() } },
        { keys: ['?'], description: 'Show Keyboard Shortcuts', icon: Keyboard, context: 'Anywhere' },
        { keys: ['N'], description: 'New Analysis', icon: PlusCircle, tab: 'text', context: 'Anywhere' },
        { keys: ['E'], description: 'Export Current Result', icon: Download, context: 'Analysis tabs' },
      ],
    },
    {
      title: 'View',
      items: [
        { keys: [modKey, 'D'], description: 'Toggle Dark Mode', icon: resolvedTheme === 'dark' ? Sun : Moon, action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'), context: 'Anywhere' },
        { keys: ['F'], description: 'Toggle Fullscreen', icon: Maximize2, action: toggleFullscreen, context: 'Anywhere' },
        { keys: ['Esc'], description: 'Close Dialog / Overlay', icon: X, context: 'When dialog open' },
      ],
    },
  ]

  // Filter shortcuts based on search query
  const filteredSections = query.trim()
    ? sections.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.description.toLowerCase().includes(query.toLowerCase()) ||
            item.keys.join('+').toLowerCase().includes(query.toLowerCase()) ||
            (item.context || '').toLowerCase().includes(query.toLowerCase())
        ),
      })).filter((section) => section.items.length > 0)
    : sections

  const handleShortcutClick = (item: ShortcutItem) => {
    if (item.action) {
      item.action()
    }
    if (item.tab) {
      setActiveTab(item.tab)
    }
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden bg-background/80 backdrop-blur-xl border-zinc-500/20">
        <DialogHeader className="sr-only">
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>All available keyboard shortcuts in TruthShield</DialogDescription>
        </DialogHeader>

        {/* Header with search */}
        <div className="border-b border-zinc-500/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-500/10">
              <Keyboard className="h-4 w-4 text-zinc-500" />
            </div>
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            <div className="flex-1" />
            <kbd className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted rounded-md border">
              Esc
            </kbd>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              placeholder="Search shortcuts..."
              className="w-full h-9 pl-9 pr-3 bg-muted/30 rounded-lg border border-border/50 text-sm outline-none focus:border-zinc-500/50 focus:ring-1 focus:ring-zinc-500/20 transition-colors placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <ScrollArea className="max-h-[60vh] sm:max-h-[450px]">
          <div className="p-4 space-y-6">
            <AnimatePresence>
              {filteredSections.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No shortcuts found for &quot;{query}&quot;
                </motion.div>
              ) : (
                filteredSections.map((section, sectionIndex) => (
                  <motion.div
                    key={section.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIndex * 0.08, duration: 0.2 }}
                  >
                    {/* Section header with zinc left border */}
                    <div className="flex items-center gap-2 mb-3 pl-3 border-l-2 border-zinc-500">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        {section.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {section.items.length} shortcut{section.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Shortcut items */}
                    <div className="space-y-1">
                      {section.items.map((item, itemIndex) => {
                        const IconComp = item.icon
                        return (
                          <motion.button
                            key={`${item.keys.join('+')}-${item.description}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: sectionIndex * 0.08 + itemIndex * 0.03, duration: 0.15 }}
                            onClick={() => handleShortcutClick(item)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left group"
                          >
                            {/* Icon */}
                            {IconComp && (
                              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-muted/50 group-hover:bg-zinc-500/10 transition-colors shrink-0">
                                <IconComp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-zinc-500 transition-colors" />
                              </div>
                            )}

                            {/* Description */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-foreground/90">{item.description}</p>
                            </div>

                            {/* Context */}
                            {item.context && (
                              <span className="hidden sm:inline text-[10px] text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded shrink-0">
                                {item.context}
                              </span>
                            )}

                            {/* Key combo */}
                            <div className="flex items-center gap-1 shrink-0">
                              {item.keys.map((key, ki) => (
                                <span key={ki} className="flex items-center gap-1">
                                  <kbd className="inline-flex items-center justify-center min-w-[24px] px-2 py-1 text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-500/10 dark:bg-zinc-500/15 rounded-md border border-zinc-500/20 dark:border-zinc-500/30">
                                    {key}
                                  </kbd>
                                  {ki < item.keys.length - 1 && (
                                    <span className="text-muted-foreground/40 text-xs">+</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-zinc-500/10 px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">?</kbd>
              <span>Toggle this panel</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">{modKey}</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">K</kbd>
              <span>Search</span>
            </span>
          </div>
          <span className="text-zinc-600/60 dark:text-zinc-400/60">TruthShield v3.0.0</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
