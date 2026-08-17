import { requireFlowPayAdmin } from '@/lib/admin-api'
import { apiJson } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireFlowPayAdmin(request, 'admin_access', 120)
  if (!gate.ok) return gate.response
  return apiJson({ admin: true, requestId: gate.reqId }, 200, { 'X-Request-ID': gate.reqId })
}
