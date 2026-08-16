import fs from 'node:fs'
import path from 'node:path'

const roots=['app/(workspace)','components']
const files=[]
for(const root of roots) walk(root)
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx|ts)$/.test(e.name)&&!p.endsWith('WorkspaceProvider.tsx')&&!p.includes('app/(workspace)/admin/'))files.push(p)}}
const forbidden=[
  ['database vendor name',/\bSupabase\b/],
  ['database table name',/provider_rules|provider rules/i],
  ['security implementation jargon',/\bRLS\b|row level security/i],
  ['mock/demo copy',/mock data|demo data|test data/i],
  ['internal design-system copy',/approved (?:light )?design system|утвержд[её]нн(?:ая|ый) .*дизайн-систем/i],
]
let failed=false
for(const file of files){const text=fs.readFileSync(file,'utf8');for(const [name,re] of forbidden){if(re.test(text)){console.error(`FAIL ${name}: ${file}`);failed=true}}}
if(failed)process.exit(1)
console.log(`Commercial copy audit passed: ${files.length} customer-facing source files scanned.`)
