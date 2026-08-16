import type { User } from '@supabase/supabase-js'

function csvSet(value: string | undefined) {
  return new Set((value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean))
}

export function adminEmails() {
  return csvSet(process.env.FLOWPAY_ADMIN_EMAILS)
}

export function adminUserIds() {
  return csvSet(process.env.FLOWPAY_ADMIN_USER_IDS)
}

export function isFlowPayAdmin(user: User | null | undefined) {
  if (!user) return false
  const ids = adminUserIds()
  // Once explicit immutable user IDs are configured, email fallback is disabled.
  if (ids.size > 0) return ids.has(user.id.toLowerCase())
  const email = user.email?.trim().toLowerCase()
  return Boolean(email && user.email_confirmed_at && adminEmails().has(email))
}
