import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packagePath = path.join(root, 'package.json')
const lockPath = path.join(root, 'package-lock.json')

if (!fs.existsSync(packagePath)) {
  console.error('[lock-sync] package.json not found')
  process.exit(1)
}
if (!fs.existsSync(lockPath)) {
  console.error('[lock-sync] package-lock.json not found')
  process.exit(1)
}

let pkg
let lock
try {
  pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
} catch (error) {
  console.error(`[lock-sync] invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

if (typeof pkg.name !== 'string' || !pkg.name.trim()) {
  console.error('[lock-sync] package.json name is missing')
  process.exit(1)
}
if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version)) {
  console.error(`[lock-sync] invalid package.json version: ${String(pkg.version)}`)
  process.exit(1)
}
if (!lock.packages || typeof lock.packages !== 'object' || !lock.packages['']) {
  console.error('[lock-sync] package-lock.json root package metadata is missing')
  process.exit(1)
}

const before = {
  name: lock.name,
  version: lock.version,
  rootName: lock.packages[''].name,
  rootVersion: lock.packages[''].version,
}

lock.name = pkg.name
lock.version = pkg.version
lock.packages[''].name = pkg.name
lock.packages[''].version = pkg.version

fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8')

const changed = before.name !== lock.name ||
  before.version !== lock.version ||
  before.rootName !== lock.packages[''].name ||
  before.rootVersion !== lock.packages[''].version

console.log(changed
  ? `[lock-sync] package-lock metadata synchronized to ${pkg.name}@${pkg.version}`
  : `[lock-sync] package-lock metadata already matches ${pkg.name}@${pkg.version}`)
