const secretPatterns = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /fp_live_[a-f0-9]{24,}/gi,
  /sb_(?:secret|publishable)_[A-Za-z0-9._-]+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
]

const sensitiveKeys = new Set([
  'authorization','access_token','refresh_token','token','secret','password','key','key_hash','api_key',
  'account_number','iban','bic','swift','tax_id','service_role','service_role_key',
])

export function redactText(value: string, maxLength = 600) {
  let output = value
  for (const pattern of secretPatterns) output = output.replace(pattern, '[REDACTED]')
  return output.slice(0, maxLength)
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return redactText(error.message || error.name || 'ERROR')
  if (typeof error === 'string') return redactText(error)
  return 'UNEXPECTED_ERROR'
}

export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]'
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return redactText(value, 300)
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeMetadata(item, depth + 1))
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      result[key] = sensitiveKeys.has(key.toLowerCase()) ? '[REDACTED]' : sanitizeMetadata(item, depth + 1)
    }
    return result
  }
  return String(value).slice(0, 120)
}
