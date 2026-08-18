import { createAdminClient } from '@/lib/supabase/admin'
import { redactText, safeErrorMessage, sanitizeMetadata } from '@/lib/security'

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
    const { error } = await admin.from('system_event_logs').insert({
      level: input.level,
      source: redactText(input.source, 80),
      code: redactText(input.code, 100),
      message: redactText(input.message ?? '', 600),
      user_id: input.userId ?? null,
      metadata: sanitizeMetadata(input.metadata ?? {}),
    })
    if (error) {
      console.error('[flowpay:system-log]', redactText(input.code, 100), redactText(safeErrorMessage(error), 240))
    }
  } catch (error) {
    // Logging failures are deliberately isolated from the operation that emitted
    // the event. The diagnostic still reaches server stderr for investigation.
    console.error('[flowpay:system-log]', redactText(input.code, 100), redactText(safeErrorMessage(error), 240))
  }
}
