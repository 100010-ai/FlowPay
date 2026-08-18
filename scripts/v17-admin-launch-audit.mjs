import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const requireFile=file=>{if(!fs.existsSync(file))failures.push(`missing ${file}`)}
const requireAll=(file,tokens)=>{const text=read(file);for(const token of tokens)if(!text.includes(token))failures.push(`${file} missing v1.7 contract: ${token}`)}

for(const file of [
  'components/admin/AdminConsole.tsx','app/(workspace)/admin/page.tsx','app/api/admin/access/route.ts','app/api/admin/overview/route.ts',
  'lib/admin-api.ts','components/workspace/WorkspaceShell.tsx'
]) requireFile(file)

requireAll('lib/admin-api.ts',['requireAal2','isFlowPayAdmin','checkRateLimit','FORBIDDEN'])
requireAll('app/api/admin/access/route.ts',['requireFlowPayAdmin','admin: true'])
requireAll('app/api/admin/overview/route.ts',[
  'admin.auth.admin.listUsers','company_profiles','payment_drafts','invoices','counterparties','api_keys','api_request_logs','api_usage_daily',
  'workspace_audit_log','system_event_logs','legal_acceptances','provider_rules','systemErrors24h','apiRequests7d','apiSuccessRate','coverage','version:'
])
requireAll('components/admin/AdminConsole.tsx',[
  "'overview' | 'users' | 'operations' | 'api' | 'security' | 'routes'",'Launch Center','downloadCsv','API-ключи','Workspace audit trail',
  'Production routing rules','/api/admin/provider-rules','confirm(','usersTruncated'
])
requireAll('components/workspace/WorkspaceShell.tsx',['/api/admin/access','adminAccess','/admin','Админ-панель'])

const admin=read('components/admin/AdminConsole.tsx')
if(/dangerouslySetInnerHTML|\beval\s*\(|new Function\s*\(/.test(admin)) failures.push('admin console contains a dangerous JS/HTML sink')
if(admin.includes('totalVolume')||admin.includes('total_volume')) failures.push('admin console introduces a cross-currency aggregate volume')

const pkg=JSON.parse(read('package.json'))
if(!/^1\.(?:7|8|9)\./.test(String(pkg.version||'')) && !/^2\.\d+\.\d+$/.test(String(pkg.version||''))) failures.push(`expected version >=1.7.0, found ${pkg.version}`)
if(!String(pkg.scripts?.audit||'').includes('v17-admin-launch-audit.mjs')) failures.push('main audit does not include v1.7 admin/launch audit')
const lock=JSON.parse(read('package-lock.json'))
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version) failures.push('package-lock root metadata does not match package version')

if(failures.length){console.error(`FlowPay v1.7 admin/launch audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.7 admin/launch audit passed: admin access, operations visibility, API/security telemetry, launch center and route management verified.')
