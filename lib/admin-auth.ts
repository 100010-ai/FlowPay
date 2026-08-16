import type { User } from '@supabase/supabase-js'

export function adminEmails() {
  return new Set((process.env.FLOWPAY_ADMIN_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean))
}

export function isFlowPayAdmin(user: Pick<User, 'email'> | null | undefined) {
  const email = user?.email?.trim().toLowerCase()
  return Boolean(email && adminEmails().has(email))
}
