'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Security-focused browser client. Supabase defaults to persistent localStorage;
 * FlowPay keeps auth in tab-scoped sessionStorage and reuses one client instance
 * to avoid competing refresh loops inside the same document.
 */
function makeBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase environment variables are not configured')
  return createSupabaseClient(url, key, {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

type BrowserClient = ReturnType<typeof makeBrowserClient>
let browserClient: BrowserClient | null = null

export function createClient() {
  if (typeof window === 'undefined') throw new Error('Browser Supabase client cannot run on the server')
  browserClient ??= makeBrowserClient()
  return browserClient
}
