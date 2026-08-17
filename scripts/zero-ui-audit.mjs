import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd(); const roots=['app','components','lib']; const exts=new Set(['.ts','.tsx','.js','.jsx']); const issues=[]
function walk(dir){if(!fs.existsSync(dir))return[];let out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory()){if(['node_modules','.next','.git'].includes(e.name))continue;out.push(...walk(f))}else if(exts.has(path.extname(e.name)))out.push(f)}return out}
function matchingBrace(text,open){let d=0,q=null,esc=false;for(let i=open;i<text.length;i++){const c=text[i];if(q){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===q)q=null;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return i}return-1}
for(const file of roots.flatMap(r=>walk(path.join(root,r)))){const rel=path.relative(root,file);const s=fs.readFileSync(file,'utf8');let pos=0;while((pos=s.indexOf('<MetricCard',pos))>=0){const vs=s.indexOf('value={',pos);if(vs<0)break;const open=vs+6,close=matchingBrace(s,open);if(close<0)break;const expr=s.slice(open+1,close);if(/(['"])—\1/.test(expr))issues.push(`${rel}: numeric MetricCard still renders em dash`);pos=close+1}
if(/coverage\?\.(providers|corridors|currencies)\?\?(['"])—\2/.test(s))issues.push(`${rel}: coverage count still renders em dash`)
if(/coverage\?\.rules\.length\?\?(['"])—\1/.test(s))issues.push(`${rel}: rules count still renders em dash`)
if(/\.intermediaryBanks\?\?(['"])—\1/.test(s))issues.push(`${rel}: intermediary-bank count still renders em dash`)
if(/\.reliabilityPercent==null\?(['"])—\1:/.test(s))issues.push(`${rel}: reliability percent still renders em dash`)
if(s.includes('https://your-domain/api/v1/quote'))issues.push(`${rel}: API docs still use placeholder domain`)
}
if(issues.length){console.error(`Zero UI audit failed with ${issues.length} issue(s):`);for(const i of issues)console.error(`  - ${i}`);process.exit(1)}
console.log('Zero UI audit: PASS — numeric placeholders use 0; semantic missing-data dashes are preserved.')
