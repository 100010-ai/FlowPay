const fs=require('fs');const path=require('path');let ts;try{ts=require('typescript')}catch{try{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}catch(e){console.error('TypeScript is required for runtime audit');process.exit(1)}}
const root=path.resolve(__dirname,'..');
function load(rel){const file=path.join(root,rel);const src=fs.readFileSync(file,'utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const mod={exports:{}};new Function('module','exports','require',js)(mod,mod.exports,(id)=>{if(id.startsWith('./'))return {};return require(id)});return mod.exports}
function ok(cond,msg){if(!cond){console.error('Runtime audit failed:',msg);process.exit(1)}}
const routing=load('lib/routing.ts');
const rules=[
{id:'global',provider_code:'p1',display_name:'Global',from_country:'*',to_country:'*',fee_percent:.5,fixed_fee:2,fx_markup_percent:.2,speed_minutes:1440,priority:1,reliability_percent:95},
{id:'specific',provider_code:'p1',display_name:'Specific',from_country:'FR',to_country:'TR',fee_percent:.2,fixed_fee:1,fx_markup_percent:.1,speed_minutes:120,priority:3,reliability_percent:99},
{id:'p2',provider_code:'p2',display_name:'Second',from_country:'FR',to_country:'TR',fee_percent:.6,fixed_fee:3,fx_markup_percent:.1,speed_minutes:60,priority:2,reliability_percent:97},
{id:'bad',provider_code:'bad',from_country:'FR',to_country:'TR',fee_percent:-1,fixed_fee:0,fx_markup_percent:0,speed_minutes:10,priority:1}
];
const routes=routing.buildRoutes(rules,10000,'FR','TR',2);
ok(routes.length===2,'invalid rules must be excluded and provider rules deduplicated');
ok(routes.some(r=>r.providerCode==='p1'&&r.providerName==='Specific'),'corridor-specific rule must beat wildcard');
ok(routes.every(r=>r.recipientGets===20000),'recipient FX reference must be applied to principal');
ok(routes[0].score>=routes[1].score,'routes must be score ordered');
ok(routing.estimatedSaving(routes)>=0,'estimated saving must be non-negative');
const v=load('lib/payment-validation.ts');
ok(v.isValidIban('GB82 WEST 1234 5698 7654 32'),'known valid IBAN rejected');
ok(!v.isValidIban('GB82 WEST 1234 5698 7654 31'),'invalid IBAN accepted');
ok(v.isValidBic('DEUTDEFF500'),'valid BIC rejected');
ok(!v.isValidBic('INVALID'),'invalid BIC accepted');
const csv=load('lib/csv.ts');
const rows=csv.csvRecords('name,country,notes\n"ACME, Ltd",FR,"one, two"\n');
ok(rows.length===1&&rows[0].name==='ACME, Ltd'&&rows[0].notes==='one, two','CSV quoted field parsing failed');
console.log('Runtime audit passed: routing, FX projection, IBAN/BIC and CSV invariants verified.')
