import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) out.push(full)
  }
  return out
}

const sourceFiles = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'lib'))]
const apiFiles = walk(path.join(root, 'app', 'api'))

function exportedNames(file) {
  const text = fs.readFileSync(file, 'utf8')
  const names = new Set()
  for (const re of [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/g,
  ]) {
    for (const match of text.matchAll(re)) names.add(match[1])
  }
  for (const match of text.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const clean = part.trim().replace(/^type\s+/, '')
      if (!clean) continue
      const alias = clean.split(/\s+as\s+/i)
      names.add((alias[1] || alias[0]).trim())
    }
  }
  return names
}

function resolveLib(spec) {
  if (!spec.startsWith('@/lib/')) return null
  const rel = spec.slice(2)
  for (const candidate of [`${rel}.ts`, `${rel}.tsx`, path.join(rel, 'index.ts'), path.join(rel, 'index.tsx')]) {
    const full = path.join(root, candidate)
    if (fs.existsSync(full)) return full
  }
  return null
}

// Named imports must correspond to real exports.
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](@\/lib\/[^'"]+)['"]/g
  for (const match of text.matchAll(importRe)) {
    const target = resolveLib(match[2])
    if (!target) { failures.push(`unresolved lib import ${match[2]} in ${path.relative(root, file)}`); continue }
    const exports = exportedNames(target)
    for (const raw of match[1].split(',')) {
      const clean = raw.trim().replace(/^type\s+/, '')
      if (!clean) continue
      const imported = clean.split(/\s+as\s+/i)[0].trim()
      if (!exports.has(imported)) failures.push(`missing export ${imported} from ${path.relative(root, target)} (used by ${path.relative(root, file)})`)
    }
  }
}

function splitArgs(source) {
  const args=[]; let start=0, paren=0, brace=0, bracket=0, quote=null, escape=false
  for(let i=0;i<source.length;i++){
    const ch=source[i]
    if(quote){ if(escape){escape=false;continue} if(ch==='\\'){escape=true;continue} if(ch===quote)quote=null; continue }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
    if(ch==='(')paren++; else if(ch===')')paren--; else if(ch==='{')brace++; else if(ch==='}')brace--; else if(ch==='[')bracket++; else if(ch===']')bracket--;
    else if(ch===','&&paren===0&&brace===0&&bracket===0){args.push(source.slice(start,i).trim());start=i+1}
  }
  const tail=source.slice(start).trim(); if(tail||source.trim())args.push(tail); return args
}
function callArgs(text,name){
  const found=[]; const re=new RegExp(`\\b${name}\\s*\\(`,'g')
  for(const match of text.matchAll(re)){
    const open=text.indexOf('(',match.index); let depth=0,quote=null,escape=false,end=-1
    for(let i=open;i<text.length;i++){
      const ch=text[i]
      if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote=null;continue}
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
      if(ch==='(')depth++; else if(ch===')'&&--depth===0){end=i;break}
    }
    if(end>=0)found.push({args:splitArgs(text.slice(open+1,end)),index:match.index})
  }
  return found
}

