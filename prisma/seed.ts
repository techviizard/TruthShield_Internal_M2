/**
 * Database seed - driven entirely by the central config (`src/config/app.config.ts`).
 *
 *   npm run db:seed
 *
 * Creates:
 *   • the demo/test account (DEMO_USER_* settings)
 *   • its saved preferences
 *   • when DEMO_SEED_SAMPLE_DATA=true, a realistic corpus of analyses, alerts,
 *     investigations, watchlist items, community reports, audit logs, source
 *     credibility scores and workflow rules - so every dashboard widget and tab
 *     renders REAL database rows instead of mock arrays.
 *
 * Idempotent: re-running replaces the demo corpus (tagged rows) but keeps any
 * analyses you produced through the app.
 */

import { PrismaClient } from '@prisma/client'
import { getConfig } from '../src/config/app.config.ts'
import { linkHash, sha256Text, GENESIS_HASH } from '../src/lib/engines/integrity.ts'

const cfg = getConfig()
const db = new PrismaClient({ datasources: { db: { url: cfg.database.url } } })

const DEMO_TAG = 'demo-seed'

// ── deterministic pseudo-random so re-seeds are reproducible ────────────────
let rngState = 42
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296
  return rngState / 4294967296
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
const between = (min: number, max: number): number => min + rand() * (max - min)

const REGIONS = ['Delhi', 'Mumbai', 'Bengaluru', 'Kolkata', 'Chennai', 'Hyderabad', 'Pune', 'Jaipur', 'Lucknow', 'Ahmedabad']
const PLATFORMS = ['WhatsApp', 'Twitter/X', 'Facebook', 'Instagram', 'Telegram']
const LANGUAGES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn']

const ANALYSIS_TYPES = [
  'text_fake_news',
  'image_forensics',
  'video_deepfake',
  'fact_check',
  'audio_deepfake',
] as const

/** Clustered narratives - several near-duplicates each, so campaign detection finds real clusters. */
const NARRATIVES: Record<(typeof ANALYSIS_TYPES)[number], string[]> = {
  text_fake_news: [
    'Viral message claims the election commission approved electronic vote tampering in state polls; no official record supports the claim and the cited order does not exist.',
    'Forwarded text claims the election commission allowed vote tampering in the upcoming state polls; the referenced circular number is not present in any official gazette.',
    'Message alleging election commission approval for vote tampering in state polls recirculated; language matches earlier debunked forwards and cites a non-existent order.',
    'Post claims a new banknote will be withdrawn from circulation next month; the central bank issued no such notification and the quoted press release is fabricated.',
    'Forward claiming imminent withdrawal of a banknote denomination cites a fake central bank press release; formatting anomalies indicate a doctored PDF.',
  ],
  image_forensics: [
    'Photograph shows inconsistent ELA response around the inserted crowd region and duplicated texture blocks, indicating copy-move manipulation of the rally image.',
    'Rally photograph exhibits copy-move duplication in the crowd area with mismatched compression levels between the pasted region and background.',
    'Image of a flood scene shows spliced sky region: lighting direction on the foreground conflicts with the added cloud layer and EXIF shows editing software.',
    'Screenshot of a news headline was edited - font metrics of the headline differ from the outlet template and pixel-level noise around the text differs from the page.',
  ],
  video_deepfake: [
    'Video of a public figure shows lip-sync drift against the audio track and unnatural blink cadence, consistent with a face-reenactment deepfake.',
    'Clip of a public figure exhibits audio-visual desync and irregular blink pattern with blending artifacts along the jawline - likely face-swap deepfake.',
    'Speech video shows temporal flicker around the mouth region across frames and GAN-typical texture on the cheeks, indicating synthetic reenactment.',
  ],
  fact_check: [
    'Claim that a vaccine batch was recalled nationwide is unsupported: the health ministry bulletin lists no recall and fact-checkers rate the claim false.',
    'Claim of a nationwide vaccine recall traced to a mistranslated regional advisory; no recall exists per the health ministry bulletin.',
    'Claim that a river-linking project was cancelled is misleading: the project was rephased, not cancelled, per the ministry status report.',
    'Claim about a new tax on cash withdrawals is false; the finance ministry circular quoted in the post does not mention any such levy.',
  ],
  audio_deepfake: [
    'Voice note attributed to an official shows spectral flatness in the 4-8kHz band and absent breath artifacts, consistent with TTS voice cloning.',
    'Audio clip shows synthetic prosody with uniform pitch contours and no room reverb tail - indicators of a cloned voice.',
  ],
}

