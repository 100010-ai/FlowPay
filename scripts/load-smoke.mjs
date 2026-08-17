import process from 'node:process'
import { performance } from 'node:perf_hooks'

const configuredBase=process.env.FLOWPAY_LOAD_BASE_URL?.trim()
if(!configuredBase){console.error('FLOWPAY_LOAD_BASE_URL is required');process.exit(2)}
const base=configuredBase.replace(/\/$/,'')
const concurrency=Math.max(1,Math.min(50,Number(process.env.FLOWPAY_LOAD_CONCURRENCY||10)))
const total=Math.max(concurrency,Math.min(2000,Number(process.env.FLOWPAY_LOAD_REQUESTS||100)))
const timeoutMs=Math.max(1000,Math.min(30000,Number(process.env.FLOWPAY_LOAD_TIMEOUT_MS||8000)))
let quotePayload=null
if(process.env.FLOWPAY_LOAD_QUOTE_PAYLOAD){
  try{quotePayload=JSON.parse(process.env.FLOWPAY_LOAD_QUOTE_PAYLOAD)}catch{console.error('FLOWPAY_LOAD_QUOTE_PAYLOAD must be valid JSON');process.exit(1)}
}
const targets=[
  {path:'/api/health'},
  {path:'/api/coverage'},
  ...(quotePayload?[{path:'/api/quote',method:'POST',body:JSON.stringify(quotePayload)}]:[]),
]

const samples=[]
const byPath=new Map()
let errors=0
let index=0

async function hit(i){
  const target=targets[i%targets.length]
  const started=performance.now()
  let status=0
  try{
    const response=await fetch(`${base}${target.path}`,{
      method:target.method||'GET',
      body:target.body,
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'User-Agent':'FlowPay-Load-Smoke/1.3',...(target.body?{'Content-Type':'application/json'}:{})},
    })
    status=response.status
    await response.arrayBuffer()
    const ms=performance.now()-started
    samples.push(ms)
    if(!response.ok && response.status!==429 && response.status!==503) errors++
  }catch{
    samples.push(performance.now()-started)
    errors++
  }
  const row=byPath.get(target.path)||{count:0,total:0,max:0,statuses:new Map()}
  const elapsed=performance.now()-started
  row.count++;row.total+=elapsed;row.max=Math.max(row.max,elapsed);row.statuses.set(status,(row.statuses.get(status)||0)+1);byPath.set(target.path,row)
}

async function worker(){while(true){const i=index++;if(i>=total)return;await hit(i)}}
await Promise.all(Array.from({length:concurrency},()=>worker()))
samples.sort((a,b)=>a-b)
const percentile=p=>samples[Math.min(samples.length-1,Math.floor((samples.length-1)*p))]||0
const avg=samples.reduce((a,b)=>a+b,0)/Math.max(1,samples.length)
const errorRate=errors/Math.max(1,total)
console.log(`FlowPay load smoke: ${total} requests, concurrency ${concurrency}`)
console.log(`avg ${avg.toFixed(1)} ms · p50 ${percentile(.5).toFixed(1)} ms · p95 ${percentile(.95).toFixed(1)} ms · p99 ${percentile(.99).toFixed(1)} ms · errors ${errors} (${(errorRate*100).toFixed(1)}%)`)
for(const [path,row] of byPath)console.log(`${path}: ${row.count} req · avg ${(row.total/row.count).toFixed(1)} ms · max ${row.max.toFixed(1)} ms · statuses ${[...row.statuses].map(([s,n])=>`${s||'ERR'}:${n}`).join(', ')}`)
if(errorRate>.02){console.error('Load smoke failed: unexpected error rate exceeded 2%.');process.exit(1)}
