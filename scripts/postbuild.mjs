/**
 * Cross-platform standalone assembly (replaces the old Unix `cp` build step).
 *
 * Next.js `output: "standalone"` emits a self-contained server in
 * `.next/standalone`, but does NOT copy the static assets or `public/` folder.
 * This script copies them so `npm start` (node .next/standalone/server.js) serves
 * a complete app. Runs automatically after `next build` via the `postbuild` script.
 */
import { cp, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

async function exists(p) {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function copyDir(from, to) {
  if (!(await exists(from))) {
    console.warn(`[postbuild] skip: ${from} does not exist`)
    return
  }
  await cp(from, to, { recursive: true })
  console.log(`[postbuild] copied ${path.relative(root, from)} -> ${path.relative(root, to)}`)
}

const standalone = path.join(root, '.next', 'standalone')

if (!(await exists(standalone))) {
  console.warn('[postbuild] .next/standalone not found — is output:"standalone" set in next.config.ts? Skipping.')
  process.exit(0)
}

await copyDir(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'))
await copyDir(path.join(root, 'public'), path.join(standalone, 'public'))

console.log('[postbuild] standalone assembly complete.')
