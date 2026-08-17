'use client'

import { createClient } from '@/lib/supabase/client'

export type ClientAal = { currentLevel: 'aal1'|'aal2'|null; nextLevel: 'aal1'|'aal2'|null }

export function safeInternalPath(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  return value
}

export async function currentAssurance(): Promise<ClientAal> {
  const { data, error } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return { currentLevel: data.currentLevel, nextLevel: data.nextLevel }
}

/** Returns true only for an already step-up authenticated session. */
export async function hasAal2() {
  const aal = await currentAssurance()
  return aal.currentLevel === 'aal2'
}

export function mfaDestination(aal: ClientAal, nextPath: string) {
  const safe = safeInternalPath(nextPath)
  if (aal.currentLevel === 'aal2') return null
  return aal.nextLevel === 'aal2'
    ? `/mfa?next=${encodeURIComponent(safe)}`
    : `/settings/security?required=1&next=${encodeURIComponent(safe)}`
}