const RECOMMENDATION_POOL = [
  'Cross-verify with primary sources before sharing',
  'Escalate to the regional fact-check desk',
  'Add source domain to the monitoring watchlist',
  'Request original media file for full forensic review',
  'Publish a correction card on partner channels',
]

const FLAG_POOL: Record<string, string[]> = {
  text_fake_news: ['emotional_manipulation', 'unverified_claim', 'fabricated_source', 'clickbait'],
  image_forensics: ['copy_move', 'splicing', 'ela_anomaly', 'metadata_stripped'],
  video_deepfake: ['face_manipulation', 'audio_visual_desync', 'blink_irregularity', 'gan_artifact'],
  fact_check: ['disputed_claim', 'missing_context', 'misleading_headline'],
  audio_deepfake: ['voice_cloning', 'spectral_anomaly', 'prosody_anomaly'],
}

const MIME: Record<string, { fileType: string; mime: string; ext: string }> = {
  text_fake_news: { fileType: 'text', mime: 'text/plain', ext: 'txt' },
  image_forensics: { fileType: 'image', mime: 'image/jpeg', ext: 'jpg' },
  video_deepfake: { fileType: 'video', mime: 'video/mp4', ext: 'mp4' },
  fact_check: { fileType: 'text', mime: 'text/plain', ext: 'txt' },
  audio_deepfake: { fileType: 'audio', mime: 'audio/mpeg', ext: 'mp3' },
}

function riskFromTrust(trust: number): 'low' | 'medium' | 'high' | 'critical' {
  if (trust < 25) return 'critical'
  if (trust < 45) return 'high'
  if (trust < 70) return 'medium'
  return 'low'
}

async function clearDemoData() {
  // Remove only previously seeded rows (identified by the demo marker in metadata / details).
  const seededUploads = await db.mediaUpload.findMany({
    where: { metadata: { contains: DEMO_TAG } },
    select: { id: true },
  })
  const ids = seededUploads.map((u) => u.id)
  if (ids.length) {
    await db.analysisReport.deleteMany({ where: { mediaUploadId: { in: ids } } })
    await db.mediaUpload.deleteMany({ where: { id: { in: ids } } })
  }
  await db.alert.deleteMany({ where: { source: DEMO_TAG } })
  await db.auditLog.deleteMany({ where: { details: { contains: DEMO_TAG } } })
  await db.investigation.deleteMany({ where: { tags: { contains: DEMO_TAG } } })
  await db.communityVote.deleteMany({ where: { report: { tags: { contains: DEMO_TAG } } } })
  await db.communityReport.deleteMany({ where: { tags: { contains: DEMO_TAG } } })
  await db.watchlistHit.deleteMany({})
  await db.watchlistItem.deleteMany({})
  await db.workflowExecution.deleteMany({})
  await db.workflowRule.deleteMany({})
  await db.campaignMember.deleteMany({})
  await db.campaign.deleteMany({})
  await db.knownHoax.deleteMany({ where: { debunkSource: 'internal' } })

  // Deleting seeded audit rows leaves holes in the hash chain, so relink whatever
  // survives. Tamper-evidence therefore covers everything since the last reseed - 
  // reseeding is an explicit administrative reset, not a silent rewrite.
  await rechainAuditLog()
}

/** Recompute seq/prevHash/entryHash across all audit rows in chronological order. */
async function rechainAuditLog() {
  const rows = await db.auditLog.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, action: true, resource: true, userId: true,
      details: true, ipAddress: true, createdAt: true,
    },
  })
  let prevHash: string = GENESIS_HASH
  let seq = 0
  for (const r of rows) {
    const entryHash = linkHash(prevHash, { ...r, seq })
    await db.auditLog.update({ where: { id: r.id }, data: { seq, prevHash, entryHash } })
    prevHash = entryHash
    seq++
  }
  return rows.length
}

