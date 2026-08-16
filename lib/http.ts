import { NextResponse } from 'next/server'

export class RequestBodyError extends Error {
  constructor(public readonly code: 'PAYLOAD_TOO_LARGE' | 'INVALID_JSON', public readonly status: 400 | 413) {
    super(code)
  }
}

export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<unknown> {
  const declaredHeader = request.headers.get('content-length')
  if (declaredHeader) {
    const declared = Number(declaredHeader)
    if (!Number.isFinite(declared) || declared < 0) throw new RequestBodyError('INVALID_JSON', 400)
    if (declared > maxBytes) throw new RequestBodyError('PAYLOAD_TOO_LARGE', 413)
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RequestBodyError('PAYLOAD_TOO_LARGE', 413)
  if (!text.trim()) throw new RequestBodyError('INVALID_JSON', 400)
  try {
    return JSON.parse(text)
  } catch {
    throw new RequestBodyError('INVALID_JSON', 400)
  }
}

export function requestId(_request: Request) {
  return crypto.randomUUID()
}

export function apiJson(body: unknown, status = 200, headers: HeadersInit = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...Object.fromEntries(new Headers(headers).entries()),
    },
  })
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(body, { ...init, headers })
}

/**
 * Strict request-scoped JSON response for mutation/API handlers.
 * Generates one server-side request ID, exposes it in both the response body
 * and X-Request-ID, and always disables response caching.
 */
export function requestJson(request: Request, body: Record<string, unknown>, init: ResponseInit = {}) {
  const reqId = requestId(request)
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Request-ID', reqId)
  return NextResponse.json({ ...body, requestId: reqId }, { ...init, headers })
}

export function trustedMutationOrigin(request: Request) {
  const method = request.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true

  if (request.headers.get('sec-fetch-site')?.trim().toLowerCase() === 'cross-site') return false
  const candidate = request.headers.get('origin')?.trim()
  if (!candidate) return false

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!configuredAppUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured')

  try {
    return new URL(candidate).origin === new URL(configuredAppUrl).origin
  } catch {
    return false
  }
}

export function bodyErrorResponse(error: unknown, reqId?: string) {
  if (error instanceof RequestBodyError) return apiJson({ error: error.code, ...(reqId ? { requestId: reqId } : {}) }, error.status, reqId ? { 'X-Request-ID': reqId } : {})
  return null
}
