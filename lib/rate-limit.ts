import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

function clientIdentity(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const real = request.headers.get('x-real-ip')?.trim()
  const ua = request.headers.get('user-agent') || 'unknown'
  return `${forwarded || real || 'unknown'}|${ua.slice(0,120)}`
}

export async function checkRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number) {
  const admin = createAdminClient()
  const keyHash = createHash('sha256').update(`${bucket}|${clientIdentity(request)}`).digest('hex')
  const { data, error } = await admin.rpc('flowpay_check_rate_limit', {
    p_key_hash: keyHash,
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('rate limit check failed', error)
    return { allowed: false, remaining: null as number | null, available: false }
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    remaining: row?.remaining == null ? null : Number(row.remaining),
    available: true,
  }
}
