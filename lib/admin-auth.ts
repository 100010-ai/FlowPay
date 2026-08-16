import type { User } from '@supabase/supabase-js'

function adminUserIds() {
  const value = process.env.FLOWPAY_ADMIN_USER_IDS?.trim()
  if (!value) return new Set<string>()
  return new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean))
}

export function isFlowPayAdmin(user: User | null | undefined) {
  if (!user) return false
  const ids = adminUserIds()
  if (ids.size === 0) return false
  return ids.has(user.id.toLowerCase())
}
