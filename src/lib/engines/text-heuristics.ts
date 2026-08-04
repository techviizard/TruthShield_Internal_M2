/**
 * In-house lexical detector for viral misinformation patterns.
 *
 * Why this exists alongside the LLM path:
 *  1. It runs with no API key and no network — the offline mode and the
 *     evaluation harness both need a detector that always answers.
 *  2. Its weights are visible and tunable, so a flagged verdict can be explained
 *     signal by signal rather than as "the model said so".
 *  3. It gives the LLM a second opinion to be measured against on the same corpus.
 *
 * It is a *pattern* detector, not a fact checker: it scores how strongly a
 * message resembles a coordinated forward, not whether the claim is false.
 * Multilingual by construction — every signal carries Latin plus Devanagari,
 * Gujarati and Tamil surface forms, because Indic messages are the actual
 * distribution channel here.
 */

export type SignalId =
  | 'forward_demand'
  | 'manufactured_urgency'
  | 'unverifiable_authority'
  | 'suppression_claim'
  | 'miracle_cure'
  | 'windfall_promise'
  | 'shouting'
  | 'engagement_bait'
  | 'attributed_source'

export interface SignalHit {
  id: SignalId
  label: string
  weight: number          // positive = raises suspicion, negative = lowers it
  matches: string[]
  contribution: number    // points this signal actually added to the score
}

export interface HeuristicResult {
  /** 0..100 suspicion. Higher = more like a manipulative viral forward. */
  score: number
  /** 100 - score, to match the product's trust-score convention. */
  trustScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  signals: SignalHit[]
  /** Script detected from the text itself, not from a user-supplied hint. */
  script: 'latin' | 'devanagari' | 'gujarati' | 'tamil' | 'bengali' | 'telugu' | 'mixed' | 'unknown'
  explanation: string
}

interface SignalSpec {
  id: SignalId
  label: string
  weight: number
  patterns: RegExp[]
  /** Cap on how many distinct matches can count, to stop one signal dominating. */
  maxHits?: number
}

const SIGNALS: SignalSpec[] = [
  {
    id: 'forward_demand',
    label: 'Demands onward forwarding',
    weight: 26,
    patterns: [
      /\bforward (?:this|it|to)\b/i,
      /\bshare (?:this )?(?:before|with|to) \d+/i,
      /\bsend (?:this )?to \d+/i,
      /\b\d+\s*(?:groups?|contacts?|people)\b/i,
      // Count-then-send form ("…20 लोगों को भेजें"), distinct from "आगे भेजो".
      /\d+\s*(?:लोगों|लोग|ग्रुप|संपर्कों)\s*(?:को|में)\s*भेज/,
      /\d+\s*(?:લોકો|ગ્રુપ)\s*(?:ને|માં)\s*મોકલ/,
      /आगे\s*भेज|फॉरवर्ड|ग्रुप\s*में\s*भेज/,
      /આગળ\s*મોકલ|મોકલો/,
      /அனுப்ப(?:ுங்கள்|வும்)/,
    ],
  },
  {
    id: 'manufactured_urgency',
    label: 'Manufactured urgency or deadline',
    weight: 18,
    patterns: [
      /\bbefore (?:the )?(?:link|post|video|message) is (?:deleted|removed|taken down)\b/i,
      /\b(?:urgent|breaking|last chance|act now|today only|hurry)\b/i,
      /\bstarting tomorrow\b/i,
      /तुरंत|आज\s*ही|जल्दी|कल\s*से/,
      /તાત્કાલિક|આજે\s*જ|આવતીકાલથી/,
      /உடனே|இன்றே|நாளை\s*முதல்/,
    ],
  },
  {
    id: 'unverifiable_authority',
    label: 'Appeals to an unnameable authority',
    weight: 22,
    patterns: [
      /\b(?:anonymous|unnamed|secret|inside[r]?)\s+(?:source|official|insider|employee)\b/i,
      /\bsources? (?:inside|close to|confirm)\b/i,
      /\bcannot be named\b/i,
      /\bdoctors are shocked\b/i,
      /गुप्त\s*(?:अधिकारी|सूत्र)|सूत्रों\s*ने|नाम\s*न\s*बताने/,
      /ગુપ્ત\s*(?:અધિકારી|સૂત્ર)|સૂત્રોએ/,
      /ரகசிய\s*(?:அதிகாரி|தகவல்)/,
    ],
  },
  {
    id: 'suppression_claim',
    label: 'Claims the truth is being suppressed',
    weight: 20,
    patterns: [
      /\bmedia is (?:completely )?silent\b/i,
      /\b(?:they|banks|government|companies) (?:are )?(?:hiding|hid|buried|suppress)/i,
      /\bpaid the media\b/i,
      /\bthey don'?t want you to know\b/i,
      /छिपा\s*रहे|दबा\s*दी|मीडिया\s*चुप/,
      /છુપાવે|દબાવી|મીડિયા\s*ચૂપ/,
      /மறைக்கின்ற|அடக்கி/,
    ],
  },
  {
    id: 'miracle_cure',
    label: 'Miracle cure or absolute health claim',
    weight: 20,
    patterns: [
      /\bcures? .{0,24}\bin \d+ (?:days?|hours?|weeks?)\b/i,
      /\b(?:kills|flushes out|removes) (?:any |the )?(?:virus|disease|cancer)\b/i,
      /\bno side effects?\b/i,
      /\b100%\s*(?:cure|safe|effective)\b/i,
      /जड़\s*से\s*खत्म|रामबाण|पूरी\s*तरह\s*ठीक/,
      /જડમૂળથી|સંપૂર્ણ\s*મટે/,
      /முற்றிலும்\s*குணமாகும்/,
    ],
  },
  {
    id: 'windfall_promise',
    label: 'Unconditional money or benefit promise',
    weight: 22,
    patterns: [
      /\b(?:rs\.?|₹|rupees)\s?\d[\d,.]*\s*(?:lakh|crore|thousand)?\b.{0,40}\b(?:every|each|all)\s+(?:citizen|account|family|person)/i,
      /\bfree (?:recharge|data|money|gift)\b/i,
      /\bwill (?:credit|deposit|transfer)\b.{0,30}\baccount\b/i,
      /हर\s*खाते\s*में|मुफ्त\s*(?:रिचार्ज|पैसा)|लाख\s*रुपये\s*आएंगे/,
      /દરેક\s*ખાતામાં|મફત\s*(?:રિચાર્જ|પૈસા)/,
      /ஒவ்வொரு\s*கணக்கிலும்|இலவச/,
    ],
  },
  {
    id: 'shouting',
    label: 'Shouting punctuation or all-caps',
    weight: 10,
    patterns: [
      /[!?]{2,}/,
      /\b[A-Z]{5,}\b/,
    ],
  },
  {
    id: 'engagement_bait',
    label: 'Discourages verification',
    weight: 16,
    patterns: [
      /\bdo not ask questions\b/i,
      /\bjust forward\b/i,
      /\bdon'?t (?:verify|check|think)\b/i,
      /सवाल\s*मत\s*पूछ|बिना\s*सोचे/,
      /પ્રશ્ન\s*ન\s*કરો/,
      /கேள்வி\s*கேட்காதீர்/,
    ],
  },
  {
    id: 'attributed_source',
    label: 'Names a checkable source or process',
    weight: -18,
    patterns: [
      /\b(?:according to|as per|issued by|published (?:by|on))\b/i,
      /\b(?:department|corporation|ministry|university|centre|centre|police|authority)\b.{0,40}\b(?:announced|said|stated|notified|forecast)\b/i,
      /\b(?:press note|notification|circular|official website|portal)\b/i,
      /के\s*अनुसार|विभाग\s*ने\s*बताया|आधिकारिक\s*वेबसाइट|अधिसूचना/,
      /અનુસાર|વિભાગે\s*જણાવ્યું|સત્તાવાર\s*વેબસાઇટ|જણાવ્યું\s*કે/,
      /அறிவிப்பின்படி|கணிப்பின்படி|துறை\s*தெரிவித்த/,
    ],
    maxHits: 2,
  },
]

