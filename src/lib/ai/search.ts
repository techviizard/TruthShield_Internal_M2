/**
 * Pluggable web-search provider (used by fact-check + reverse-image).
 *
 * The previous SDK bundled a proprietary `web_search`. Generic LLM providers do
 * NOT offer web search, so it is now a separate, optional capability:
 *   SEARCH_PROVIDER=tavily|brave|none   SEARCH_API_KEY=...
 *
 * If unconfigured (or "none"), `webSearch` returns [] and the app degrades
 * gracefully — fact-check still runs on model reasoning, just without live sources.
 */

import { getConfig } from '@/config/app.config'

export interface SearchResult {
  title?: string
  url?: string
  snippet?: string
}

function getSearchConfig() {
  return getConfig().search
}

export function isSearchEnabled(): boolean {
  return getSearchConfig().enabled
}

async function tavilySearch(query: string, num: number, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: num }),
  })
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`)
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> }
  return (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }))
}

async function braveSearch(query: string, num: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num}`
  const res = await fetch(url, { headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Brave search failed: ${res.status}`)
  const data = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }
  return (data.web?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.description }))
}

/**
 * Run a web search with the configured provider. Returns [] if search is
 * disabled or the provider errors (never throws to the caller).
 */
export async function webSearch(query: string, num?: number): Promise<SearchResult[]> {
  const { provider, apiKey, maxResults } = getSearchConfig()
  const count = num ?? maxResults
  if (!isSearchEnabled()) return []
  try {
    switch (provider) {
      case 'tavily':
        return await tavilySearch(query, count, apiKey)
      case 'brave':
        return await braveSearch(query, count, apiKey)
      default:
        console.warn(`Unknown SEARCH_PROVIDER "${provider}"; skipping web search.`)
        return []
    }
  } catch (err) {
    console.error('Web search error:', err)
    return []
  }
}
