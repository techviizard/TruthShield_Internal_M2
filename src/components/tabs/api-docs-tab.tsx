'use client'

import { useState, useEffect} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Copy, Check, ChevronDown, ChevronRight, Key, Zap,
  Shield, Clock, AlertTriangle, Globe, Terminal, Code2,
  Webhook, Lock, RefreshCw, ArrowRight, ExternalLink,
  GitBranch, FileCode, Server, Code,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ── Copy Button Helper ──────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 hover:text-white transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-zinc-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// ── Code Block Component ────────────────────────────────────────────────────
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 left-3 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
        {language}
      </div>
      <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg p-4 pt-7 font-mono text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

// ── Method Badge ────────────────────────────────────────────────────────────
function MethodBadge({ method }: { method: 'GET' | 'POST' | 'DELETE' }) {
  const colors = {
    POST: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
    GET: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    DELETE: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  }
  return (
    <Badge className={`font-mono text-xs font-bold px-2.5 py-0.5 border ${colors[method]}`}>
      {method}
    </Badge>
  )
}

// ── Parameter Table Row ─────────────────────────────────────────────────────
interface Param {
  name: string
  type: string
  required: boolean
  description: string
}

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Type</th>
            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Required</th>
            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={p.name} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
              <td className="px-4 py-2.5 font-mono text-zinc-600 dark:text-zinc-400 text-xs">{p.name}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.type}</td>
              <td className="px-4 py-2.5">
                {p.required ? (
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-1.5 py-0">Required</Badge>
                ) : (
                  <Badge className="bg-zinc-500/10 text-zinc-500 text-[10px] px-1.5 py-0">Optional</Badge>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Expandable Endpoint Card ────────────────────────────────────────────────
interface EndpointData {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  title: string
  description: string
  params: Param[]
  requestExample: string
  requestLanguage: string
  responseExample: string
}

function EndpointCard({ endpoint, index, apiBase }: { endpoint: EndpointData; index: number; apiBase: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="glass overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <CardHeader className="pb-0">
            <div className="flex items-center gap-3">
              <MethodBadge method={endpoint.method} />
              <code className="font-mono text-sm font-semibold">{endpoint.path}</code>
              <div className="flex-1" />
              <motion.div
                animate={{ rotate: expanded ? 0 : -90 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
          </CardHeader>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-4 space-y-5">
                {/* Parameters */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-zinc-500" />
                    Parameters
                  </h4>
                  <ParamTable params={endpoint.params} />
                </div>

                {/* Request Example */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-blue-500" />
                    Request Example
                  </h4>
                  <CodeBlock code={endpoint.requestExample.replaceAll('{{BASE}}', apiBase)} language={endpoint.requestLanguage} />
                </div>

                {/* Response Example */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Server className="h-4 w-4 text-zinc-500" />
                    Response Example
                  </h4>
                  <CodeBlock code={endpoint.responseExample} language="json" />
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ── Endpoints Data ──────────────────────────────────────────────────────────
const endpoints: EndpointData[] = [
  {
    method: 'POST',
    path: '/api/analyze/text',
    title: 'Analyze Text',
    description: 'Analyze text content for misinformation, propaganda, and fake news indicators using advanced NLP models.',
    params: [
      { name: 'text', type: 'string', required: true, description: 'The text content to analyze (min 10 chars, max 50,000 chars)' },
      { name: 'language', type: 'string', required: false, description: 'ISO 639-1 language code (default: "en", supports: hi, ta, te, bn, mr)' },
    ],
    requestLanguage: 'bash',
    requestExample: `curl -X POST {{BASE}}/analyze/text \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Breaking: New study reveals shocking health claims...",
    "language": "en"
  }'`,
    responseExample: `{
  "success": true,
  "reportId": "RPT-2024-0847",
  "analysis": {
    "trustScore": 28,
    "riskLevel": "high",
    "confidence": 0.87,
    "flags": ["factual_error", "propaganda", "emotional_manipulation"],
    "explanation": "This text exhibits multiple indicators of misinformation...",
    "recommendations": [
      "Cross-reference claims with verified sources",
      "Check original source attribution"
    ],
    "details": {
      "sentiment": { "overall": "Fear/Anger", "score": 0.82 },
      "claimsExtracted": ["Claim about government policy"],
      "propagandaTechniques": ["Appeal to fear", "False authority"]
    }
  },
  "processingTime": 2340
}`,
  },
  {
    method: 'POST',
    path: '/api/analyze/image',
    title: 'Image Forensics',
    description: 'Perform forensic analysis on images to detect AI generation, manipulation, and editing artifacts.',
    params: [
      { name: 'image', type: 'file', required: true, description: 'Image file (JPEG, PNG, WebP; max 20MB)' },
      { name: 'sensitivity', type: 'string', required: false, description: 'Analysis sensitivity level: "low", "medium" (default), "high"' },
    ],
    requestLanguage: 'bash',
    requestExample: `curl -X POST {{BASE}}/analyze/image \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx" \\
  -F "image=@suspicious_photo.jpg" \\
  -F "sensitivity=high"`,
    responseExample: `{
  "success": true,
  "reportId": "RPT-2024-0848",
  "analysis": {
    "trustScore": 35,
    "confidence": 0.82,
    "flags": ["clone_detection", "noise_inconsistency", "jpeg_artifact_mismatch"],
    "details": {
      "aiGenerationProbability": 0.72,
      "manipulationIndicators": [
        "Cloned regions detected in background",
        "Inconsistent noise patterns"
      ],
      "metadataAnalysis": {
        "anomalies": ["Camera metadata stripped", "Software: Adobe Photoshop"],
        "editingSoftware": "Adobe Photoshop 2024"
      }
    },
    "recommendations": [
      "Request original unedited version",
      "Perform reverse image search"
    ]
  },
  "processingTime": 4520
}`,
  },
  {
    method: 'POST',
    path: '/api/analyze/video',
    title: 'Video Deepfake Detection',
    description: 'Detect deepfake content in videos through frame-by-frame analysis, face verification, and audio-visual sync checks.',
    params: [
      { name: 'video', type: 'file', required: true, description: 'Video file (MP4, AVI, MOV; max 100MB)' },
      { name: 'frame_sampling', type: 'integer', required: false, description: 'Frames to sample per second (default: 2, range: 1-10)' },
    ],
    requestLanguage: 'bash',
    requestExample: `curl -X POST {{BASE}}/analyze/video \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx" \\
  -F "video=@political_speech.mp4" \\
  -F "frame_sampling=3"`,
    responseExample: `{
  "success": true,
  "reportId": "RPT-2024-0849",
  "analysis": {
    "trustScore": 22,
    "riskLevel": "critical",
    "confidence": 0.91,
    "flags": ["face_swap_detected", "lip_sync_anomaly"],
    "details": {
      "deepfakeProbability": 0.78,
      "faceAnalysis": {
        "facesDetected": 2,
        "manipulationIndicators": ["Inconsistent blink rate", "Mouth movement mismatch"],
        "skinTextureConsistency": false
      },
      "temporalAnalysis": {
        "frameConsistency": 0.65,
        "sceneTransitions": 3
      },
      "audioVisualSync": {
        "lipSyncScore": 71,
        "audioContinuity": true
      }
    }
  },
  "processingTime": 12800
}`,
  },
  {
    method: 'POST',
    path: '/api/factcheck',
    title: 'Fact Check',
    description: 'Verify claims against a database of fact-checks and perform real-time web verification using AI-powered analysis.',
    params: [
      { name: 'claim', type: 'string', required: true, description: 'The claim or statement to fact-check' },
      { name: 'language', type: 'string', required: false, description: 'ISO 639-1 language code (default: "en")' },
      { name: 'sources', type: 'string[]', required: false, description: 'Preferred source domains to search (max 5)' },
    ],
    requestLanguage: 'bash',
    requestExample: `curl -X POST {{BASE}}/factcheck \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "claim": "COVID-19 vaccines contain microchips for tracking",
    "language": "en",
    "sources": ["reuters.com", "apnews.com"]
  }'`,
    responseExample: `{
  "success": true,
  "reportId": "RPT-2024-0850",
  "factCheck": {
    "verdict": "false",
    "confidence": 0.98,
    "explanation": "This claim has been thoroughly debunked by multiple...",
    "sources": [
      {
        "name": "Reuters Fact Check",
        "url": "https://www.reuters.com/fact-check/...",
        "snippet": "No microchips in COVID-19 vaccines..."
      },
      {
        "name": "AP News Verification",
        "url": "https://apnews.com/article/...",
        "snippet": "False claims about vaccine tracking..."
      }
    ]
  },
  "processingTime": 3150
}`,
  },
  {
    method: 'GET',
    path: '/api/analysis/history',
    title: 'Analysis History',
    description: 'Retrieve paginated history of past analyses with filtering and sorting capabilities.',
    params: [
      { name: 'page', type: 'integer', required: false, description: 'Page number (default: 1)' },
      { name: 'limit', type: 'integer', required: false, description: 'Items per page (default: 20, max: 100)' },
      { name: 'type', type: 'string', required: false, description: 'Filter by analysis type: "text", "image", "video", "factcheck"' },
      { name: 'sortBy', type: 'string', required: false, description: 'Sort field: "createdAt" (default), "trustScore", "riskLevel"' },
    ],
    requestLanguage: 'bash',
    requestExample: `curl -X GET "{{BASE}}/analysis/history?page=1&limit=20&type=text&sortBy=createdAt" \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx"`,
    responseExample: `{
  "success": true,
  "items": [
    {
      "id": "RPT-2024-0847",
      "createdAt": "2024-01-21T10:30:00Z",
      "analysisType": "text",
      "trustScore": 28,
      "riskLevel": "high",
      "status": "completed",
      "explanation": "Multiple misinformation indicators detected"
    }
  ],
  "total": 248,
  "page": 1,
  "limit": 20,
  "totalPages": 13
}`,
  },
  {
    method: 'GET',
    path: '/api/dashboard/stats',
    title: 'Dashboard Statistics',
    description: 'Get aggregated platform statistics including analysis counts, threat metrics, and trend data.',
    params: [
      { name: 'period', type: 'string', required: false, description: 'Time period: "24h", "7d" (default), "30d", "90d"' },
    ],
    requestLanguage: 'bash',
    requestExample: `curl -X GET "{{BASE}}/dashboard/stats?period=7d" \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx"`,
    responseExample: `{
  "success": true,
  "totalAnalyses": 12847,
  "fakeNewsDetected": 3291,
  "deepfakesDetected": 847,
  "imagesAnalyzed": 5123,
  "avgTrustScore": 67.3,
  "activeAlerts": 23,
  "trendData": [
    { "date": "2024-01-15", "analyses": 2100, "threats": 580 }
  ],
  "riskDistribution": [
    { "level": "Critical", "count": 847 },
    { "level": "High", "count": 2103 },
    { "level": "Medium", "count": 4521 },
    { "level": "Low", "count": 5376 }
  ]
}`,
  },
]

// ── Error Codes Data ────────────────────────────────────────────────────────
const errorCodes = [
  { code: 200, name: 'Success', description: 'The request was processed successfully.', example: '{ "success": true, "data": { ... } }' },
  { code: 400, name: 'Bad Request', description: 'Missing or invalid parameters in the request.', example: '{ "error": "Missing required field: text", "code": 400 }' },
  { code: 401, name: 'Unauthorized', description: 'Invalid or missing authentication token.', example: '{ "error": "Invalid API key", "code": 401 }' },
  { code: 403, name: 'Forbidden', description: 'Insufficient permissions to access this resource.', example: '{ "error": "Upgrade to Pro for this endpoint", "code": 403 }' },
  { code: 404, name: 'Not Found', description: 'The requested resource or endpoint does not exist.', example: '{ "error": "Endpoint not found", "code": 404 }' },
  { code: 429, name: 'Rate Limited', description: 'Too many requests. Please retry after the reset time.', example: '{ "error": "Rate limit exceeded. Retry after 3600s", "code": 429 }' },
  { code: 500, name: 'Server Error', description: 'An internal server error occurred. Please try again later.', example: '{ "error": "Internal server error", "code": 500 }' },
]

// ── SDK Data ────────────────────────────────────────────────────────────────
const sdks = [
  {
    name: 'Python',
    icon: '🐍',
    color: 'from-yellow-500/20 to-blue-500/20',
    badgeColor: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    install: 'pip install truthshield-sdk',
    version: 'v1.2.0',
    updated: 'Jan 15, 2024',
  },
  {
    name: 'JavaScript / Node.js',
    icon: '🟢',
    color: 'from-green-500/20 to-zinc-500/20',
    badgeColor: 'bg-green-500/15 text-green-600 dark:text-green-400',
    install: 'npm install @truthshield/sdk',
    version: 'v1.1.3',
    updated: 'Jan 12, 2024',
  },
  {
    name: 'cURL',
    icon: '🔧',
    color: 'from-zinc-500/20 to-zinc-600/20',
    badgeColor: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    install: '# No installation needed — use directly',
    version: 'N/A',
    updated: 'Always latest',
  },
  {
    name: 'Java',
    icon: '☕',
    color: 'from-red-500/20 to-orange-500/20',
    badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400',
    install: 'implementation \'ai.truthshield:sdk:1.1.0\'',
    version: 'v1.1.0',
    updated: 'Jan 5, 2024',
  },
]

// ── Webhook Events ──────────────────────────────────────────────────────────
const webhookEvents = [
  { event: 'analysis.completed', description: 'Triggered when any analysis finishes processing' },
  { event: 'analysis.failed', description: 'Triggered when an analysis encounters an error' },
  { event: 'alert.critical', description: 'Triggered when a critical-level alert is generated' },
  { event: 'alert.high', description: 'Triggered when a high-severity alert is generated' },
  { event: 'investigation.updated', description: 'Triggered when an investigation case is modified' },
]

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
export function ApiDocsTab() {
  // Real base URL of this deployment (APP_URL in the central config).
  const [apiBase, setApiBase] = useState('/api')
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    let aborted = false
    fetch('/api/config')
      .then((r) => r.json())
      .then((j) => {
        if (aborted || !j?.success) return
        setApiBase(`${j.config.env.appUrl.replace(/\/$/, '')}/api`)
        setAppVersion(`v${j.config.app.version}`)
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── 1. API Overview Section ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass overflow-hidden">
          <div className="relative">
            {/* Decorative gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 via-zinc-500/5 to-cyan-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-zinc-500/10">
                      <BookOpen className="h-6 w-6 text-zinc-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold">TruthShield API Documentation</CardTitle>
                  </div>
                  <p className="text-muted-foreground max-w-xl">
                    RESTful API for integrating deepfake detection and fact verification into your applications.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs h-8 px-3 flex items-center">
                  <Key className="h-3 w-3 mr-1.5" />
                  Self-hosted — no API key issuance
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30 font-mono text-xs">
                  <Globe className="h-3 w-3 mr-1.5" />
                  {apiBase}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  <GitBranch className="h-3 w-3 mr-1.5" />
                  {appVersion}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  <Lock className="h-3 w-3 mr-1.5" />
                  No auth (single-tenant)
                </Badge>
              </div>
            </CardContent>
          </div>
        </Card>
      </motion.div>

      {/* ── 2. Quick Start Guide ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-500/10">
                <Zap className="h-5 w-5 text-zinc-500" />
              </div>
              <CardTitle className="text-xl">Quick Start Guide</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 font-bold text-sm shrink-0">
                  1
                </div>
                <h3 className="font-semibold">Configure the deployment</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                This build is self-hosted and single-tenant: the HTTP API has no authentication layer yet.
                Provider credentials are set once in <code>.env.local</code> and resolved by
                <code> src/config/app.config.ts</code>.
              </p>
              <div className="ml-10">
                <CodeBlock
                  code={`# .env.local\nAI_PROVIDER=openai\nAI_API_KEY=sk-...\nSEARCH_PROVIDER=none\n\n# verify everything is wired:\ncurl ${apiBase}`}
                  language="bash"
                />
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 font-bold text-sm shrink-0">
                  2
                </div>
                <h3 className="font-semibold">Make your first request</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                Use your API key to analyze text content for misinformation.
              </p>
              <div className="ml-10">
                <CodeBlock
                  code={`curl -X POST ${apiBase}/analyze/text \\
  -H "Authorization: Bearer dsk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Breaking news: Scientists discover miracle cure..."
  }'`}
                  language="bash"
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 font-bold text-sm shrink-0">
                  3
                </div>
                <h3 className="font-semibold">Handle the response</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                The API returns a structured JSON response with the analysis results.
              </p>
              <div className="ml-10">
                <CodeBlock
                  code={`{
  "success": true,
  "reportId": "RPT-2024-0847",
  "analysis": {
    "trustScore": 28,
    "riskLevel": "high",
    "confidence": 0.87,
    "flags": ["factual_error", "propaganda"],
    "explanation": "Multiple misinformation indicators detected..."
  },
  "processingTime": 2340
}`}
                  language="json"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 3. API Endpoints Section ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-zinc-500/10">
            <FileCode className="h-5 w-5 text-zinc-500" />
          </div>
          <h2 className="text-xl font-bold">API Endpoints</h2>
          <Badge variant="outline" className="font-mono text-xs">6 endpoints</Badge>
        </div>
        <div className="space-y-4">
          {endpoints.map((ep, i) => (
            <EndpointCard key={ep.path} endpoint={ep} index={i} apiBase={apiBase} />
          ))}
        </div>
      </motion.div>

      {/* ── 4. Authentication Section ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-500/10">
                <Shield className="h-5 w-5 text-zinc-500" />
              </div>
              <CardTitle className="text-xl">Authentication</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="font-semibold mb-2">Authentication status</h4>
              <p className="text-sm text-muted-foreground mb-4">
                All API requests require a Bearer token in the Authorization header. You can generate and manage
                API keys from your TruthShield dashboard.
              </p>
              <CodeBlock
                code={`# Include the token in every request\nAuthorization: Bearer dsk_live_xxxxxxxxxxxx`}
                language="http"
              />
            </div>

            <div>
              <h4 className="font-semibold mb-3">Token Management</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm font-medium">Generation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Create new API keys from your dashboard settings.</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Revocation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Revoke compromised keys immediately. Old keys stop working within seconds.</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Rotation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Rotate keys periodically for security. Generate a new key, update your app, then revoke the old one.</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Rate Limits by Tier</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-4 text-center">
                  <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 mb-2">Free</Badge>
                  <p className="text-sm font-semibold">100 req/day</p>
                  <p className="text-xs text-muted-foreground">10 req/min</p>
                </div>
                <div className="rounded-lg border border-zinc-500/30 p-4 text-center bg-zinc-500/5">
                  <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 mb-2">Pro</Badge>
                  <p className="text-sm font-semibold">10,000 req/day</p>
                  <p className="text-xs text-muted-foreground">100 req/min</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-2">Enterprise</Badge>
                  <p className="text-sm font-semibold">Unlimited</p>
                  <p className="text-xs text-muted-foreground">1,000 req/min</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 5. Rate Limits Section ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <CardTitle className="text-xl">Rate Limits</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Rate Limits Table */}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tier</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Daily Limit</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Per-Minute Limit</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-4 py-3"><Badge variant="outline">Free</Badge></td>
                    <td className="px-4 py-3 font-mono">100</td>
                    <td className="px-4 py-3 font-mono">10</td>
                    <td className="px-4 py-3 text-muted-foreground">$0/mo</td>
                  </tr>
                  <tr className="border-t bg-zinc-500/5">
                    <td className="px-4 py-3"><Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">Pro</Badge></td>
                    <td className="px-4 py-3 font-mono">10,000</td>
                    <td className="px-4 py-3 font-mono">100</td>
                    <td className="px-4 py-3 text-muted-foreground">$49/mo</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-3"><Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400">Enterprise</Badge></td>
                    <td className="px-4 py-3 font-mono">Unlimited</td>
                    <td className="px-4 py-3 font-mono">1,000</td>
                    <td className="px-4 py-3 text-muted-foreground">Custom</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Current Usage */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Current Usage (Free Tier)</h4>
                <Badge variant="outline" className="font-mono text-xs">45 / 100</Badge>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-zinc-500 to-zinc-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '45%' }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                55 requests remaining today. Resets at midnight UTC.
              </p>
            </div>

            {/* Rate Limit Headers */}
            <div>
              <h4 className="font-semibold mb-3">Rate Limit Response Headers</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <code className="font-mono text-xs text-zinc-600 dark:text-zinc-400 shrink-0">X-RateLimit-Limit</code>
                  <p className="text-xs text-muted-foreground">Maximum number of requests allowed in the current period.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <code className="font-mono text-xs text-zinc-600 dark:text-zinc-400 shrink-0">X-RateLimit-Remaining</code>
                  <p className="text-xs text-muted-foreground">Number of requests remaining in the current period.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <code className="font-mono text-xs text-zinc-600 dark:text-zinc-400 shrink-0">X-RateLimit-Reset</code>
                  <p className="text-xs text-muted-foreground">Unix timestamp when the rate limit period resets.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 6. SDKs & Libraries Section ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-zinc-500/10">
            <Code className="h-5 w-5 text-zinc-500" />
          </div>
          <h2 className="text-xl font-bold">SDKs & Libraries</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sdks.map((sdk, i) => (
            <motion.div
              key={sdk.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              <Card className="glass hover:border-zinc-500/30 transition-colors h-full">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{sdk.icon}</span>
                    <div>
                      <h3 className="font-semibold">{sdk.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`${sdk.badgeColor} text-[10px]`}>{sdk.version}</Badge>
                        <span className="text-[10px] text-muted-foreground">Updated {sdk.updated}</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                      <code>{sdk.install}</code>
                    </pre>
                    <CopyButton text={sdk.install} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── 7. Error Codes Section ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <CardTitle className="text-xl">Error Codes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Example Response</th>
                  </tr>
                </thead>
                <tbody>
                  {errorCodes.map((err, i) => (
                    <tr key={err.code} className={i % 2 === 0 ? 'border-t' : 'border-t bg-muted/20'}>
                      <td className="px-4 py-3">
                        <Badge className={
                          err.code >= 500 ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                          err.code >= 400 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                          'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
                        }>
                          {err.code}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{err.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{err.description}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">{err.example}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 8. Webhooks Section ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-500/10">
                <Webhook className="h-5 w-5 text-zinc-500" />
              </div>
              <CardTitle className="text-xl">Webhooks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="font-semibold mb-2">Available Events</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Receive real-time notifications when key events occur in your TruthShield account.
              </p>
              <div className="space-y-2">
                {webhookEvents.map((evt) => (
                  <div key={evt.event} className="flex items-start gap-3 p-3 rounded-lg border hover:border-zinc-500/30 transition-colors">
                    <code className="font-mono text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 px-2 py-0.5 rounded shrink-0">
                      {evt.event}
                    </code>
                    <span className="text-sm text-muted-foreground">{evt.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Setup</h4>
              <CodeBlock
                code={`# Register a webhook endpoint\ncurl -X POST {{BASE}}/webhooks \\
  -H "Authorization: Bearer dsk_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/api/webhooks/truthshield",
    "events": ["analysis.completed", "alert.critical"],
    "secret": "whsec_your_webhook_signing_secret"
  }'`}
                language="bash"
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Payload Format</h4>
              <CodeBlock
                code={`{
  "id": "evt_1a2b3c4d5e6f",
  "type": "analysis.completed",
  "timestamp": "2024-01-21T10:30:00Z",
  "data": {
    "reportId": "RPT-2024-0847",
    "analysisType": "text",
    "trustScore": 28,
    "riskLevel": "high",
    "flags": ["factual_error", "propaganda"]
  },
  "signature": "sha256=abcdef1234567890..."
}`}
                language="json"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4 text-zinc-500" />
              <span>Webhook payloads are signed using HMAC-SHA256 for verification.</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center py-6"
      >
        <p className="text-muted-foreground text-sm mb-4">
          Ready to integrate TruthShield into your application?
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.open('/api', '_blank')}>
            <Key className="h-4 w-4 mr-2" />
            Check integration status
          </Button>
          <Button variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            View on GitHub
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
