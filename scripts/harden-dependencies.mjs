import fs from 'node:fs'

const file = 'package.json'
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))

pkg.dependencies ||= {}
pkg.devDependencies ||= {}
pkg.overrides ||= {}
pkg.engines ||= {}

// Keep the application on its current Next.js major while replacing the two
// vulnerable transitive packages reported by npm audit with patched releases.
pkg.devDependencies.postcss = '8.5.25'
pkg.dependencies.sharp = '0.35.3'
pkg.overrides.postcss = '$postcss'
pkg.overrides.sharp = '$sharp'
pkg.engines.node = '>=20.9.0 <25'

fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
console.log('[deps] pinned postcss@8.5.25 and sharp@0.35.3; Node >=20.9.0 required')
