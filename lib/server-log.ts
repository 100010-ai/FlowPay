import { createAdminClient } from '@/lib/supabase/admin'
import { redactText, sanitizeMetadata } from '@/lib/security'

export async function logSystemEvent(input: {
  level: 'info' | 'warning' | 'error'
  source: string
  code: string
  message?: string
  userId?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('system_event_logs').insert({
    level: input.level,
    source: redactText(input.source, 80),
    code: redactText(input.code, 100),
    message: redactText(input.message ?? '', 600),
    user_id: input.userId ?? null,
    metadata: sanitizeMetadata(input.metadata ?? {}),
  })
  if (error) throw error
}
