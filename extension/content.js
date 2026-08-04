/**
 * In-page result overlay.
 *
 * Renders inside a shadow root so page CSS cannot restyle a verification verdict
 * - a site should not be able to make a "manipulated" badge look like a clean one.
 * All content is inserted as text nodes, never innerHTML from API data.
 */

const HOST_ID = 'truthshield-overlay-host'

function ensureHost() {
  let host = document.getElementById(HOST_ID)
  if (host) return host.shadowRoot

  host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:16px;right:16px;'
  document.documentElement.appendChild(host)

  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    .card{font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;width:340px;max-height:70vh;overflow:auto;
      background:#0b0f14;color:#e6edf3;border:1px solid #1f2a33;border-radius:12px;
      box-shadow:0 12px 40px rgba(0,0,0,.45);padding:14px}
    .row{display:flex;align-items:center;gap:8px}
    .title{font-weight:600;font-size:13px;flex:1}
    .close{cursor:pointer;background:none;border:0;color:#8b98a5;font-size:16px;line-height:1;padding:2px 4px}
    .score{font-size:26px;font-weight:700;margin:6px 0 2px}
    .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase}
    .low{background:rgba(16,185,129,.15);color:#34d399}
    .medium{background:rgba(234,179,8,.15);color:#facc15}
    .high{background:rgba(249,115,22,.15);color:#fb923c}
    .critical{background:rgba(239,68,68,.15);color:#f87171}
    .muted{color:#8b98a5;font-size:11px}
    .expl{margin-top:8px;font-size:12px;color:#c9d4de}
    .sig{display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:3px 0;border-bottom:1px solid #16202a}
    .sig:last-child{border-bottom:0}
    .hoax{margin-top:10px;padding:8px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);border-radius:8px}
    .hoax b{color:#fbbf24}
    .err{color:#f87171}
    .spinner{width:14px;height:14px;border:2px solid #1f2a33;border-top-color:#10b981;border-radius:50%;
      animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
  `
  root.appendChild(style)
  const card = document.createElement('div')
  card.className = 'card'
  root.appendChild(card)
  return root
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

function render(payload) {
  const root = ensureHost()
  const card = root.querySelector('.card')
  card.textContent = ''

  const head = el('div', 'row')
  head.appendChild(el('span', 'title', 'TruthShield'))
  const close = el('button', 'close', '✕')
  close.addEventListener('click', () => document.getElementById(HOST_ID)?.remove())
  head.appendChild(close)
  card.appendChild(head)

  if (payload.pending) {
    const row = el('div', 'row')
    row.style.marginTop = '10px'
    row.appendChild(el('div', 'spinner'))
    row.appendChild(el('span', 'muted', 'Verifying with your console…'))
    card.appendChild(row)
    return
  }

  if (payload.error) {
    card.appendChild(el('div', 'expl err', payload.error))
    card.appendChild(el('div', 'muted', 'Check the console URL in the extension options and that the console is running.'))
    return
  }

  if (payload.kind === 'factcheck') {
    card.appendChild(el('div', 'score', String(payload.verdict ?? 'unverified').replace(/_/g, ' ')))
    card.appendChild(el('span', `pill ${payload.verdict === 'false' ? 'critical' : payload.verdict === 'true' ? 'low' : 'medium'}`,
      `confidence ${payload.confidence ?? 0}%`))
    if (payload.stanceRollup) {
      card.appendChild(el('div', 'muted',
        `sources - support ${payload.stanceRollup.support}, refute ${payload.stanceRollup.refute}, neutral ${payload.stanceRollup.neutral}`))
    }
  } else {
    const risk = riskClass(payload.riskLevel, payload.trustScore)
    card.appendChild(el('div', 'score', `${payload.trustScore ?? ' - '}/100`))
    card.appendChild(el('span', `pill ${risk}`, `${risk} risk`))
    if (payload.kind === 'image') {
      card.appendChild(el('div', 'muted',
        `${payload.elaRegions} ELA region(s) · synthesis grid ${payload.ganScore}/100`))
      if (payload.sha256) card.appendChild(el('div', 'muted', `sha256 ${payload.sha256.slice(0, 16)}…`))
    }
  }

  if (payload.explanation) card.appendChild(el('div', 'expl', payload.explanation))

  for (const m of payload.hoaxMatches ?? []) {
    const box = el('div', 'hoax')
    box.appendChild(el('b', null, `Known hoax narrative · ${m.similarity}% match`))
    box.appendChild(el('div', 'muted', m.title))
    card.appendChild(box)
  }

  const signals = (payload.signals ?? []).filter((s) => s.contribution > 0).slice(0, 5)
  if (signals.length) {
    const wrap = el('div')
    wrap.style.marginTop = '10px'
    wrap.appendChild(el('div', 'muted', 'Why this score'))
    for (const s of signals) {
      const row = el('div', 'sig')
      row.appendChild(el('span', null, s.label))
      row.appendChild(el('span', null, `+${s.contribution}`))
      wrap.appendChild(row)
    }
    card.appendChild(wrap)
  }

  if (payload.reportId) {
    card.appendChild(el('div', 'muted', `report ${payload.reportId.slice(-8)} · saved to the console`))
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'truthshield-result') render(msg.payload)
})
