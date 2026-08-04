/**
 * Popup UI. All network work is delegated to the service worker, so the console
 * URL lives in exactly one place.
 */

const $ = (id) => document.getElementById(id)

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve))
}

function el(tag, className, text) {
  const n = document.createElement(tag)
  if (className) n.className = className
  if (text !== undefined) n.textContent = text
  return n
}

function riskClass(risk, trustScore) {
  if (risk) return String(risk).toLowerCase()
  if (typeof trustScore !== 'number') return 'medium'
  return trustScore >= 75 ? 'low' : trustScore >= 50 ? 'medium' : trustScore >= 25 ? 'high' : 'critical'
}

async function refreshStatus() {
  const res = await send({ type: 'ping' })
  const dot = $('status-dot')
  const text = $('status-text')
  if (res?.ok) {
    dot.className = 'dot ok'
    text.textContent = res.data.ai ? 'console online' : 'console online · offline detectors'
    $('open-console').dataset.url = res.data.endpoint
  } else {
    dot.className = 'dot bad'
    text.textContent = 'console unreachable'
  }
}

function renderResult(data, kind) {
  const box = $('result')
  box.textContent = ''

  if (kind === 'factcheck') {
    box.appendChild(el('div', 'score', String(data.verdict ?? 'unverified').replace(/_/g, ' ')))
    box.appendChild(el('span', `pill ${data.verdict === 'false' ? 'critical' : data.verdict === 'true' ? 'low' : 'medium'}`,
      `confidence ${data.confidence ?? 0}%`))
    if (data.stanceRollup) {
      box.appendChild(el('div', 'muted',
        `sources - support ${data.stanceRollup.support}, refute ${data.stanceRollup.refute}, neutral ${data.stanceRollup.neutral}, unrelated ${data.stanceRollup.unrelated}`))
    }
  } else {
    const risk = riskClass(data.riskLevel, data.trustScore)
    box.appendChild(el('div', 'score', `${data.trustScore ?? ' - '}/100`))
    box.appendChild(el('span', `pill ${risk}`, `${risk} risk`))
  }

  if (data.explanation) box.appendChild(el('div', 'expl', data.explanation))

  for (const m of data.hoaxMatches ?? []) {
    const hoax = el('div', 'hoax')
    hoax.appendChild(el('b', null, `Known hoax narrative · ${m.similarity}% match`))
    hoax.appendChild(el('div', 'muted', m.title))
    box.appendChild(hoax)
  }

  if (data.reportId) {
    box.appendChild(el('div', 'muted', `saved to the console as report ${data.reportId.slice(-8)}`))
  }
}

async function run(kind) {
  const text = $('input').value.trim()
  if (!text) return
  const box = $('result')
  box.textContent = ''
  box.appendChild(el('div', 'muted', 'Verifying…'))

  $('analyze').disabled = true
  $('factcheck').disabled = true
  try {
    const res = kind === 'factcheck'
      ? await send({ type: 'fact-check', claim: text })
      : await send({ type: 'analyze-text', text })
    if (!res?.ok) {
      box.textContent = ''
      box.appendChild(el('div', 'expl err', res?.error ?? 'Request failed'))
      box.appendChild(el('div', 'muted', 'Set the console URL under Settings if it is not on localhost:3000.'))
      return
    }
    renderResult(res.data, kind)
  } finally {
    $('analyze').disabled = false
    $('factcheck').disabled = false
  }
}

$('analyze').addEventListener('click', () => run('text'))
$('factcheck').addEventListener('click', () => run('factcheck'))
$('open-options').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})
$('open-console').addEventListener('click', async (e) => {
  e.preventDefault()
  const { endpoint } = await chrome.storage.sync.get('endpoint')
  chrome.tabs.create({ url: endpoint || 'http://localhost:3000' })
})

// Pre-fill from the page selection so the popup is useful in one click.
chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  if (!tab?.id) return
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? '',
    })
    if (result) $('input').value = result.slice(0, 5000)
  } catch {
    // Restricted page (chrome://, store pages) - nothing to pre-fill.
  }
})

refreshStatus()
