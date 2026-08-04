'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAppStore, type AnalysisHistoryItem, type RiskLevel } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Search, Download, ChevronDown, ChevronUp, Filter,
  FileText, ImageIcon, Video, CheckCircle, AlertTriangle,
  ArrowUpDown, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'

const typeIcons: Record<string, React.ElementType> = {
  text_fake_news: FileText,
  image_forensics: ImageIcon,
  video_deepfake: Video,
  fact_check: CheckCircle,
  image_reverse_search: Search,
}

const typeLabels: Record<string, string> = {
  text_fake_news: 'Text Analysis',
  image_forensics: 'Image Forensics',
  video_deepfake: 'Video Deepfake',
  fact_check: 'Fact Check',
  image_reverse_search: 'Reverse Search',
}

const riskBadgeClass: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
}

const statusBadgeClass: Record<string, string> = {
  completed: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  processing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  pending: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/25',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
}

export function HistoryTab() {
  const { analysisHistory, analysisHistoryTotal, analysisHistoryPage, analysisHistoryLoading, fetchAnalysisHistory } = useAppStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<string>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  const loadHistory = useCallback(() => {
    fetchAnalysisHistory({
      type: filterType !== 'all' ? filterType : undefined,
      riskLevel: filterRisk !== 'all' ? filterRisk : undefined,
      search: searchTerm || undefined,
      page: currentPage,
      limit,
      sortBy,
      sortOrder,
    })
  }, [fetchAnalysisHistory, filterType, filterRisk, searchTerm, currentPage, sortBy, sortOrder])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const totalPages = Math.ceil(analysisHistoryTotal / limit)

  const exportCSV = () => {
    if (analysisHistory.length === 0) {
      toast.error('No data to export')
      return
    }
    const headers = ['Date', 'Type', 'Trust Score', 'Risk Level', 'Status', 'Summary', 'File Name', 'Processing Time (ms)']
    const rows = analysisHistory.map((item) => [
      new Date(item.createdAt).toLocaleString(),
      typeLabels[item.analysisType] || item.analysisType,
      item.trustScore?.toString() || 'N/A',
      item.riskLevel || 'N/A',
      item.status,
      `"${(item.explanation || '').replace(/"/g, '""').slice(0, 200)}"`,
      item.mediaFileName,
      item.processingTime?.toString() || 'N/A',
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `truthshield-analysis-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported successfully')
  }

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterType('all')
    setFilterRisk('all')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || filterType !== 'all' || filterRisk !== 'all'

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-zinc-500/5 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-lg bg-zinc-500/10">
                <Clock className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Analysis History</h2>
                <p className="text-sm text-muted-foreground">
                  View and manage all past analyses - {analysisHistoryTotal} total records
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border rounded-xl hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search analyses..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="text_fake_news">Text Analysis</SelectItem>
                  <SelectItem value="image_forensics">Image Forensics</SelectItem>
                  <SelectItem value="video_deepfake">Video Deepfake</SelectItem>
                  <SelectItem value="fact_check">Fact Check</SelectItem>
                  <SelectItem value="image_reverse_search">Reverse Search</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterRisk} onValueChange={(v) => { setFilterRisk(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" onClick={exportCSV} className="shrink-0 gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border rounded-xl hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-500" />
              Results
            </CardTitle>
            <CardDescription>
              Showing {analysisHistory.length} of {analysisHistoryTotal} analyses
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            {analysisHistoryLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : analysisHistory.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                          <div className="flex items-center gap-1">
                            Date
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('trustScore')}>
                          <div className="flex items-center gap-1">
                            Trust Score
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('riskLevel')}>
                          <div className="flex items-center gap-1">
                            Risk
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Summary</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {analysisHistory.map((item) => (
                          <HistoryRow
                            key={item.id}
                            item={item}
                            isExpanded={expandedId === item.id}
                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function HistoryRow({ item, isExpanded, onToggle }: { item: AnalysisHistoryItem; isExpanded: boolean; onToggle: () => void }) {
  const TypeIcon = typeIcons[item.analysisType] || FileText
  const typeLabel = typeLabels[item.analysisType] || item.analysisType

  return (
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm">{new Date(item.createdAt).toLocaleDateString()}</span>
          <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString()}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TypeIcon className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="text-sm hidden sm:inline">{typeLabel}</span>
          <span className="text-sm sm:hidden">{typeLabel.split(' ')[0]}</span>
        </div>
      </TableCell>
      <TableCell>
        {item.trustScore !== null ? (
          <div className="flex items-center gap-2">
            <div className="w-10 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  item.trustScore >= 70 ? 'bg-zinc-500' :
                  item.trustScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${item.trustScore}%` }}
              />
            </div>
            <span className="text-sm font-medium">{item.trustScore}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">N/A</span>
        )}
      </TableCell>
      <TableCell>
        {item.riskLevel ? (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskBadgeClass[item.riskLevel] || ''}`}>
            {item.riskLevel}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground"> - </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass[item.status] || ''}`}>
          {item.status}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="text-sm text-muted-foreground truncate block max-w-[250px]">
          {item.explanation ? item.explanation.slice(0, 80) + (item.explanation.length > 80 ? '...' : '') : 'No summary'}
        </span>
      </TableCell>
      <TableCell>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </TableCell>
    </TableRow>
    // Expanded detail row
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted/30 mb-4">
        <Clock className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No Analysis History</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Your analysis history will appear here once you start analyzing content. Try running a text analysis, image forensics check, or fact verification.
      </p>
    </div>
  )
}
