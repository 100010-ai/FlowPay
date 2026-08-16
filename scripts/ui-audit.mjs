import fs from 'node:fs'
import path from 'node:path'
const roots=['app','components','lib','hooks']
const files=[]
for(const root of roots){walk(root)}
function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(ts|tsx|css)$/.test(entry.name))files.push(p)}}
const checks=[
  ['forbidden mock company',/Acme Industries|Mavi Tekstil|Alex Martin|€24\.78M|€721K/i],
  ['legacy dark theme selectors',/data-theme|flowpay-theme|prefers-color-scheme:\s*dark/i],
  ['black surface utilities',/bg-(black|\[#0{3,6}\]|\[#111\])/i],
  ['legacy workspace component',/WorkspaceApp/],
  ['native select control',/<select\b/i],
]
let failed=false
for(const [name,re] of checks){for(const file of files){const text=fs.readFileSync(file,'utf8');if(re.test(text)){console.error(`FAIL ${name}: ${file}`);failed=true}}}
if(failed)process.exit(1)
console.log(`UI audit passed: ${files.length} source files scanned.`)
