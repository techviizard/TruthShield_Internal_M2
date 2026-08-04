/**
 * Real API route introspection - walks src/app/api directory at runtime.
 * Replaces hardcoded API Docs tab content.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export interface RouteInfo {
  path: string                 // /api/...
  methods: string[]            // GET, POST, PATCH, DELETE
  file: string
  description?: string
}

const API_ROOT = path.join(process.cwd(), 'src', 'app', 'api')

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) out.push(...await walk(p))
      else if (e.name === 'route.ts' || e.name === 'route.js') out.push(p)
    }
  } catch {}
  return out
}

function fileToRoutePath(filePath: string): string {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, '/').replace(/\/route\.(ts|js)$/, '')
  return `/api/${rel}`.replace(/\/+$/, '').replace(/\/$/, '') || '/api'
}

function extractMethods(src: string): string[] {
  const found: string[] = []
  for (const m of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src)) found.push(m)
  }
  return found
}

function extractDescription(src: string): string | undefined {
  const m = src.match(/^\s*\/\*\*([\s\S]*?)\*\//)
  if (!m) return undefined
  return m[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ').slice(0, 200)
}

export async function listRoutes(): Promise<RouteInfo[]> {
  const files = await walk(API_ROOT)
  const routes: RouteInfo[] = []
  for (const f of files) {
    try {
      const src = await fs.readFile(f, 'utf-8')
      routes.push({
        path: fileToRoutePath(f),
        methods: extractMethods(src),
        file: path.relative(process.cwd(), f).replace(/\\/g, '/'),
        description: extractDescription(src),
      })
    } catch {}
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path))
}
