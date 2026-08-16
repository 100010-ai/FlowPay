import { createAdminClient } from '@/lib/supabase/admin'

export async function logSystemEvent(input: {
  level: 'info' | 'warning' | 'error'
  source: string
  code: string
  message?: string
  userId?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    await admin.from('system_event_logs').insert({
      level: input.level,
      source: input.source,
      code: input.code,
      message: (input.message || '').slice(0, 600),
      user_id: input.userId || null,
      metadata: input.metadata || {},
    })
  } catch (error) {
    console.error('system event logging failed', error)
  }
}
