import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apiRoot = path.join(root, 'app', 'api')
if (!fs.existsSync(apiRoot)) throw new Error('app/api not found; run this script from the FlowPay project root')

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(?:ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

function splitArgs(source) {
  const args = []
  let start = 0, paren = 0, brace = 0, bracket = 0
  let quote = null, escape = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === ',' && paren === 0 && brace === 0 && bracket === 0) {
      args.push(source.slice(start, i).trim()); start = i + 1
    }
  }
  const tail = source.slice(start).trim()
  if (tail || source.trim()) args.push(tail)
  return args
}

function findCallEnd(text, openIndex) {
  let depth = 0, quote = null, escape = false
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function rewriteCalls(text, name, transform) {
  let cursor = 0, out = ''
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g')
  while (true) {
    re.lastIndex = cursor
    const match = re.exec(text)
    if (!match) { out += text.slice(cursor); break }
    const nameIndex = match.index
    const openIndex = text.indexOf('(', nameIndex + name.length)
    const end = findCallEnd(text, openIndex)
    if (end < 0) { out += text.slice(cursor); break }
    out += text.slice(cursor, nameIndex)
    const argSource = text.slice(openIndex + 1, end)
    const args = splitArgs(argSource)
    const replacement = transform(args, text.slice(nameIndex, end + 1))
    out += replacement ?? text.slice(nameIndex, end + 1)
    cursor = end + 1
  }
  return out
}

function removeNullFxCatch(text) {
  let cursor = 0, out = ''
  const re = /\bgetReferenceFx\s*\(/g
  while (true) {
    re.lastIndex = cursor
    const match = re.exec(text)
    if (!match) { out += text.slice(cursor); break }
    const open = text.indexOf('(', match.index)
    const end = findCallEnd(text, open)
    if (end < 0) { out += text.slice(cursor); break }
    out += text.slice(cursor, end + 1)
    let next = end + 1
    const tail = text.slice(next)
    const catchMatch = tail.match(/^\.catch\(\s*\(\)\s*=>\s*null\s*\)/)
    if (catchMatch) next += catchMatch[0].length
    cursor = next
  }
  return out
}


// Zod 4 throws at runtime when .extend() is called on an object schema that
// already contains refinements. safeExtend() is valid for both refined and
// ordinary ZodObject schemas, so normalize every Zod source file to the
// refinement-safe API before the Next.js module graph is evaluated.
for (const dirName of ['app', 'lib', 'components', 'hooks']) {
  const dir = path.join(root, dirName)
  if (!fs.existsSync(dir)) continue
  for (const file of walk(dir)) {
    let text = fs.readFileSync(file, 'utf8')
    if (!/from\s+['"]zod['"]/.test(text)) continue
    const original = text
    text = text.replace(/\.extend\s*\(/g, '.safeExtend(')
    if (text !== original) {
      fs.writeFileSync(file, text, 'utf8')
      console.log(`[full-fix] zod safeExtend ${path.relative(root, file)}`)
    }
  }
}

let changedFiles = 0
for (const file of walk(apiRoot)) {
  let text = fs.readFileSync(file, 'utf8')
  const original = text

  // Never serve stale data in strict mode.
  text = text.replace(/,\s*stale-while-revalidate(?:=\d+)?/gi, '')
             .replace(/stale-while-revalidate(?:=\d+)?\s*,\s*/gi, '')
             .replace(/,\s*stale-if-error(?:=\d+)?/gi, '')
             .replace(/stale-if-error(?:=\d+)?\s*,\s*/gi, '')

  // Migrate rate-limit subject from the legacy positional string to RateLimitOptions.
  text = rewriteCalls(text, 'checkRateLimit', (args) => {
    if (args.length === 5 && !args[4].trim().startsWith('{')) {
      return `checkRateLimit(${args[0]}, ${args[1]}, ${args[2]}, ${args[3]}, { subject: ${args[4]} })`
    }
    return null
  })

  // RateLimitResult intentionally has no synthetic retry delay.
  text = text.replace(/\{\s*status\s*:\s*429\s*,\s*headers\s*:\s*\{\s*["']Retry-After["']\s*:\s*String\(\s*[A-Za-z_$][\w$]*\.retryAfter\s*\)\s*\}\s*\}/g, '{status:429}')

  // Migrate provider-rule lookup to its strict object contract.
  text = rewriteCalls(text, 'getEligibleProviderRules', (args) => {
    if (args.length === 5 && !args[0].trim().startsWith('{')) {
      return `getEligibleProviderRules({ fromCountry: ${args[0]}, toCountry: ${args[1]}, sourceCurrency: ${args[2]}, recipientCurrency: ${args[3]}, amount: ${args[4]} })`
    }
    return null
  })

  // Strict FX: upstream errors propagate; no null-swallowing.
  text = removeNullFxCatch(text)

  // buildRoutes requires a real number. When the caller already branches on
  // same-currency vs FX, use the proven non-null FX object in the FX branch.
  text = rewriteCalls(text, 'buildRoutes', (args) => {
    if (args.length !== 5) return null
    let rate = args[4]
    const fixed = rate
      .replace(/([A-Za-z_$][\w$]*)\?\.rate\s*\?\?\s*null/g, '$1!.rate')
      .replace(/([A-Za-z_$][\w$]*)\?\.rate\s*\|\|\s*null/g, '$1!.rate')
    if (fixed !== rate) return `buildRoutes(${args[0]}, ${args[1]}, ${args[2]}, ${args[3]}, ${fixed})`
    return null
  })

  // noStoreJson accepts ResponseInit, not a bare status code.
  text = rewriteCalls(text, 'noStoreJson', (args) => {
    if (args.length === 2 && /^\d{3}$/.test(args[1].trim())) return `noStoreJson(${args[0]}, { status: ${args[1].trim()} })`
    return null
  })

  // Every mutation route must emit a real request ID. Newer strict routes use
  // noStoreJson; migrate those to requestJson instead of merely satisfying the
  // audit with an unused requestId() call.
  const hasMutation = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/.test(text)
  const hasRequestId = /\brequestId\s*\(|\brequestJson\s*\(/.test(text)
  if (hasMutation && !hasRequestId && /\bnoStoreJson\s*\(/.test(text)) {
    const httpImport = /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/http['"]/
    const match = text.match(httpImport)
    if (match) {
      const names = match[1].split(',').map(value => value.trim()).filter(Boolean)
      const filtered = names.filter(name => name !== 'noStoreJson' && name !== 'requestJson')
      filtered.push('requestJson')
      text = text.replace(httpImport, `import { ${filtered.join(', ')} } from '@/lib/http'`)
    } else {
      text = `import { requestJson } from '@/lib/http'\n${text}`
    }
    text = text.replace(/\bnoStoreJson\s*\(/g, 'requestJson(request, ')
  }

  if (text !== original) {
    fs.writeFileSync(file, text, 'utf8')
    console.log(`[full-fix] patched ${path.relative(root, file)}`)
    changedFiles++
  }
}
console.log(`[full-fix] API files changed: ${changedFiles}`)
