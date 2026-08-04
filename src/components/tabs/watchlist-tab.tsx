'use client'

import { useState, useEffect} from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useAppStore, type WatchlistItemType } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Eye, Plus, Search, Trash2, Globe, Hash, AtSign, Link2,
  TrendingUp, Clock, Filter, AlertCircle, CheckCircle2, BarChart3, Zap,
} from 'lucide-react'

const typeIcon: Record<WatchlistItemType, React.ElementType> = {
  keyword: Search,
  url: Link2,
  hashtag: Hash,
  account: AtSign,
}

const typeBadgeClass: Record<WatchlistItemType, string> = {
  keyword: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  url: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  hashtag: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  account: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25',
}

const languageNames: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
}

export function WatchlistTab() {
  const { watchlistItems, fetchWatchlist, addWatchlistItem, removeWatchlistItem, toggleWatchlistItem } = useAppStore()

  // Watchlist rows live in the database — load them on mount.
  useEffect(() => {
    void fetchWatchlist()
  }, [fetchWatchlist])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newType, setNewType] = useState<WatchlistItemType>('keyword')
  const [newLanguage, setNewLanguage] = useState('en')

  const filteredItems = watchlistItems.filter((item) => {
    const matchesSearch = item.keyword.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || item.type === filterType
    const matchesStatus = filterStatus === 'all'
      || (filterStatus === 'active' && item.active)
      || (filterStatus === 'inactive' && !item.active)
    return matchesSearch && matchesType && matchesStatus
  })

  const activeCount = watchlistItems.filter((i) => i.active).length
  const totalHits = watchlistItems.reduce((sum, i) => sum + i.hitCount, 0)

  // Analytics data
  const hitsByType = [
    { type: 'Keyword', count: watchlistItems.filter(i => i.type === 'keyword').reduce((s, i) => s + i.hitCount, 0), color: '#10b981' },
    { type: 'URL', count: watchlistItems.filter(i => i.type === 'url').reduce((s, i) => s + i.hitCount, 0), color: '#14b8a6' },
    { type: 'Hashtag', count: watchlistItems.filter(i => i.type === 'hashtag').reduce((s, i) => s + i.hitCount, 0), color: '#f59e0b' },
    { type: 'Account', count: watchlistItems.filter(i => i.type === 'account').reduce((s, i) => s + i.hitCount, 0), color: '#8b5cf6' },
  ]

  const topItems = [...watchlistItems].sort((a, b) => b.hitCount - a.hitCount).slice(0, 5)
  const maxHit = topItems.length > 0 ? topItems[0].hitCount : 1

  const languageDistribution = Object.entries(
    watchlistItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.language] = (acc[item.language] || 0) + 1
      return acc
    }, {})
  ).map(([lang, count]) => ({ language: languageNames[lang] || lang, count }))

  const inactiveCount = watchlistItems.length - activeCount

  const handleAdd = () => {
    if (!newKeyword.trim()) return
    addWatchlistItem({ keyword: newKeyword.trim(), type: newType, language: newLanguage, active: true })
    setNewKeyword('')
    setNewType('keyword')
    setNewLanguage('en')
    setDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-zinc-500" />
            Watchlist Monitor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track keywords, URLs, hashtags, and accounts for misinformation signals
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-zinc-600 hover:bg-zinc-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Watchlist Item</DialogTitle>
              <DialogDescription>Monitor a new keyword, URL, hashtag, or account for potential misinformation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Keyword / Value</label>
                <Input
                  placeholder="e.g., चुनाव फर्जी, #hashtag, @account, URL"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as WatchlistItemType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Keyword</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="hashtag">Hashtag</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select value={newLanguage} onValueChange={setNewLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="te">Telugu</SelectItem>
                      <SelectItem value="ta">Tamil</SelectItem>
                      <SelectItem value="bn">Bengali</SelectItem>
                      <SelectItem value="mr">Marathi</SelectItem>
                      <SelectItem value="gu">Gujarati</SelectItem>
                      <SelectItem value="kn">Kannada</SelectItem>
                      <SelectItem value="ml">Malayalam</SelectItem>
                      <SelectItem value="pa">Punjabi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="bg-zinc-600 hover:bg-zinc-700 text-white" onClick={handleAdd} disabled={!newKeyword.trim()}>
                Add to Watchlist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="bg-gradient-to-br from-zinc-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-500/10">
                  <Eye className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{watchlistItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="bg-gradient-to-br from-zinc-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-500/10">
                  <CheckCircle2 className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Hits</p>
                  <p className="text-2xl font-bold">{totalHits.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-gradient-to-br from-red-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-red-500/10">
                  <Zap className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hits by Type Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-500" />
                Hits by Type
              </CardTitle>
              <CardDescription>Distribution of hits across monitor types</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hitsByType}>
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {hitsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Monitored Items */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Top Monitored Items
              </CardTitle>
              <CardDescription>Highest hit count items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topItems.map((item, idx) => {
                  const TypeIcon = typeIcon[item.type]
                  const percentage = Math.round((item.hitCount / maxHit) * 100)
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{item.keyword}</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0 ml-2">
                          {item.hitCount.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-1.5" />
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Language Distribution */}
      {languageDistribution.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-zinc-500" />
                Language Coverage
              </CardTitle>
              <CardDescription>Monitored languages distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {languageDistribution.map((lang) => (
                  <div
                    key={lang.language}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-sm font-medium">{lang.language}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{lang.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search watchlist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-3">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="hashtag">Hashtag</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Watchlist Items */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredItems.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border rounded-xl">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No watchlist items match your filters</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            filteredItems.map((item, idx) => {
              const TypeIcon = typeIcon[item.type]
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className={`border rounded-xl hover:shadow-md transition-all ${!item.active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Type icon and keyword */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${item.active ? 'bg-zinc-500/10' : 'bg-muted/50'}`}>
                            <TypeIcon className={`h-4 w-4 ${item.active ? 'text-zinc-500' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{item.keyword}</p>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeBadgeClass[item.type]}`}>
                                {item.type}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                <Globe className="h-2.5 w-2.5 mr-1" />
                                {languageNames[item.language] || item.language}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {item.hitCount.toLocaleString()} hits
                              </span>
                              {item.lastHit && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Last hit: {item.lastHit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 sm:shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{item.active ? 'Active' : 'Paused'}</span>
                            <Switch
                              checked={item.active}
                              onCheckedChange={() => toggleWatchlistItem(item.id)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => removeWatchlistItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
