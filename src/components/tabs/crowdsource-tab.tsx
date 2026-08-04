'use client'

import { useState, useEffect} from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAppStore, type TrustBadge, type CommunityReportStatus } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, ThumbsUp, ThumbsDown, Plus, Shield, AlertTriangle,
  FileText, ImageIcon, Video, Mic, CheckCircle2, XCircle,
  Clock, Award, Info, TrendingUp, Trophy, Zap, Target,
  Lightbulb, ChevronDown, ChevronUp, Search, Eye, MessageCircle,
  ArrowUpRight, Lock, Activity, Star, Crown,
} from 'lucide-react'

const mediaTypeIcon: Record<string, React.ElementType> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  audio: Mic,
}

const statusBadge: Record<CommunityReportStatus, { class: string; icon: React.ElementType; label: string }> = {
  verified: { class: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25', icon: CheckCircle2, label: 'Verified' },
  disputed: { class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25', icon: XCircle, label: 'Disputed' },
  pending: { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', icon: Clock, label: 'Pending' },
}

const badgeStyle: Record<TrustBadge, { class: string; icon: string }> = {
  Bronze: { class: 'bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-500/25', icon: '🥉' },
  Silver: { class: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/25', icon: '🥈' },
  Gold: { class: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25', icon: '🥇' },
  Platinum: { class: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25', icon: '💎' },
}

// --- NEW DATA ---

type TimeRange = 'week' | 'month' | 'all'

interface Contributor {
  rank: number
  name: string
  contributions: number
  trustScore: number
}

interface CommunityApiStats {
  totalContributors: number
  reportsFiled: number
  verifiedClaims: number
  communityTrust: number
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function badgeFor(trust: number): TrustBadge {
  return trust >= 90 ? 'Platinum' : trust >= 75 ? 'Gold' : trust >= 60 ? 'Silver' : 'Bronze'
}

const RANK_AVATAR = [
  'bg-gradient-to-br from-yellow-400 to-amber-500',
  'bg-gradient-to-br from-gray-300 to-gray-400',
  'bg-gradient-to-br from-amber-600 to-amber-700',
]


/**
 * Badge criteria (rules, not data). Whether a badge is unlocked is evaluated
 * against real counts from the community reports in the database.
 */
const achievementBadges: Array<{
  emoji: string
  name: string
  description: string
  test: (ctx: { verified: number; reports: number; contributors: number; meanConsensus: number }) => boolean
}> = [
  { emoji: '🔍', name: 'Eagle Eye', description: 'Community filed 10+ reports', test: (c) => c.reports >= 10 },
  { emoji: '✅', name: 'Truth Seeker', description: '5+ claims reached verified consensus', test: (c) => c.verified >= 5 },
  { emoji: '🛡️', name: 'Guardian', description: '25+ reports filed', test: (c) => c.reports >= 25 },
  { emoji: '🌐', name: 'Crowd', description: '5+ distinct contributors', test: (c) => c.contributors >= 5 },
  { emoji: '🎯', name: 'High Consensus', description: 'Mean consensus above 80%', test: (c) => c.meanConsensus >= 80 },
  { emoji: '🏆', name: 'Established', description: '100+ reports filed', test: (c) => c.reports >= 100 },
]


const quickTips = [
  'Be specific about what you found suspicious',
  'Include the source URL when possible',
  'Tag the media type correctly for faster verification',
]

const tagSuggestions = ['deepfake', 'misinformation', 'politics', 'health', 'AI-generated', 'whatsapp', 'social-media', 'election', 'financial', 'phishing', 'manipulation', 'out-of-context']

/** Token-overlap similarity against the reports already in the database. */
function findSimilarReports(
  title: string,
  reports: { title: string; status: CommunityReportStatus }[],
): { title: string; status: CommunityReportStatus; similarity: number }[] {
  const tokens = (t: string) =>
    new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))
  const a = tokens(title)
  if (a.size === 0) return []
  return reports
    .map((r) => {
      const b = tokens(r.title)
      const inter = [...a].filter((w) => b.has(w)).length
      const union = new Set([...a, ...b]).size || 1
      return { title: r.title, status: r.status, similarity: Math.round((inter / union) * 100) }
    })
    .filter((r) => r.similarity > 0)
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, 3)
}

// --- COMPONENT ---

export function CrowdsourceTab() {
  const { communityReports, fetchCommunityReports, addCommunityReport, voteOnReport } = useAppStore()

  useEffect(() => {
    void fetchCommunityReports()
  }, [fetchCommunityReports])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newMediaType, setNewMediaType] = useState<'text' | 'image' | 'video' | 'audio'>('text')
  const [newTags, setNewTags] = useState('')
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [apiStats, setApiStats] = useState<CommunityApiStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<Contributor[]>([])
  const [tipsOpen, setTipsOpen] = useState(true)
  const [showSimilarReports, setShowSimilarReports] = useState(false)

  // Stats + leaderboard are aggregated server-side from stored community reports.
  useEffect(() => {
    let aborted = false
    fetch(`/api/community?range=${timeRange}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted || !j?.success) return
        setApiStats(j.stats as CommunityApiStats)
        setLeaderboard((j.leaderboard ?? []) as Contributor[])
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [timeRange, communityReports.length])

  const filteredReports = communityReports.filter((r) => {
    return filterStatus === 'all' || r.status === filterStatus
  })

  const verifiedCount = communityReports.filter((r) => r.status === 'verified').length
  const pendingCount = communityReports.filter((r) => r.status === 'pending').length
  const disputedCount = communityReports.filter((r) => r.status === 'disputed').length

  const contributors = leaderboard.map((c) => ({
    ...c,
    initials: initialsOf(c.name),
    badge: badgeFor(c.trustScore),
    avatarBg: RANK_AVATAR[c.rank - 1] ?? 'bg-zinc-500/70',
  }))

  const communityStats = [
    { label: 'Total Contributors', value: String(apiStats?.totalContributors ?? 0), icon: Users, iconBg: 'bg-zinc-500/15', iconColor: 'text-zinc-500', trend: 'from stored reports', trendColor: 'text-muted-foreground' },
    { label: 'Reports Filed', value: String(apiStats?.reportsFiled ?? 0), icon: FileText, iconBg: 'bg-zinc-500/15', iconColor: 'text-zinc-500', trend: 'all time', trendColor: 'text-muted-foreground' },
    { label: 'Verified Claims', value: String(apiStats?.verifiedClaims ?? 0), icon: CheckCircle2, iconBg: 'bg-cyan-500/15', iconColor: 'text-cyan-500', trend: 'consensus reached', trendColor: 'text-cyan-600 dark:text-cyan-400' },
    { label: 'Mean Consensus', value: `${apiStats?.communityTrust ?? 0}%`, icon: Shield, iconBg: 'bg-zinc-500/15', iconColor: 'text-zinc-500', trend: 'weighted vote score', trendColor: 'text-muted-foreground' },
  ]
  const badgeContext = {
    verified: verifiedCount,
    reports: apiStats?.reportsFiled ?? communityReports.length,
    contributors: apiStats?.totalContributors ?? 0,
    meanConsensus: apiStats?.communityTrust ?? 0,
  }

  const similarReports = findSimilarReports(newTitle, communityReports)

  // Activity feed from the most recent community reports (real rows).
  const recentActivities = communityReports.slice(0, 8).map((r) => ({
    user: r.submitterName,
    action:
      r.status === 'verified'
        ? `report verified by consensus: ${r.title}`
        : r.status === 'disputed'
          ? `report disputed by voters: ${r.title}`
          : `submitted a report: ${r.title}`,
    time: r.timestamp,
    initials: initialsOf(r.submitterName),
    icon: r.status === 'verified' ? CheckCircle2 : r.status === 'disputed' ? AlertTriangle : FileText,
    iconColor: r.status === 'verified' ? 'text-zinc-500' : r.status === 'disputed' ? 'text-red-500' : 'text-cyan-500',
  }))

  const top3 = contributors.slice(0, 3)
  const rest = contributors.slice(3)

  const handleAddTag = (tag: string) => {
    const currentTags = newTags.split(',').map((t) => t.trim()).filter(Boolean)
    if (!currentTags.includes(tag)) {
      setNewTags(currentTags.length > 0 ? `${newTags}, ${tag}` : tag)
    }
  }

  const handleCheckSimilar = () => {
    setShowSimilarReports(true)
  }

  const handleSubmit = () => {
    if (!newTitle.trim() || !newDescription.trim()) return
    addCommunityReport({
      title: newTitle.trim(),
      description: newDescription.trim(),
      mediaType: newMediaType,
      submitterName: 'You (Analyst)',
      submitterTrustScore: 78,
      submitterBadge: 'Silver',
      status: 'pending',
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setNewTitle('')
    setNewDescription('')
    setNewMediaType('text')
    setNewTags('')
    setDialogOpen(false)
    setShowSimilarReports(false)
  }

  const podiumOrder = [top3[1], top3[0], top3[2]] // #2, #1, #3

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-zinc-500" />
            Community Verification
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crowd-sourced fact-checking with community consensus
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setShowSimilarReports(false) }}>
          <DialogTrigger asChild>
            <Button className="bg-zinc-600 hover:bg-zinc-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Submit Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit a Community Report</DialogTitle>
              <DialogDescription>Report potential misinformation you have found. The community will review and verify.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Quick Tips */}
              <Collapsible open={tipsOpen} onOpenChange={setTipsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex items-center justify-between p-2 h-auto bg-zinc-500/5 hover:bg-zinc-500/10 rounded-lg">
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      <Lightbulb className="h-4 w-4" />
                      Quick Tips for Better Reports
                    </span>
                    {tipsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2 pl-2">
                    {quickTips.map((tip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Zap className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                        {tip}
                      </motion.div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Brief title describing the content"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe the misinformation you found, including why you believe it is false or misleading..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Media Type</label>
                  <Select value={newMediaType} onValueChange={(v) => setNewMediaType(v as typeof newMediaType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags (comma separated)</label>
                  <Input
                    placeholder="e.g., politics, health"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                  />
                </div>
              </div>
              {/* Tag Suggestions */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Suggested Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {tagSuggestions.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-zinc-500/10 hover:border-zinc-500/30 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors text-xs"
                      onClick={() => handleAddTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Similar Reports Check */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleCheckSimilar}
                  disabled={!newTitle.trim()}
                >
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Check for Similar Reports
                </Button>
                <AnimatePresence>
                  {showSimilarReports && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Similar reports found — please review before submitting
                      </p>
                      {similarReports.map((report, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{report.title}</p>
                            <p className="text-muted-foreground">{report.similarity}% similar</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-2 shrink-0 ${statusBadge[report.status].class}`}>
                            {statusBadge[report.status].label}
                          </Badge>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setShowSimilarReports(false) }}>Cancel</Button>
              <Button className="bg-zinc-600 hover:bg-zinc-700 text-white" onClick={handleSubmit} disabled={!newTitle.trim() || !newDescription.trim()}>
                Submit Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ============ NEW SECTION 1: Community Stats Banner ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {communityStats.map((stat, i) => {
          const StatIcon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 30 }}
            >
              <Card className="glass border rounded-xl hover:shadow-md transition-shadow bg-gradient-to-br from-zinc-500/[0.03] to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                      <StatIcon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                      <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${stat.trendColor} border-current/20`}>
                      <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                      {stat.trend}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* ============ NEW SECTION 2: Top Contributors Leaderboard ============ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass border rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Contributors
              </CardTitle>
              <div className="flex items-center gap-1">
                {(['week', 'month', 'all'] as TimeRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-3 text-xs ${timeRange === range ? 'bg-zinc-600 hover:bg-zinc-700 text-white' : ''}`}
                    onClick={() => setTimeRange(range)}
                  >
                    {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Podium: #2 - #1 - #3 */}
            <div className="flex items-end justify-center gap-3 sm:gap-6 mb-6 pt-4">
              {podiumOrder.map((contributor, i) => {
                if (!contributor) return null
                const isCenter = i === 1 // #1 is in the center
                const podiumColors = [
                  'from-gray-300 to-gray-400', // #2 silver
                  'from-yellow-400 to-amber-500', // #1 gold
                  'from-amber-600 to-amber-700', // #3 bronze
                ]
                const podiumLabels = ['2nd', '1st', '3rd']
                const podiumHeights = ['h-20', 'h-28', 'h-16']
                const sizeClass = isCenter ? 'w-16 h-16' : 'w-12 h-12'
                const nameSize = isCenter ? 'text-sm' : 'text-xs'

                return (
                  <motion.div
                    key={contributor.rank}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.15, type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex flex-col items-center"
                  >
                    {/* Crown for #1 */}
                    {isCenter && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                      >
                        <Crown className="h-5 w-5 text-yellow-500 mb-1" />
                      </motion.div>
                    )}
                    {/* Avatar */}
                    <div className={`${sizeClass} rounded-full ${contributor.avatarBg} flex items-center justify-center text-white font-bold ${isCenter ? 'text-lg' : 'text-sm'} ring-2 ${isCenter ? 'ring-yellow-400/50 ring-offset-2' : 'ring-gray-400/30'}`}>
                      {contributor.initials}
                    </div>
                    {/* Name & Badge */}
                    <p className={`${nameSize} font-semibold mt-2 text-center`}>{contributor.name}</p>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 mt-1 ${badgeStyle[contributor.badge].class}`}>
                      {badgeStyle[contributor.badge].icon} {contributor.badge}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{contributor.contributions} contributions</p>
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium">Trust: {contributor.trustScore}%</p>
                    {/* Podium block */}
                    <div className={`mt-2 ${podiumHeights[i]} w-16 sm:w-20 rounded-t-lg bg-gradient-to-t ${podiumColors[i]} flex items-start justify-center pt-2`}>
                      <span className="text-white text-xs font-bold">{podiumLabels[i]}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Remaining Top 10 List */}
            <div className="space-y-1.5">
              {rest.map((contributor, i) => (
                <motion.div
                  key={contributor.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.06 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-500/5 hover:border-zinc-500/20 border border-transparent transition-all group"
                >
                  <span className="text-sm font-bold text-muted-foreground w-6 text-center shrink-0">#{contributor.rank}</span>
                  <div className={`h-8 w-8 rounded-full ${contributor.avatarBg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {contributor.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{contributor.name}</p>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${badgeStyle[contributor.badge].class}`}>
                        {badgeStyle[contributor.badge].icon} {contributor.badge}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{contributor.contributions}</span>
                  <div className="w-20 shrink-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground">Trust</span>
                      <span className="text-[10px] font-medium">{contributor.trustScore}%</span>
                    </div>
                    <Progress value={contributor.trustScore} className="h-1.5" />
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============ NEW SECTION 3: Achievement Badges ============ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="glass border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-zinc-500" />
              Achievement Badges
            </CardTitle>
            <CardDescription>Earn badges by contributing to the community</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {achievementBadges.map((badgeDef, i) => {
                const badge = { ...badgeDef, unlocked: badgeDef.test(badgeContext) }
                return (
                <motion.div
                  key={badge.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
                  className={`relative p-4 rounded-xl border text-center transition-all ${
                    badge.unlocked
                      ? 'bg-gradient-to-br from-zinc-500/10 to-transparent border-zinc-500/20 hover:border-zinc-500/40 hover:shadow-md'
                      : 'bg-muted/30 border-muted/50 opacity-60 grayscale'
                  }`}
                >
                  {/* Glow effect for unlocked */}
                  {badge.unlocked && (
                    <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_20px_rgba(16,185,129,0.08)]" />
                  )}
                  {/* Lock overlay for locked */}
                  {!badge.unlocked && (
                    <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-background/40 z-10">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="relative z-0">
                    <span className="text-3xl block mb-2">{badge.emoji}</span>
                    <p className="text-sm font-semibold">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{badge.description}</p>
                    <div className="mt-2">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${badge.unlocked ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25' : 'bg-muted/50 text-muted-foreground'}`}>
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        {badge.unlocked ? 'achieved' : 'not yet'}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============ NEW SECTION 4: Recent Activity Feed ============ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="glass border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-zinc-500" />
              Community Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-1">
                {recentActivities.map((activity, i) => {
                  const ActionIcon = activity.icon
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.06 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-500/5 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="h-8 w-8 rounded-full bg-zinc-500/10 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                        {activity.initials}
                      </div>
                      {/* Activity text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight">
                          <span className="font-semibold">{activity.user}</span>{' '}
                          <span className="text-muted-foreground">{activity.action}</span>
                        </p>
                      </div>
                      {/* Time & Icon */}
                      <div className="flex items-center gap-2 shrink-0">
                        <ActionIcon className={`h-3.5 w-3.5 ${activity.iconColor}`} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{activity.time}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============ EXISTING: Abuse Prevention Banner ============ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Community Integrity Notice</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All submissions are logged and reviewed. Deliberate false reporting, spam, or abuse will result in trust score penalties and potential account suspension. Vote responsibly based on evidence, not opinion.
                </p>
              </div>
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* EXISTING: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
          <Card className="bg-gradient-to-br from-zinc-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-500/10">
                  <CheckCircle2 className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
          <Card className="bg-gradient-to-br from-red-500/5 to-transparent border rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disputed</p>
                  <p className="text-2xl font-bold">{disputedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* EXISTING: Filter */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <Card className="border rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* EXISTING: Reports Feed */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredReports.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border rounded-xl">
                <CardContent className="p-8 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No reports match your filter</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            filteredReports.map((report, idx) => {
              const MediaIcon = mediaTypeIcon[report.mediaType]
              const statusInfo = statusBadge[report.status]
              const StatusIcon = statusInfo.icon
              const badge = badgeStyle[report.submitterBadge]

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="border rounded-xl hover:shadow-md transition-all">
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                              <MediaIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base leading-tight">{report.title}</h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusInfo.class}`}>
                                  <StatusIcon className="h-2.5 w-2.5 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.class}`}>
                                  {badge.icon} {report.submitterBadge}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{report.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {report.description}
                        </p>

                        {/* Tags */}
                        {report.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {report.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Footer: submitter, votes, consensus */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-zinc-500/20 flex items-center justify-center shrink-0">
                              <Shield className="h-3 w-3 text-zinc-500" />
                            </div>
                            <span className="text-xs font-medium">{report.submitterName}</span>
                            <span className="text-xs text-muted-foreground">Trust: {report.submitterTrustScore}%</span>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Consensus */}
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <TrendingUp className="h-3 w-3 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] text-muted-foreground">Consensus</span>
                                  <span className="text-[10px] font-medium">{report.consensusScore}%</span>
                                </div>
                                <Progress value={report.consensusScore} className="h-1.5" />
                              </div>
                            </div>

                            {/* Vote buttons */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 hover:bg-zinc-500/10 hover:text-zinc-600 hover:border-zinc-500/30"
                                onClick={() => voteOnReport(report.id, 'agree')}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                {report.agreeVotes}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30"
                                onClick={() => voteOnReport(report.id, 'disagree')}
                              >
                                <ThumbsDown className="h-3 w-3" />
                                {report.disagreeVotes}
                              </Button>
                            </div>
                          </div>
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

      {/* EXISTING: Trust Badge Legend */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
        <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-zinc-500" />
              Trust Badge Levels
            </CardTitle>
            <CardDescription>Earn reputation by contributing reliable reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(badgeStyle).map(([level, style]) => (
                <div key={level} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <span className="text-lg">{style.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{level}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {level === 'Bronze' && '0-40 trust score'}
                      {level === 'Silver' && '41-70 trust score'}
                      {level === 'Gold' && '71-90 trust score'}
                      {level === 'Platinum' && '91-100 trust score'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
