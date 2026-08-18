import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireAal2 } from '@/lib/server-auth'
import { apiJson, bodyErrorResponse, readJsonBody, requestId, trustedMutationOrigin } from '@/lib/http'
import { safeErrorMessage } from '@/lib/security'
import { logSystemEvent } from '@/lib/server-log'

const requestSchema = z.object({
  paymentId: z.string().uuid(),
  note: z.string().trim().max(500).default(''),
})

const decisionSchema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).default(''),
})

const expectedApprovalErrors = new Map<string, { status: number; code: string }>([
  ['PAYMENT_NOT_FOUND', { status: 404, code: 'PAYMENT_NOT_FOUND' }],
  ['PAYMENT_NOT_APPROVABLE', { status: 409, code: 'PAYMENT_NOT_APPROVABLE' }],
  ['APPROVAL_NOT_REQUIRED', { status: 409, code: 'APPROVAL_NOT_REQUIRED' }],
  ['APPROVAL_NOT_PENDING', { status: 409, code: 'APPROVAL_NOT_PENDING' }],
  ['NOTE_TOO_LONG', { status: 400, code: 'INVALID_APPROVAL_NOTE' }],
  ['INVALID_APPROVAL_DECISION', { status: 400, code: 'INVALID_APPROVAL_DECISION' }],
])

function approvalDomainResponse(error: unknown, reqId: string) {
  const message = safeErrorMessage(error)
  for (const [needle, mapped] of expectedApprovalErrors) {
    if (message.includes(needle)) {
      return apiJson({ error: mapped.code, requestId: reqId }, mapped.status, { 'X-Request-ID': reqId })
    }
  }
  return null
}

async function gate(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return { response: apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId }), reqId }
  const authGate = await requireAal2(request)
  if (!authGate.ok) return { response: apiJson({ error: authGate.code, requestId: reqId }, authGate.code === 'UNAUTHORIZED' ? 401 : 403, { 'X-Request-ID': reqId }), reqId }
  const rate = await checkRateLimit(request, 'payment_approval_write', 40, 60, { subject: authGate.auth.user.id })
  if (!rate.available) return { response: apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId }), reqId }
  if (!rate.allowed) return { response: apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId }), reqId }
  return { auth: authGate.auth, reqId }
}

export async function POST(request: Request) {
  const guarded = await gate(request)
  if ('response' in guarded) return guarded.response
  const { auth, reqId } = guarded
  try {
    const parsed = requestSchema.safeParse(await readJsonBody(request, 8_192))
    if (!parsed.success) return apiJson({ error: 'INVALID_APPROVAL_REQUEST', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const { error } = await auth.client.rpc('flowpay_request_payment_approval', {
      p_payment_id: parsed.data.paymentId,
      p_note: parsed.data.note,
    })
    if (error) throw error
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    const domainResponse = approvalDomainResponse(error, reqId)
    if (domainResponse) return domainResponse
    await logSystemEvent({ level: 'error', source: 'approvals', code: 'APPROVAL_REQUEST_FAILED', message: safeErrorMessage(error), userId: auth.user.id, metadata: { requestId: reqId } })
    return apiJson({ error: 'APPROVAL_REQUEST_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}

export async function PATCH(request: Request) {
  const guarded = await gate(request)
  if ('response' in guarded) return guarded.response
  const { auth, reqId } = guarded
  try {
    const parsed = decisionSchema.safeParse(await readJsonBody(request, 8_192))
    if (!parsed.success) return apiJson({ error: 'INVALID_APPROVAL_DECISION', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const { error } = await auth.client.rpc('flowpay_decide_payment_approval', {
      p_payment_id: parsed.data.paymentId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note,
    })
    if (error) throw error
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    const domainResponse = approvalDomainResponse(error, reqId)
    if (domainResponse) return domainResponse
    await logSystemEvent({ level: 'error', source: 'approvals', code: 'APPROVAL_DECISION_FAILED', message: safeErrorMessage(error), userId: auth.user.id, metadata: { requestId: reqId } })
    return apiJson({ error: 'APPROVAL_DECISION_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