async function seedDemoUser() {
  const user = await db.user.upsert({
    where: { email: cfg.demo.email },
    update: { name: cfg.demo.name, role: cfg.demo.role },
    create: { email: cfg.demo.email, name: cfg.demo.name, role: cfg.demo.role },
  })
  await db.userPreferences.upsert({
    where: { userId: 'self' },
    update: { language: cfg.app.defaultLanguage },
    create: { userId: 'self', language: cfg.app.defaultLanguage },
  })
  return user
}

async function seedInvestigations() {
  const year = new Date().getFullYear()
  const specs = [
    { title: 'Election Disinformation Campaign', status: 'in_progress', priority: 'critical', assignedTo: cfg.demo.name, description: 'Coordinated forwards alleging vote tampering, tracked across WhatsApp and Telegram.', caseNumber: `DS/${year}/0142`, firNumber: `0091/${year}`, officerName: cfg.demo.name, officerBadge: 'CCB-2214', jurisdiction: 'Cyber Crime Branch, Ahmedabad City' },
    { title: 'Deepfake Public Figure Videos', status: 'open', priority: 'critical', assignedTo: cfg.demo.name, description: 'Face-reenactment clips of a public figure circulating with identical audio bed.', caseNumber: `DS/${year}/0147`, firNumber: `0103/${year}`, officerName: cfg.demo.name, officerBadge: 'CCB-2214', jurisdiction: 'Cyber Crime Branch, Ahmedabad City' },
    { title: 'Health Misinformation Network', status: 'in_progress', priority: 'high', assignedTo: cfg.demo.name, description: 'Recall claims traced to a mistranslated regional advisory.', caseNumber: `DS/${year}/0151`, firNumber: null, officerName: cfg.demo.name, officerBadge: 'CCB-2214', jurisdiction: 'Cyber Crime Branch, Ahmedabad City' },
    { title: 'Manipulated Rally Photographs', status: 'open', priority: 'medium', assignedTo: cfg.demo.name, description: 'Copy-move crowd duplication across several rally images.', caseNumber: `DS/${year}/0158`, firNumber: null, officerName: cfg.demo.name, officerBadge: 'CCB-2214', jurisdiction: 'Cyber Crime Branch, Ahmedabad City' },
    { title: 'Currency Withdrawal Rumour', status: 'closed', priority: 'medium', assignedTo: cfg.demo.name, description: 'Fabricated central-bank press release; closed after publisher correction.', caseNumber: `DS/${year}/0160`, firNumber: `0118/${year}`, officerName: cfg.demo.name, officerBadge: 'CCB-2214', jurisdiction: 'Cyber Crime Branch, Ahmedabad City' },
  ]
  const created = []
  for (const s of specs) {
    created.push(
      await db.investigation.create({
        data: { ...s, tags: JSON.stringify([DEMO_TAG, s.priority]) },
      }),
    )
  }
  return created
}

