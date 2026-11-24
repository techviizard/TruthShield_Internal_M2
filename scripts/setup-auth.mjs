/**
 * Creates local administrator credentials for the TruthShield sign-in gate.
 * Safe to run on macOS, Windows, and Linux. Secrets are written only to the
 * git-ignored .env.local file and the generated password is printed once.
 */
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const envPath = path.join(root, '.env.local')
const examplePath = path.join(root, '.env.example')

if (!existsSync(examplePath)) {
  console.error('Could not find .env.example. Run this command from the TruthShield project folder.')
  process.exit(1)
}

let contents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8')

function readValue(key) {
  const match = contents.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
}

function setValue(key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(contents)) contents = contents.replace(pattern, line)
  else contents += `${contents.endsWith('\n') ? '' : '\n'}${line}\n`
}

const configuredEmail = readValue('ADMIN_EMAIL')
const defaultEmail = !configuredEmail || configuredEmail === 'admin@example.com' ? readValue('DEMO_USER_EMAIL') : configuredEmail
const email = (process.env.ADMIN_EMAIL || defaultEmail || 'analyst@truthshield.local').trim().toLowerCase()
const existingPassword = readValue('ADMIN_PASSWORD')
const existingSecret = readValue('AUTH_SECRET')
const passwordIsPlaceholder = !existingPassword || /replace-with|change-me|your-password/i.test(existingPassword)
const secretIsPlaceholder = !existingSecret || /replace-with|change-me|your-secret/i.test(existingSecret)
const password = passwordIsPlaceholder ? randomBytes(24).toString('base64url') : existingPassword
const secret = secretIsPlaceholder ? randomBytes(48).toString('base64') : existingSecret

if (password.length < 16) {
  console.error('The existing ADMIN_PASSWORD is shorter than 16 characters. Set ADMIN_PASSWORD to a stronger value and rerun.')
  process.exit(1)
}
if (secret.length < 32) {
  console.error('The existing AUTH_SECRET is shorter than 32 characters. Set a longer secret and rerun.')
  process.exit(1)
}

setValue('AUTH_SECRET', secret)
setValue('ADMIN_EMAIL', email)
setValue('ADMIN_PASSWORD', password)
writeFileSync(envPath, contents, { mode: 0o600 })
try { chmodSync(envPath, 0o600) } catch { /* Windows may not expose POSIX file modes. */ }

console.log('\nTruthShield administrator sign-in is configured.\n')
console.log(`Email:    ${email}`)
if (passwordIsPlaceholder) {
  console.log(`Password: ${password}`)
  console.log('\nCopy this password now and keep it private. It is stored in .env.local, which is git-ignored.')
} else {
  console.log('Password: Existing ADMIN_PASSWORD retained (not displayed).')
}
console.log('\nAUTH_SECRET was generated or retained in .env.local.')
console.log('Start the app with: npm run start:all')
