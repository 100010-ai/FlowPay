import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

// Next.js route types are generated artifacts. If routes were moved/removed,
// stale validators under .next/types can keep importing files that no longer
// exist. Always remove generated Next output before type generation/build.
const generatedPaths = [
  '.next',
  'tsconfig.tsbuildinfo',
]

for (const path of generatedPaths) {
  try {
    await rm(resolve(process.cwd(), path), { force: true, recursive: true })
  } catch (error) {
    console.error(`[cleanup] failed to remove generated path: ${path}`)
    throw error
  }
}

console.log(`[cleanup] generated Next/TypeScript artifacts removed: ${generatedPaths.length}`)