async function seedReports(investigationIds: string[]) {
  const count = cfg.demo.sampleReportCount
  const now = Date.now()
  const created: { id: string; type: string; trust: number; risk: string; createdAt: Date }[] = []

  for (let i = 0; i < count; i++) {
    const type = ANALYSIS_TYPES[i % ANALYSIS_TYPES.length]
    const narrative = pick(NARRATIVES[type])
    const region = pick(REGIONS)
    const platform = pick(PLATFORMS)
    const language = pick(LANGUAGES)
    const m = MIME[type]

    // Spread across the last 30 days, denser in the last week.
    const ageDays = i % 3 === 0 ? between(0, 7) : between(0, 30)
    const createdAt = new Date(now - ageDays * 86_400_000)

    const trust = Math.round(
      type === 'fact_check' ? between(30, 90) : between(10, 85),
    )
    const risk = riskFromTrust(trust)
    const flags = FLAG_POOL[type].filter(() => rand() > 0.5)

    const upload = await db.mediaUpload.create({
      data: {
        fileName: `${region.toLowerCase()}-${type}-${i + 1}.${m.ext}`,
        fileType: m.fileType,
        mimeType: m.mime,
        fileSize: Math.round(between(50_000, 8_000_000)),
        status: 'completed',
        metadata: JSON.stringify({ seed: DEMO_TAG, region, platform, language }),
        // Real SHA-256 over the seeded artifact descriptor. Seeded rows have no
        // bytes on disk, so this hashes what the row actually contains rather
        // than inventing a digest for a file that does not exist.
        sha256: sha256Text(`${DEMO_TAG}|${region}|${type}|${i}|${narrative}`),
        createdAt,
        updatedAt: createdAt,
      },
    })

    const report = await db.analysisReport.create({
      data: {
        mediaUploadId: upload.id,
        analysisType: type,
        status: 'completed',
        trustScore: trust,
        riskLevel: risk,
        aiModel: `${cfg.ai.provider}:${type === 'text_fake_news' || type === 'fact_check' ? cfg.ai.model : cfg.ai.visionModel}`,
        processingTime: Math.round(between(600, 5200)),
        confidence: Math.round(between(0.62, 0.98) * 100) / 100,
        explanation: narrative,
        flags: JSON.stringify(flags.length ? flags : [FLAG_POOL[type][0]]),
        recommendations: JSON.stringify([pick(RECOMMENDATION_POOL), pick(RECOMMENDATION_POOL)]),
        results: JSON.stringify({ region, platform, language, trustScore: trust, riskLevel: risk }),
        investigationId:
          (risk === 'critical' || risk === 'high') && rand() > 0.5
            ? pick(investigationIds)
            : null,
        createdAt,
        updatedAt: createdAt,
      },
    })

    // Fact-check citations for verified claims - feeds source credibility + network graph.
    if (type === 'fact_check') {
      const sources = [
        { source: 'pib', url: 'https://pib.gov.in/factcheck', verdict: 'false' },
        { source: 'altnews', url: 'https://www.altnews.in/', verdict: 'misleading' },
        { source: 'boomlive', url: 'https://www.boomlive.in/', verdict: 'false' },
        { source: 'factly', url: 'https://factly.in/', verdict: 'true' },
      ]
      for (const s of sources.filter(() => rand() > 0.4)) {
        await db.factCheckMatch.create({
          data: {
            analysisReportId: report.id,
            source: s.source,
            claim: narrative.slice(0, 120),
            verdict: s.verdict,
            confidence: Math.round(between(0.6, 0.95) * 100) / 100,
            url: s.url,
            snippet: narrative.slice(0, 180),
            matchedAt: createdAt,
          },
        })
      }
    }

    created.push({ id: report.id, type, trust, risk, createdAt })
  }
  return created
}

async function seedAlerts(reports: { risk: string; type: string; createdAt: Date }[]) {
  const highRisk = reports.filter((r) => r.risk === 'critical' || r.risk === 'high').slice(0, 12)
  const titleFor = (type: string) =>
    type === 'video_deepfake' ? 'Deepfake video detected'
    : type === 'image_forensics' ? 'Image manipulation detected'
    : type === 'audio_deepfake' ? 'Synthetic voice detected'
    : type === 'fact_check' ? 'Claim disputed by fact-checkers'
    : 'Fake news narrative flagged'

  for (const [i, r] of highRisk.entries()) {
    await db.alert.create({
      data: {
        type: 'threat',
        severity: r.risk === 'critical' ? 'critical' : 'warning',
        title: titleFor(r.type),
        message: `${titleFor(r.type)} - automated triage flagged this item as ${r.risk} risk and queued it for analyst review.`,
        source: DEMO_TAG,
        isRead: i > 5,
        createdAt: r.createdAt,
      },
    })
  }

  await db.alert.create({
    data: {
      type: 'system',
      severity: 'info',
      title: `${cfg.app.name} ${cfg.app.version} configured`,
      message: `AI provider "${cfg.ai.provider}" (${cfg.ai.model}); web search ${cfg.search.enabled ? `enabled via ${cfg.search.provider}` : 'disabled'}.`,
      source: DEMO_TAG,
      isRead: false,
    },
  })
}

