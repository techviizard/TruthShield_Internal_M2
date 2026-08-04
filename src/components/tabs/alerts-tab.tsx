'use client'

import { useState, useEffect} from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, type AlertSeverity, type AlertType } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertTriangle, Video, FileText, ImageIcon, TrendingUp,
  Settings, CheckCircle, Eye, Filter, Shield, Clock, Zap,
} from 'lucide-react'

const severityConfig: Record<AlertSeverity, { color: string; icon: React.ElementType; dot: string; bg: string; gradient: string }> = {
  critical: { color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25', icon: AlertTriangle, dot: 'bg-red-500', bg: 'bg-red-500/10', gradient: 'from-red-500/10 to-transparent' },
  high: { color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25', icon: AlertTriangle, dot: 'bg-orange-500', bg: 'bg-orange-500/10', gradient: 'from-orange-500/10 to-transparent' },
  medium: { color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25', icon: AlertTriangle, dot: 'bg-yellow-500', bg: 'bg-yellow-500/10', gradient: 'from-yellow-500/10 to-transparent' },
  low: { color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25', icon: CheckCircle, dot: 'bg-green-500', bg: 'bg-green-500/10', gradient: 'from-green-500/10 to-transparent' },
  info: { color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25', icon: Bell, dot: 'bg-blue-500', bg: 'bg-blue-500/10', gradient: 'from-blue-500/10 to-transparent' },
}

const typeIcons: Record<AlertType, { icon: React.ElementType; color: string }> = {
  deepfake: { icon: Video, color: 'text-red-500' },
  fake_news: { icon: FileText, color: 'text-orange-500' },
  manipulation: { icon: ImageIcon, color: 'text-yellow-500' },
  trend: { icon: TrendingUp, color: 'text-purple-500' },
  system: { icon: Settings, color: 'text-blue-500' },
}

export function AlertsTab() {
  const { alerts, fetchAlerts, markAlertRead } = useAppStore()

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    return true
  })

  const unreadCount = alerts.filter((a) => !a.read).length
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const highCount = alerts.filter((a) => a.severity === 'high').length
  const mediumCount = alerts.filter((a) => a.severity === 'medium').length
  const lowCount = alerts.filter((a) => a.severity === 'low' || a.severity === 'info').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-zinc-500" />
              Alerts
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white animate-pulse-dot">{unreadCount} New</Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">Monitor and manage platform alerts</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deepfake">Deepfake</SelectItem>
                <SelectItem value="fake_news">Fake News</SelectItem>
                <SelectItem value="manipulation">Manipulation</SelectItem>
                <SelectItem value="trend">Trend</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Severity Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: criticalCount, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', gradient: 'from-red-500/10 to-transparent' },
          { label: 'High', count: highCount, icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/10', gradient: 'from-orange-500/10 to-transparent' },
          { label: 'Medium', count: mediumCount, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', gradient: 'from-yellow-500/10 to-transparent' },
          { label: 'Low/Info', count: lowCount, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', gradient: 'from-green-500/10 to-transparent' },
        ].map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className={`bg-gradient-to-br ${card.gradient} border rounded-xl hover:shadow-md transition-all`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold">{card.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Unread Progress */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Alert Review Progress
                </span>
                <span className="font-medium">{alerts.length - unreadCount} of {alerts.length} reviewed</span>
              </div>
              <Progress value={((alerts.length - unreadCount) / alerts.length) * 100} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Alert List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAlerts.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardContent className="p-12 flex flex-col items-center text-center gap-4">
                  <div className="p-4 rounded-full bg-zinc-500/10">
                    <Bell className="h-10 w-10 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">No Alerts Found</p>
                    <p className="text-sm text-muted-foreground mt-1">No alerts match your current filters</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            filteredAlerts.map((alert, idx) => {
              const sevConfig = severityConfig[alert.severity]
              const SevIcon = sevConfig.icon
              const typeInfo = typeIcons[alert.type]
              const TypeIcon = typeInfo.icon

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className={`transition-all hover:shadow-md group ${
                    !alert.read
                      ? 'border-l-4 border-l-zinc-500 bg-gradient-to-r from-zinc-500/[0.03] to-transparent'
                      : 'opacity-80'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Severity icon */}
                        <div className={`mt-0.5 shrink-0 p-2 rounded-lg ${sevConfig.bg} ${alert.severity === 'critical' ? 'animate-glow-pulse' : ''}`}>
                          <SevIcon className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {!alert.read && (
                                  <div className="w-2 h-2 rounded-full bg-zinc-500 shrink-0 animate-pulse-dot" />
                                )}
                                <p className={`text-sm ${!alert.read ? 'font-semibold' : 'font-medium'}`}>{alert.title}</p>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{alert.message}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sevConfig.color}`}>
                              {alert.severity}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <TypeIcon className={`h-3.5 w-3.5 ${typeInfo.color}`} />
                              <span>{alert.type.replace(/_/g, ' ')}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                            <span className="text-xs text-muted-foreground">Source: {alert.source}</span>
                          </div>
                        </div>

                        {!alert.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAlertRead(alert.id)}
                            className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            <span className="text-xs">Read</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
