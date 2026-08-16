import { NextResponse } from 'next/server'

export class RequestBodyError extends Error {
  constructor(public readonly code: 'PAYLOAD_TOO_LARGE' | 'INVALID_JSON', public readonly status: 400 | 413) {
    super(code)
  }
}

export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyError('PAYLOAD_TOO_LARGE', 413)

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RequestBodyError('PAYLOAD_TOO_LARGE', 413)
  if (!text.trim()) throw new RequestBodyError('INVALID_JSON', 400)
  try {
    return JSON.parse(text)
  } catch {
    throw new RequestBodyError('INVALID_JSON', 400)
  }
}

export function requestId(request: Request) {
  const candidate = request.headers.get('x-request-id')?.trim() || ''
  return /^[A-Za-z0-9._-]{8,80}$/.test(candidate) ? candidate : crypto.randomUUID()
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

/**
 * Backwards-compatible no-cache JSON helper used by API route handlers.
 * Supports both `noStoreJson(body, 201, headers)` and the native-style
 * `noStoreJson(body, { status: 201, headers })` call shape.
 */
export function noStoreJson(body: unknown, status?: number, headers?: HeadersInit): NextResponse
export function noStoreJson(body: unknown, init?: ResponseInit): NextResponse
export function noStoreJson(
  body: unknown,
  statusOrInit: number | ResponseInit = 200,
  extraHeaders: HeadersInit = {},
) {
  if (typeof statusOrInit === 'number') {
    return apiJson(body, statusOrInit, extraHeaders)
  }

  const headers = new Headers(statusOrInit.headers)
  headers.set('Cache-Control', 'no-store')
  for (const [key, value] of new Headers(extraHeaders).entries()) headers.set(key, value)

  return NextResponse.json(body, {
    ...statusOrInit,
    headers,
  })
}

export function bodyErrorResponse(error: unknown, reqId?: string) {
  if (error instanceof RequestBodyError) return apiJson({ error: error.code, ...(reqId ? { requestId: reqId } : {}) }, error.status, reqId ? { 'X-Request-ID': reqId } : {})
  return null
}