const SCRIPT_RANGES: [HeuristicResult['script'], RegExp][] = [
  ['devanagari', /[ऀ-ॿ]/],
  ['gujarati', /[઀-૿]/],
  ['tamil', /[஀-௿]/],
  ['bengali', /[ঀ-৿]/],
  ['telugu', /[ఀ-౿]/],
  ['latin', /[A-Za-z]/],
]

export function detectScript(text: string): HeuristicResult['script'] {
  const present = SCRIPT_RANGES.filter(([, re]) => re.test(text)).map(([name]) => name)
  if (!present.length) return 'unknown'
  const indic = present.filter((p) => p !== 'latin')
  if (indic.length > 1) return 'mixed'
  return indic[0] ?? 'latin'
}

/**
 * Score a message. Positive signals accumulate with diminishing returns so a
 * long message cannot be flagged purely by repeating one pattern; the
 * source-attribution signal then subtracts.
 */
export function scoreText(text: string): HeuristicResult {
  const hits: SignalHit[] = []
  let positive = 0
  let negative = 0

  for (const spec of SIGNALS) {
    const matches: string[] = []
    for (const re of spec.patterns) {
      const m = text.match(re)
      if (m?.[0]) matches.push(m[0].trim().slice(0, 60))
    }
    if (!matches.length) continue

    const capped = Math.min(matches.length, spec.maxHits ?? 3)
    // Diminishing returns: 1st match full weight, later ones half, then quarter.
    const multiplier = capped === 1 ? 1 : capped === 2 ? 1.5 : 1.75
    const contribution = spec.weight * multiplier

    hits.push({
      id: spec.id,
      label: spec.label,
      weight: spec.weight,
      matches: [...new Set(matches)],
      contribution: Math.round(contribution),
    })
    if (contribution >= 0) positive += contribution
    else negative += contribution
  }

  // Squash the positive total so several weak signals cannot reach certainty,
  // then apply the negative evidence.
  const squashed = 100 * (1 - Math.exp(-positive / 55))
  const score = Math.max(0, Math.min(100, Math.round(squashed + negative)))

  const riskLevel: HeuristicResult['riskLevel'] =
    score >= 75 ? 'critical' : score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low'

  const positives = hits.filter((h) => h.weight > 0)
  const negatives = hits.filter((h) => h.weight < 0)
  const explanation = positives.length
    ? `Matched ${positives.length} manipulation pattern(s): ${positives.map((h) => h.label.toLowerCase()).join('; ')}.` +
      (negatives.length ? ` Offset by checkable attribution (${negatives.map((h) => h.label.toLowerCase()).join('; ')}).` : '')
    : negatives.length
      ? 'No manipulation patterns matched; the text attributes its claim to a checkable source.'
      : 'No manipulation patterns matched. This is a pattern check only — it does not verify whether the claim is true.'

  return {
    score,
    trustScore: 100 - score,
    riskLevel,
    signals: hits.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    script: detectScript(text),
    explanation,
  }
}