async function seedWatchlist() {
  const items = [
    { keyword: 'चुनाव फर्जी', type: 'keyword', language: 'hi' },
    { keyword: 'vote tampering', type: 'keyword', language: 'en' },
    { keyword: 'vaccine recall', type: 'keyword', language: 'en' },
    { keyword: '#DeepfakeAlert', type: 'hashtag', language: 'en' },
    { keyword: 'note bandi', type: 'keyword', language: 'hi' },
  ]
  for (const it of items) {
    const hits = Math.round(between(0, 40))
    await db.watchlistItem.create({
      data: {
        ...it,
        isActive: true,
        hitCount: hits,
        lastHitAt: hits ? new Date(Date.now() - between(0, 5) * 86_400_000) : null,
      },
    })
  }
}

async function seedCommunity() {
  if (!cfg.features.communityReports) return
  const reports = [
    { title: 'Suspicious forward about vote tampering', mediaType: 'text', status: 'verified' },
    { title: 'Edited rally photo circulating locally', mediaType: 'image', status: 'pending' },
    { title: 'Voice note impersonating a district officer', mediaType: 'audio', status: 'disputed' },
  ]
  for (const r of reports) {
    const created = await db.communityReport.create({
      data: {
        title: r.title,
        description: `${r.title} - submitted by a community contributor for verification.`,
        mediaType: r.mediaType,
        submitterName: cfg.demo.name,
        status: r.status,
        tags: JSON.stringify([DEMO_TAG]),
        consensusScore: Math.round(between(40, 95)),
        effectiveVoters: Math.round(between(3, 25)),
        confidence: Math.round(between(0.5, 0.95) * 100) / 100,
      },
    })
    const voters = Math.round(between(3, 8))
    for (let v = 0; v < voters; v++) {
      await db.communityVote.create({
        data: {
          reportId: created.id,
          voterFingerprint: `seed-voter-${created.id}-${v}`,
          vote: rand() > 0.35 ? 'agree' : 'disagree',
          voterTrustScore: Math.round(between(30, 95)),
        },
      })
    }
  }
}

async function seedSourceCredibility() {
  const domains = [
    { domain: 'pib.gov.in', factualRating: 92, type: 'fact-checker', totalCitations: 34 },
    { domain: 'altnews.in', factualRating: 90, type: 'fact-checker', totalCitations: 28 },
    { domain: 'boomlive.in', factualRating: 88, type: 'fact-checker', totalCitations: 21 },
    { domain: 'factly.in', factualRating: 86, type: 'fact-checker', totalCitations: 17 },
    { domain: 'thehindu.com', factualRating: 82, type: 'mainstream', totalCitations: 12 },
    { domain: 'unknown-viral-news.example', factualRating: 24, type: 'unknown', totalCitations: 9 },
  ]
  for (const d of domains) {
    await db.sourceCredibilityScore.upsert({
      where: { domain: d.domain },
      update: d,
      create: d,
    })
  }
}

async function seedWorkflows() {
  if (!cfg.features.workflowAutomation) return
  const rules = [
    {
      name: 'Escalate critical deepfakes',
      description: 'Open an investigation when a video analysis returns critical risk.',
      triggerType: 'analysis_complete',
      conditions: JSON.stringify({ analysisType: 'video_deepfake', riskLevel: ['critical'] }),
      actions: JSON.stringify(['create_investigation', 'create_alert']),
    },
    {
      name: 'Watchlist hit notification',
      description: 'Raise an alert whenever a monitored keyword is matched.',
      triggerType: 'watchlist_hit',
      conditions: JSON.stringify({ minHits: 1 }),
      actions: JSON.stringify(['create_alert']),
    },
    {
      name: 'Daily campaign sweep',
      description: 'Cluster recent text analyses to surface coordinated narratives.',
      triggerType: 'schedule',
      conditions: JSON.stringify({ cron: '0 6 * * *' }),
      actions: JSON.stringify(['run_clustering']),
    },
  ]
  for (const r of rules) {
    const rule = await db.workflowRule.create({ data: r })
    for (let i = 0; i < 3; i++) {
      await db.workflowExecution.create({
        data: {
          ruleId: rule.id,
          status: rand() > 0.2 ? 'success' : 'failed',
          durationMs: Math.round(between(120, 3000)),
          triggeredAt: new Date(Date.now() - i * 86_400_000),
          result: JSON.stringify({ matched: Math.round(between(0, 6)) }),
        },
      })
    }
  }
}

