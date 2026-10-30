'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppStore, type Alert, type AlertSeverity, type AlertType } from '@/lib/store'
import { useTranslations } from 'next-intl'
import {
  Bell, CheckCircle2, AlertTriangle, Video, FileText, ImageIcon,
  TrendingUp, Settings, CheckCheck, ArrowRight, BellOff
} from 'lucide-react'

// Severity color configs
const severityConfig: Record<AlertSeverity, { bg: string; text: string; border: string; dot: string; badge: string }> = {
  critical: {
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-l-red-500',
    dot: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
  high: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-l-orange-500',
    dot: 'bg-orange-500',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
  },
  medium: {
    bg: 'bg-yellow-500/10 dark:bg-yellow-500/15',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-l-yellow-500',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  },
  low: {
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/15',
    text: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-l-zinc-500',
    dot: 'bg-zinc-500',
    badge: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/20',
  },
  info: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
}

// Type icon mapping
const typeIconMap: Record<AlertType, React.ElementType> = {
  deepfake: Video,
  fake_news: FileText,
  manipulation: ImageIcon,
  trend: TrendingUp,
  system: Settings,
}

const typeColorMap: Record<AlertType, string> = {
  deepfake: 'text-purple-500',
  fake_news: 'text-red-500',
  manipulation: 'text-amber-500',
  trend: 'text-cyan-500',
  system: 'text-slate-500',
}

// Relative time formatter
function formatRelativeTime(timestamp: string): string {
  // Store alerts already carry a relative label; pass those through unchanged.
  if (timestamp.includes('ago') || timestamp.includes('Just now')) return timestamp

  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 60) return 'Just now'
    if (diffMin < 60) return `${diffMin} min ago`
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  } catch {
    return timestamp
  }
}

// Severity label with proper casing
function severityLabel(severity: AlertSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

export function NotificationCenter({ children }: { children: React.ReactNode }) {
  const { alerts, fetchAlerts, markAlertRead, setActiveTab } = useAppStore()
  const t = useTranslations('notifications')

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])
  const [open, setOpen] = useState(false)

  const unreadAlerts = alerts.filter(a => !a.read)
  const recentAlerts = alerts.slice(0, 8) // Show max 8

  const handleMarkAllRead = () => {
    unreadAlerts.forEach(alert => markAlertRead(alert.id))
  }

  const handleAlertClick = (alert: Alert) => {
    if (!alert.read) {
      markAlertRead(alert.id)
    }
  }

  const handleViewAll = () => {
    setOpen(false)
    setActiveTab('alerts')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            {unreadAlerts.length > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center border-0">
                {unreadAlerts.length}
              </Badge>
            )}
          </div>
          {unreadAlerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              {t('markAllRead')}
            </Button>
          )}
        </div>

        {/* Alert list */}
        {recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <BellOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">{t('empty')}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t('caughtUp')}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="flex flex-col">
              {recentAlerts.map((alert, index) => {
                const severity = severityConfig[alert.severity]
                const TypeIcon = typeIconMap[alert.type]
                const typeColor = typeColorMap[alert.type]
                const isUnread = !alert.read

                return (
                  <div key={alert.id}>
                    <button
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 border-l-[3px] ${severity.border} ${
                        isUnread ? 'bg-zinc-500/[0.04] dark:bg-zinc-500/[0.06]' : ''
                      }`}
                      onClick={() => handleAlertClick(alert)}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`shrink-0 mt-0.5 p-1.5 rounded-md ${severity.bg}`}>
                          <TypeIcon className={`h-3.5 w-3.5 ${typeColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium leading-tight ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {alert.title}
                            </p>
                            {isUnread && (
                              <span className={`shrink-0 mt-1.5 h-2 w-2 rounded-full ${severity.dot}`} />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-medium border ${severity.badge}`}>
                              {severityLabel(alert.severity)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatRelativeTime(alert.timestamp)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] text-muted-foreground/40 truncate">
                              {alert.source}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    {index < recentAlerts.length - 1 && <Separator className="mx-4 w-auto" />}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="border-t">
          <Button
            variant="ghost"
            className="w-full justify-center text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-500/5 h-9 rounded-none font-medium"
            onClick={handleViewAll}
          >
            {t('viewAll')}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
