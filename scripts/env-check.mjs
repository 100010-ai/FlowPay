import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseEnvFile(file) {
  if (!existsSync(file)) return {}
  const out = {}
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) line = line.slice(7).trim()
    const equals = line.indexOf('=')
    if (equals <= 0) continue
    const key = line.slice(0, equals).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(equals + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }
    out[key] = value
  }
  return out
}

const mode = process.env.NODE_ENV || 'development'
const cwd = process.cwd()
const fileEnv = {}
for (const name of [
  '.env',
  `.env.${mode}`,
  ...(mode === 'test' ? [] : ['.env.local']),
  `.env.${mode}.local`,
]) Object.assign(fileEnv, parseEnvFile(resolve(cwd, name)))

// Real shell/CI/Vercel variables always win over local files.
const env = { ...fileEnv, ...process.env }
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_APP_URL']
const missing = required.filter(key => !env[key]?.trim())
if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)')
if (!env.FLOWPAY_ADMIN_USER_IDS && !env.FLOWPAY_ADMIN_EMAILS) missing.push('FLOWPAY_ADMIN_USER_IDS (or fallback FLOWPAY_ADMIN_EMAILS)')
if (missing.length) {
  console.error(`Environment check: FAIL\nMissing: ${missing.join(', ')}`)
  process.exit(1)
}

const errors = []
const placeholderPatterns = [
  /YOUR_PROJECT/i,
  /YOUR_PUBLIC_KEY/i,
  /YOUR_SERVER_KEY/i,
  /YOUR_LEGACY_SERVICE_ROLE_KEY/i,
  /your-domain\.com/i,
  /owner@your-domain\.com/i,
  /replace-with-a-long-random-secret/i,
]
for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string' && placeholderPatterns.some(pattern => pattern.test(value))) errors.push(`${key} still contains an example placeholder`)
}
if (env.FLOWPAY_ADMIN_USER_IDS?.split(',').map(x => x.trim()).includes('00000000-0000-0000-0000-000000000000')) errors.push('FLOWPAY_ADMIN_USER_IDS still contains the example zero UUID')

try {
  const u = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
  if (u.protocol !== 'https:') errors.push('NEXT_PUBLIC_SUPABASE_URL must use HTTPS')
} catch { errors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL') }
try {
  const u = new URL(env.NEXT_PUBLIC_APP_URL)
  if (mode === 'production' && u.protocol !== 'https:') errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production')
} catch { errors.push('NEXT_PUBLIC_APP_URL is not a valid URL') }
if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_secret_')) errors.push('A secret Supabase key was placed in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
if (env.SUPABASE_SECRET_KEY?.startsWith('sb_publishable_')) errors.push('SUPABASE_SECRET_KEY contains a publishable key')
if (env.CRON_SECRET && env.CRON_SECRET.length < 32) errors.push('CRON_SECRET must be at least 32 characters')
if (env.FLOWPAY_ADMIN_USER_IDS) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  for (const id of env.FLOWPAY_ADMIN_USER_IDS.split(',').map(x => x.trim()).filter(Boolean)) if (id !== '00000000-0000-0000-0000-000000000000' && !uuid.test(id)) errors.push(`Invalid admin UUID: ${id}`)
}
if (errors.length) {
  console.error(`Environment check: FAIL\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) console.warn('Environment check: legacy SUPABASE_SERVICE_ROLE_KEY is configured; migrate to SUPABASE_SECRET_KEY when available.')
if (!env.FLOWPAY_ADMIN_USER_IDS && env.FLOWPAY_ADMIN_EMAILS) console.warn('Environment check: admin access uses confirmed-email fallback. Prefer FLOWPAY_ADMIN_USER_IDS before production.')
if (!env.CRON_SECRET) console.warn('Environment check: CRON_SECRET is not set; scheduled operational-data pruning will return 401 until configured.')
console.log('Environment check: PASS')
