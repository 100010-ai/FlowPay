const base = new URL(process.argv[2] || 'https://flowpay-network.vercel.app').origin
const failures = []
const fail = message => failures.push(message)

async function fetchChecked(path, init) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...init })
  return response
}

const home = await fetchChecked('/')
if (home.status !== 200) fail(`/ returned HTTP ${home.status}`)
const csp = home.headers.get('content-security-policy') || ''
if (!/script-src[^;]*'nonce-[^']+'/.test(csp)) fail('HTML CSP has no request nonce')
if (!csp.includes("'strict-dynamic'")) fail('HTML CSP has no strict-dynamic')
if (/script-src[^;]*'unsafe-inline'/.test(csp)) fail('production script-src permits unsafe-inline')
if (!csp.includes("script-src-attr 'none'")) fail('script-src-attr is not disabled')
if (!csp.includes("frame-ancestors 'none'")) fail('frame-ancestors is not denied')
if (!csp.includes("object-src 'none'")) fail('object-src is not denied')

const requiredHeaders = {
  'strict-transport-security': /max-age=(31536000|63072000)/i,
  'x-content-type-options': /^nosniff$/i,
  'x-frame-options': /^DENY$/i,
  'referrer-policy': /strict-origin-when-cross-origin/i,
  'cross-origin-opener-policy': /^same-origin$/i,
  'cross-origin-resource-policy': /^same-origin$/i,
}
for (const [name, expected] of Object.entries(requiredHeaders)) {
  const value = home.headers.get(name) || ''
  if (!expected.test(value)) fail(`${name} missing or unexpected: ${value || '<missing>'}`)
}
if (!/no-store/i.test(home.headers.get('cache-control') || '')) fail('HTML response is not no-store')

const register = await fetchChecked('/register')
if (register.status !== 200) fail(`/register returned HTTP ${register.status}`)

const crossOriginRegister = await fetchChecked('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' },
  body: '{}',
})
if (crossOriginRegister.status !== 403) fail(`cross-origin /api/register was not denied (HTTP ${crossOriginRegister.status})`)

const unauthenticatedKey = await fetchChecked('/api/keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: '{}',
})
if (unauthenticatedKey.status !== 401) fail(`unauthenticated /api/keys was not denied with 401 (HTTP ${unauthenticatedKey.status})`)

const unauthenticatedApi = await fetchChecked('/api/v1/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
if (unauthenticatedApi.status !== 401) fail(`API quote without key was not denied with 401 (HTTP ${unauthenticatedApi.status})`)

if (failures.length) {
  console.error(`Production security check failed with ${failures.length} issue(s):`)
  for (const item of failures) console.error(`- ${item}`)
  process.exit(1)
}
console.log(`Production security check passed for ${base}`)