for (const file of apiFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const rel = path.relative(root, file)

  const hasMutation = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/.test(text)
  if (hasMutation && !/\brequestId\s*\(|\brequestJson\s*\(/.test(text)) failures.push(`mutation route has no request ID: ${rel}`)

  for (const {args} of callArgs(text,'getEligibleProviderRules')) {
    if (args.length !== 1 || !args[0].trim().startsWith('{')) failures.push(`legacy getEligibleProviderRules signature: ${rel}`)
    else for (const key of ['fromCountry','toCountry','sourceCurrency','recipientCurrency','amount']) if (!new RegExp(`\\b${key}\\b`).test(args[0])) failures.push(`getEligibleProviderRules missing ${key}: ${rel}`)
  }
  for (const {args} of callArgs(text,'checkRateLimit')) {
    if (args.length < 4 || args.length > 5) failures.push(`invalid checkRateLimit arity (${args.length}): ${rel}`)
    if (args.length === 5 && !args[4].trim().startsWith('{')) failures.push(`legacy checkRateLimit subject signature: ${rel}`)
  }
  for (const {args} of callArgs(text,'buildRoutes')) {
    if (args.length !== 5) failures.push(`invalid buildRoutes arity (${args.length}): ${rel}`)
    else if (/\?\.|\?\?|\bnull\b|\bundefined\b/.test(args[4])) failures.push(`nullable buildRoutes recipientRate: ${rel}`)
  }
  for (const {args} of callArgs(text,'getReferenceFx')) if (args.length !== 2) failures.push(`invalid getReferenceFx arity (${args.length}): ${rel}`)
  for (const {args} of callArgs(text,'trustedMutationOrigin')) if (args.length !== 1) failures.push(`invalid trustedMutationOrigin arity (${args.length}): ${rel}`)
  for (const {args} of callArgs(text,'noStoreJson')) if (args.length === 2 && /^\d{3}$/.test(args[1].trim())) failures.push(`legacy bare-status noStoreJson call: ${rel}`)

  const forbidden = [
    ['synthetic retryAfter', /\b[A-Za-z_$][\w$]*\.retryAfter\b/],
    ['swallowed FX failure', /getReferenceFx[\s\S]{0,220}?\.catch\(\s*\(\)\s*=>\s*null\s*\)/],
    ['stale response serving', /stale-while-revalidate|stale-if-error/i],
  ]
  for (const [name, re] of forbidden) if (re.test(text)) failures.push(`${name}: ${rel}`)
}

// Dependency coherence: React trio must be pinned to one exact version in package.json and lockfile.
const pkgPath = path.join(root,'package.json')
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath,'utf8'))
  const deps = pkg.dependencies || {}
  const trio = ['react','react-dom','react-is'].map(k => [k,deps[k]])
  const versions = new Set(trio.map(([,v]) => v))
  if ([...trio].some(([,v]) => !/^\d+\.\d+\.\d+$/.test(v || ''))) failures.push('React/react-dom/react-is must use exact versions in package.json')
  if (versions.size !== 1) failures.push(`React version mismatch in package.json: ${trio.map(([k,v])=>`${k}=${v}`).join(', ')}`)
  const lockPath = path.join(root,'package-lock.json')
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath,'utf8'))
    const rootDeps = lock.packages?.['']?.dependencies || {}
    for (const [k,v] of trio) if (rootDeps[k] !== v) failures.push(`package-lock root mismatch for ${k}: lock=${rootDeps[k]} package=${v}`)
  }
}


// Zod 4 runtime contract: refined object schemas must never use .extend().
// We intentionally forbid .extend() in files importing Zod; safeExtend() is
// also valid for ordinary ZodObject schemas and prevents build-time crashes.
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8')
  if (/from\s+['"]zod['"]/.test(text) && /\.extend\s*\(/.test(text)) {
    failures.push(`unsafe Zod .extend() in ${path.relative(root, file)}; use .safeExtend()`)
  }
}

// Production dependency hardening policy for the August 2026 advisories.
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
if (pkg.devDependencies?.postcss !== '8.5.25') failures.push(`postcss must be pinned to 8.5.25 (found ${pkg.devDependencies?.postcss || '<missing>'})`)
if (pkg.dependencies?.sharp !== '0.35.3') failures.push(`sharp must be pinned to 0.35.3 (found ${pkg.dependencies?.sharp || '<missing>'})`)
if (pkg.overrides?.postcss !== '$postcss') failures.push('npm override for transitive postcss is missing')
if (pkg.overrides?.sharp !== '$sharp') failures.push('npm override for transitive sharp is missing')
if (pkg.engines?.node !== '>=20.9.0 <25') failures.push(`Node engine must be >=20.9.0 <25 (found ${pkg.engines?.node || '<missing>'})`)

if (failures.length) {
  const unique=[...new Set(failures)]
  console.error(`Full contract audit failed with ${unique.length} issue(s):`)
  for (const item of unique) console.error(`  - ${item}`)
  process.exit(1)
}
console.log(`Full contract audit passed: ${sourceFiles.length} source files, ${apiFiles.length} API files.`)
