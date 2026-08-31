const endpointInput = document.getElementById('endpoint')
const status = document.getElementById('status')

chrome.storage.sync.get('endpoint').then(({ endpoint }) => {
  endpointInput.value = endpoint || 'http://localhost:3000'
})

document.getElementById('save').addEventListener('click', async () => {
  const endpoint = endpointInput.value.trim().replace(/\/$/, '')
  if (!endpoint) return

  status.className = 'status'
  status.textContent = 'Testing…'
  await chrome.storage.sync.set({ endpoint })

  // Save first, then test: a console that is merely offline right now should
  // still keep the URL the operator entered.
  try {
    const res = await fetch(`${endpoint}/api`)
    const health = await res.json()
    status.className = 'status ok'
    status.textContent = `Saved. Console ${health.app?.name ?? ''} ${health.app?.version ?? ''} responded (${health.status}).`
  } catch (e) {
    status.className = 'status bad'
    status.textContent = `Saved, but the console did not respond: ${e instanceof Error ? e.message : e}`
  }
})