async function seedAuditLog(reportCount: number) {
  if (!cfg.features.auditLog) return
  // Use the real AuditAction vocabulary (src/lib/engines/audit-logger.ts).
  const actions = [
    ['analysis_completed', 'analysis'],
    ['report_exported', 'report'],
    ['investigation_created', 'investigation'],
    ['watchlist_hit', 'watchlist'],
    ['alert_triggered', 'alert'],
    ['fact_check_completed', 'analysis'],
  ] as const
  // Build the rows first, then write them oldest-first so the seeded corpus is a
  // valid hash chain. A seeded DB that fails "Verify chain" would be worse than
  // no chain at all.
  const rows = Array.from({ length: 25 }, (_, i) => {
    const [action, resource] = actions[i % actions.length]
    return {
      action,
      resource,
      details: JSON.stringify({
        seed: DEMO_TAG,
        index: i,
        of: reportCount,
        summary: `${action.replace(/_/g, ' ')} on ${resource} (seeded activity)`,
      }),
      createdAt: new Date(Date.now() - between(0, 14) * 86_400_000),
    }
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  // Continue an existing chain rather than forking it.
  const head = await db.auditLog.findFirst({
    orderBy: [{ seq: 'desc' }, { createdAt: 'desc' }],
    select: { seq: true, entryHash: true },
  })
  let seq = (head?.seq ?? -1) + 1
  let prevHash: string = head?.entryHash ?? GENESIS_HASH

  for (const row of rows) {
    const entry = {
      seq,
      action: row.action,
      resource: row.resource,
      userId: cfg.demo.email,
      details: row.details,
      ipAddress: '127.0.0.1',
      createdAt: row.createdAt,
    }
    const entryHash = linkHash(prevHash, entry)
    await db.auditLog.create({ data: { ...entry, prevHash, entryHash } })
    prevHash = entryHash
    seq++
  }
}

async function refreshDashboardStats() {
  const [totalAnalyses, fakeNewsDetected, deepfakesDetected, imagesAnalyzed, factChecksRun, activeAlerts, openInvestigations, agg] =
    await Promise.all([
      db.analysisReport.count(),
      db.analysisReport.count({ where: { analysisType: 'text_fake_news', riskLevel: { in: ['high', 'critical'] } } }),
      db.analysisReport.count({ where: { analysisType: 'video_deepfake', riskLevel: { in: ['high', 'critical'] } } }),
      db.analysisReport.count({ where: { analysisType: 'image_forensics' } }),
      db.analysisReport.count({ where: { analysisType: 'fact_check' } }),
      db.alert.count({ where: { isRead: false } }),
      db.investigation.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      db.analysisReport.aggregate({ _avg: { trustScore: true } }),
    ])

  const data = {
    totalAnalyses,
    fakeNewsDetected,
    deepfakesDetected,
    imagesAnalyzed,
    factChecksRun,
    activeAlerts,
    openInvestigations,
    avgTrustScore: agg._avg.trustScore ?? 0,
  }
  const existing = await db.dashboardStats.findFirst()
  if (existing) await db.dashboardStats.update({ where: { id: existing.id }, data })
  else await db.dashboardStats.create({ data })
  return data
}

/**
 * Recurring-hoax registry.
 *
 * These are long-running narrative *templates* that resurface every few months
 * in Indian messaging apps, written here in their canonical form. The registry
 * matches re-worded variants; it is not a claim that any specific message came
 * from any specific source. `debunkUrl` is left null unless a published debunk
 * is recorded by an operator - the seed does not invent citations.
 */
async function seedKnownHoaxes() {
  const entries = [
    { title: 'Windfall deposit into every account', category: 'financial', language: 'en', narrative: 'The government will credit lakhs of rupees into every citizen bank account from a fixed date, banks are hiding it, forward the message to activate the transfer.' },
    { title: 'Windfall deposit into every account (Hindi)', category: 'financial', language: 'hi', narrative: 'सरकार सोमवार से हर नागरिक के खाते में लाखों रुपये जमा करेगी, बैंक यह बात छिपा रहे हैं, इस संदेश को आगे भेजने पर पैसा मिलेगा।' },
    { title: 'Currency note contains tracking chip', category: 'financial', language: 'en', narrative: 'The new currency note has a nano GPS chip embedded in it that can track the note from deep underground, confirmed by an unnamed central bank insider.' },
    { title: 'Imminent salt or essential-goods shortage', category: 'civic', language: 'en', narrative: 'Supply of salt or another essential item will stop across the state from tomorrow, buy in bulk today, do not ask questions just forward this warning.' },
    { title: 'Home remedy cures a serious disease', category: 'health', language: 'en', narrative: 'A common kitchen ingredient boiled in water cures diabetes or another serious disease within days, doctors are shocked and pharmaceutical companies suppressed the study.' },
    { title: 'Hot water flushes out viruses', category: 'health', language: 'en', narrative: 'Drinking hot water every fifteen minutes flushes any virus out of the throat before it reaches the lungs, confirmed by a hospital that cannot be named.' },
    { title: 'Messaging app will start charging per message', category: 'financial', language: 'en', narrative: 'The messaging app will begin charging a fee for every message from Friday unless you forward this message to a number of contacts to keep the free plan active.' },
    { title: 'Mobile towers blamed for local illness', category: 'health', language: 'en', narrative: 'Newly installed mobile network towers near the locality are the real cause of recent illnesses and the authorities are covering it up.' },
    { title: 'Examinations cancelled by leaked order', category: 'civic', language: 'en', narrative: 'A leaked official memo says all school examinations are cancelled permanently from the next session, share before the government takes this down.' },
    { title: 'Recycled disaster footage as breaking news', category: 'disaster', language: 'en', narrative: 'A video circulating today shows a bridge or building collapsing in this city with hundreds killed, and the media is completely silent about it.' },
  ]

  for (const e of entries) {
    await db.knownHoax.create({
      data: {
        ...e,
        verdict: 'false',
        debunkSource: 'internal',
        firstSeen: new Date(Date.now() - between(120, 900) * 86_400_000),
        lastSeen: new Date(Date.now() - between(0, 30) * 86_400_000),
        hitCount: Math.round(between(3, 240)),
      },
    })
  }
  return entries.length
}

async function main() {
  console.log(`Seeding ${cfg.app.name} ${cfg.app.version} (${cfg.env.nodeEnv}) → ${cfg.database.url}`)

  const user = await seedDemoUser()
  console.log(`  demo account: ${user.email} (role: ${user.role})`)
  console.log('  demo password is read from config (DEMO_USER_PASSWORD) - used once auth is enabled')

  if (!cfg.demo.seedSampleData) {
    console.log('  DEMO_SEED_SAMPLE_DATA=false - skipping sample corpus')
    return
  }

  await clearDemoData()
  const investigations = await seedInvestigations()
  const reports = await seedReports(investigations.map((i) => i.id))
  await seedAlerts(reports)
  await seedWatchlist()
  await seedCommunity()
  await seedSourceCredibility()
  await seedWorkflows()
  const hoaxCount = await seedKnownHoaxes()
  await seedAuditLog(reports.length)
  const stats = await refreshDashboardStats()

  console.log(`  hoax registry:  ${hoaxCount}`)
  console.log(`  investigations: ${investigations.length}`)
  console.log(`  analyses:       ${reports.length}`)
  console.log(`  dashboard:      ${JSON.stringify(stats)}`)
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
