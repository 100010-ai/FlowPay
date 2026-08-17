import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type AssuranceLevel = 'aal1' | 'aal2' | null

export type AuthenticatedContext = {
  client: ReturnType<typeof createServerClient>
  user: User
  token: string
  assuranceLevel: AssuranceLevel
}

export type AuthenticatedAal2Context = AuthenticatedContext & {
  currentLevel: 'aal2'
  nextLevel: 'aal2'
}

export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export async function authenticatedClient(request: Request): Promise<AuthenticatedContext | null> {
  const token = bearerToken(request)
  if (!token) return null
  const client = createServerClient(token)
  // getUser(token) validates the access token with the Auth server. Claims below
  // are only consumed after this validation succeeds.
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { client, user: data.user, token, assuranceLevel: validatedAalFromToken(token) }
}

export async function authenticatedUser(request: Request): Promise<User | null> {
  return (await authenticatedClient(request))?.user || null
}

function validatedAalFromToken(token: string): AssuranceLevel {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { aal?: unknown }
    return payload.aal === 'aal1' || payload.aal === 'aal2' ? payload.aal : null
  } catch {
    return null
  }
}

/**
 * High-risk operations require a JWT that has already been validated by
 * getUser(token) and carries the signed aal2 claim. Missing/invalid claims fail
 * closed; no security-sensitive operation is silently downgraded to AAL1.
 */
export async function authenticatedAal2Client(request: Request): Promise<AuthenticatedAal2Context | null> {
  const auth = await authenticatedClient(request)
  if (!auth || validatedAalFromToken(auth.token) !== 'aal2') return null
  return { ...auth, currentLevel: 'aal2', nextLevel: 'aal2' }
}

export async function requireAal2(request: Request): Promise<
  | { ok: true; auth: AuthenticatedAal2Context }
  | { ok: false; code: 'UNAUTHORIZED' | 'MFA_REQUIRED' }
> {
  const auth = await authenticatedClient(request)
  if (!auth) return { ok: false, code: 'UNAUTHORIZED' }
  if (validatedAalFromToken(auth.token) !== 'aal2') return { ok: false, code: 'MFA_REQUIRED' }
  return { ok: true, auth: { ...auth, currentLevel: 'aal2', nextLevel: 'aal2' } }
}
