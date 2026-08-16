import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type RateLimitResult = {
  allowed: boolean
  remaining: number | null
  available: boolean
}

type RateLimitOptions = {
  subject?: string | null
  includeUserAgent?: boolean
}

type LocalCounter = { hits: number; resetAt: number }
const localCounters = new Map<string, LocalCounter>()
const LOCAL_COUNTER_MAX = 5_000

function networkIdentity(request: Request, includeUserAgent = false) {
  const vercel = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  const real = request.headers.get('x-real-ip')?.trim()
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = vercel || real || forwarded || 'unknown'
  if (!includeUserAgent) return ip
  const ua = (request.headers.get('user-agent') || 'unknown').slice(0, 160)
  return `${ip}|${ua}`
}

function rateKey(bucket: string, identity: string) {
  return createHash('sha256').update(`${bucket}|${identity}`).digest('hex')
}

// Instance-local prefilter: never grants access by itself. It only drops a hot
// burst before it creates another database write; Postgres remains authoritative
// across all Vercel instances.
function localBurstAllowed(key: string, limit: number, windowSeconds: number) {
  const now = Date.now()
  const current = localCounters.get(key)
  if (!current || current.resetAt <= now) {
    if (localCounters.size >= LOCAL_COUNTER_MAX) {
      for (const [itemKey, value] of localCounters) {
        if (value.resetAt <= now) localCounters.delete(itemKey)
        if (localCounters.size < LOCAL_COUNTER_MAX) break
      }
      if (localCounters.size >= LOCAL_COUNTER_MAX) localCounters.delete(localCounters.keys().next().value as string)
    }
    localCounters.set(key, { hits: 1, resetAt: now + windowSeconds * 1000 })
    return true
  }
  current.hits += 1
  return current.hits <= limit
}

export async function checkRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const identity = options.subject?.trim()
    ? `subject:${options.subject.trim()}`
    : `network:${networkIdentity(request, options.includeUserAgent)}`
  const keyHash = rateKey(bucket, identity)
  if (!localBurstAllowed(`${bucket}:${keyHash}`, limit, windowSeconds)) return { allowed: false, remaining: 0, available: true }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('flowpay_check_rate_limit', {
    p_key_hash: keyHash,
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) return { allowed: false, remaining: null, available: false }
  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    remaining: row?.remaining == null ? null : Number(row.remaining),
    available: true,
  }
}
