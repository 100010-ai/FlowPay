import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

type OnboardingState = {
  completed: boolean
  legacyProfile: boolean
}

type LegacyProfileRow = {
  name: string | null
  country: string | null
  preferred_currency: string | null
  onboarding_completed_at: string | null
}

function validLegacyProfile(profile: LegacyProfileRow | null) {
  if (!profile) return false
  const name = String(profile.name || '').trim()
  const country = String(profile.country || '').trim().toUpperCase()
  const currency = String(profile.preferred_currency || '').trim().toUpperCase()
  return name.length >= 2 && name.length <= 160 && /^[A-Z]{2}$/.test(country) && /^[A-Z]{3}$/.test(currency)
}

export async function resolveOnboardingState(userId: string, userClient: SupabaseClient): Promise<OnboardingState> {
  const { data: completed, error: statusError } = await userClient.rpc('flowpay_onboarding_status')
  if (!statusError && completed === true) return { completed: true, legacyProfile: false }

  // Compatibility-only fallback for accounts created before onboarding_completed_at.
  // The service role reads exactly one row bound to the already authenticated user ID.
  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('company_profiles')
    .select('name,country,preferred_currency,onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle<LegacyProfileRow>()
  if (error) throw error
  if (!validLegacyProfile(profile)) return { completed: false, legacyProfile: false }
  return { completed: true, legacyProfile: !profile?.onboarding_completed_at }
}
