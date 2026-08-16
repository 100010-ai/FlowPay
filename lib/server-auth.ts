import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export async function authenticatedUser(request: Request): Promise<User | null> {
  const token = bearerToken(request)
  if (!token) return null
  const client = createServerClient(token)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function authenticatedClient(request: Request) {
  const token = bearerToken(request)
  if (!token) return null
  const client = createServerClient(token)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { client, user: data.user, token }
}
