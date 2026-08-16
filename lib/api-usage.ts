import type { SupabaseClient } from '@supabase/supabase-js'

function sampleSuccess(requestId: string, every = 20) {
  let hash = 0
  for (let index = 0; index < requestId.length; index++) hash = ((hash << 5) - hash + requestId.charCodeAt(index)) | 0
  return Math.abs(hash) % every === 0
}

export async function recordApiUsage(input: {
  admin: SupabaseClient
  userId: string
  endpoint: string
  statusCode: number
  durationMs: number
  requestId: string
}) {
  const { admin, userId, endpoint, statusCode, durationMs, requestId } = input
  try {
    await admin.rpc('flowpay_record_api_usage', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_status_code: statusCode,
      p_duration_ms: Math.max(0, Math.min(600_000, Math.round(durationMs))),
    })
  } catch {
    // Usage accounting is observability only and must not fail the API call.
  }

  if (statusCode >= 400 || sampleSuccess(requestId)) {
    try {
      await admin.from('api_request_logs').insert({
        user_id: userId,
        endpoint,
        status_code: statusCode,
        duration_ms: Math.max(0, Math.min(600_000, Math.round(durationMs))),
        request_id: requestId,
      })
    } catch {
      // Detailed logs are sampled and best-effort.
    }
  }
}
