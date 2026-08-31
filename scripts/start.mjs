/**
 * One command that brings the whole platform up.
 *
 *   npm run start:all            # prepare DB (seed only if empty) → dev server
 *   npm run start:all -- --fresh # force a reseed of the demo corpus first
 *   npm run start:all -- --eval  # also run a heuristic eval so Model Metrics has data
 *   npm run start:all -- --prod  # production: build, then serve the standalone output
 *   npm run start:all -- --caddy # also start the Caddy reverse proxy (:81) if installed
 *
 * Every step is idempotent, so this is safe to run repeatedly. Seeding is skipped
 * when the database already has analyses, so a re-run never wipes real work - pass
 * --fresh to override.
 *
 * Cross-platform (Windows/macOS/Linux): child processes run through the platform
 * shell and inherit stdio, so their output streams straight through.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const FRESH = has('--fresh')
const WITH_EVAL = has('--eval')
const PROD = has('--prod')
const WITH_CADDY = has('--caddy')

const root = process.cwd()
const isWin = process.platform === 'win32'

// ── small run helpers ───────────────────────────────────────────────────────

function step(label) {
  console.log(`\n\x1b[36m▶ ${label}\x1b[0m`)
}

/** Run a command to completion. Rejects on a non-zero exit. */
function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: 'inherit',
      shell: isWin, // npm/npx are .cmd shims on Windows and need the shell
      cwd: root,
      ...opts,
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${code}`))
    )
  })
}

/** Start a long-running process and return the handle (does not wait). */
function start(cmd, cmdArgs, opts = {}) {
  return spawn(cmd, cmdArgs, { stdio: 'inherit', shell: isWin, cwd: root, ...opts })
}

const npm = isWin ? 'npm.cmd' : 'npm'
const npx = isWin ? 'npx.cmd' : 'npx'

// ── database ──────────────────────────────────────────────────────────────

/** True when the DB already holds analyses, so seeding would be redundant. */
async function databaseHasData() {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const { getConfig } = await import('../src/config/app.config.ts')
    const db = new PrismaClient({ datasources: { db: { url: getConfig().database.url } } })
    try {
      const count = await db.analysisReport.count()
      return count > 0
    } finally {
      await db.$disconnect()
    }
  } catch {
    // No client generated yet, or no table - treat as empty so we seed.
    return false
  }
}

async function prepareDatabase() {
  step('Generating Prisma client')
  await run(npx, ['prisma', 'generate'])

  step('Syncing database schema')
  await run(npx, ['prisma', 'db', 'push', '--skip-generate'])

  const hasData = !FRESH && (await databaseHasData())
  if (hasData) {
    console.log('  Database already has analyses - skipping seed (use --fresh to reseed).')
  } else {
    step(FRESH ? 'Reseeding demo corpus (--fresh)' : 'Seeding demo corpus (empty database)')
    await run(npm, ['run', 'db:seed'])
  }
}

// ── optional warmups ────────────────────────────────────────────────────────

async function warmEval() {
  step('Running heuristic evaluation (populates Model Metrics)')
  try {
    await run(npm, ['run', 'eval', '--', '--detector', 'heuristic'])
  } catch (e) {
    console.warn(`  Eval warmup failed (non-fatal): ${e.message}`)
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\x1b[1mTruthShield - starting all services\x1b[0m')

  await prepareDatabase()
  if (WITH_EVAL) await warmEval()

  const children = []
  const shutdown = () => {
    for (const c of children) {
      try { c.kill() } catch { /* already gone */ }
    }
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  if (WITH_CADDY) {
    if (existsSync(path.join(root, 'Caddyfile'))) {
      step('Starting Caddy reverse proxy (:81 → :3000)')
      const caddy = start('caddy', ['run', '--config', 'Caddyfile'])
      caddy.on('error', () =>
        console.warn('  Caddy is not installed or not on PATH - skipping the reverse proxy.')
      )
      children.push(caddy)
    } else {
      console.warn('  No Caddyfile found - skipping --caddy.')
    }
  }

  if (PROD) {
    step('Building for production')
    await run(npm, ['run', 'build'])
    step('Starting production server (:3000)')
    children.push(start(npm, ['run', 'start']))
  } else {
    step('Starting dev server (:3000)')
    children.push(start(npm, ['run', 'dev']))
  }

  console.log('\n\x1b[32m✔ TruthShield is up.\x1b[0m  Console: http://localhost:3000')
  if (WITH_CADDY) console.log('  Via Caddy: http://localhost:81')
  console.log('  Press Ctrl+C to stop.\n')
}

main().catch((e) => {
  console.error(`\n\x1b[31m✖ Startup failed:\x1b[0m ${e.message}`)
  process.exit(1)
})
