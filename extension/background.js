/**
 * TruthShield extension service worker.
 *
 * Owns the context menus and every network call to the console. Content scripts
 * never call the API directly — keeping the console URL and the fetch in one
 * place means a page cannot influence where verification requests are sent.
 */

const DEFAULT_ENDPOINT = 'http://localhost:3000'

async function getEndpoint() {
  const { endpoint } = await chrome.storage.sync.get('endpoint')
  return (endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '')
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'truthshield-verify-selection',
    title: 'Verify selected text with TruthShield',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'truthshield-factcheck-selection',
    title: 'Fact-check this claim with TruthShield',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'truthshield-verify-image',
    title: 'Check this image with TruthShield',
    contexts: ['image'],
  })
})

/** Post JSON to the console, with a clear failure message the popup can show. */
async function callApi(path, body) {
  const endpoint = await getEndpoint()
  const res = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(json?.error || `Console returned ${res.status}`)
  }
  return json
}

async function analyzeText(text) {
  const json = await callApi('/api/analyze/text', { text })
  const a = json.analysis ?? {}
  const details = a.details ?? {}
  return {
    kind: 'text',
    trustScore: a.trustScore,
    riskLevel: a.riskLevel,
    explanation: a.explanation,
    flags: a.flags ?? [],
    hoaxMatches: details.knownHoaxMatches ?? [],
    signals: details.detectorBreakdown?.heuristic?.signals ?? [],
    reportId: json.reportId,
  }
}

async function factCheck(claim) {
  const json = await callApi('/api/factcheck', { claim })
  const f = json.factCheck ?? {}
  return {
    kind: 'factcheck',
    verdict: f.verdict,
    confidence: Math.round((f.confidence ?? 0) * 100),
    explanation: f.explanation,
    hoaxMatches: f.knownHoaxMatches ?? [],
    stanceRollup: f.stanceRollup,
    reportId: json.reportId,
  }
}

/** Fetch an image the page is showing and submit it as a file upload. */
async function analyzeImage(imageUrl) {
  const endpoint = await getEndpoint()
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Could not fetch the image (${imgRes.status})`)
  const blob = await imgRes.blob()

  const form = new FormData()
  form.append('image', blob, 'context-image.jpg')
  const res = await fetch(`${endpoint}/api/analyze/image`, { method: 'POST', body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Console returned ${res.status}`)

  const a = json.analysis ?? {}
  const forensics = a.details?.forensics ?? {}
  return {
    kind: 'image',
    trustScore: a.trustScore,
    riskLevel: a.riskLevel,
    explanation: a.explanation,
    elaRegions: (forensics.elaRegions ?? []).length,
    ganScore: forensics.spectral?.ganArtifactScore ?? 0,
    provenance: a.details?.provenance?.summary,
    sha256: json.evidence?.sha256,
    reportId: json.reportId,
  }
}

/** Push the result into the page as an overlay; fall back to a notification. */
async function showInPage(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'truthshield-result', payload })
  } catch {
    // Content script is not present (e.g. chrome:// pages) — notify instead.
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'TruthShield',
      message: payload.error
        ? `Failed: ${payload.error}`
        : `Trust ${payload.trustScore ?? payload.verdict} — ${String(payload.explanation ?? '').slice(0, 120)}`,
    })
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  await showInPage(tab.id, { pending: true })

  try {
    let result
    if (info.menuItemId === 'truthshield-verify-selection') {
      result = await analyzeText(info.selectionText ?? '')
    } else if (info.menuItemId === 'truthshield-factcheck-selection') {
      result = await factCheck(info.selectionText ?? '')
    } else if (info.menuItemId === 'truthshield-verify-image') {
      result = await analyzeImage(info.srcUrl ?? '')
    } else {
      return
    }
    await showInPage(tab.id, result)
  } catch (e) {
    await showInPage(tab.id, { error: e instanceof Error ? e.message : String(e) })
  }
})

// The popup runs in its own context and delegates network work here.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = async () => {
    try {
      if (msg.type === 'analyze-text') return { ok: true, data: await analyzeText(msg.text) }
      if (msg.type === 'fact-check') return { ok: true, data: await factCheck(msg.claim) }
      if (msg.type === 'ping') {
        const endpoint = await getEndpoint()
        const res = await fetch(`${endpoint}/api`)
        const health = await res.json().catch(() => null)
        return { ok: true, data: { endpoint, status: health?.status ?? 'unknown', ai: health?.integrations?.ai?.ok } }
      }
      return { ok: false, error: 'Unknown request' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  run().then(sendResponse)
  return true // keep the message channel open for the async reply
})
