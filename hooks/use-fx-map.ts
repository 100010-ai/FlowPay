'use client'
import { useEffect, useMemo, useState } from 'react'

type RateState={loading:boolean;rates:Record<string,number>;missing:string[];error:string|null;date:string|null}
export function useFxMap(baseCurrency:string|null|undefined,currencies:string[]):RateState{
  const [state,setState]=useState<RateState>({loading:false,rates:{},missing:[],error:null,date:null})
  const key=useMemo(()=>Array.from(new Set(currencies.filter(Boolean).map(c=>c.toUpperCase()))).sort().join(','),[currencies])
  useEffect(()=>{
    let cancelled=false
    if(!baseCurrency){setState({loading:false,rates:{},missing:[],error:null,date:null});return}
    const base=baseCurrency.toUpperCase();const list=key?key.split(','):[]
    const targets=Array.from(new Set(list));
    setState(s=>({...s,loading:true,error:null}))
    Promise.all(targets.map(async source=>{
      if(source===base)return {source,rate:1,date:null as string|null}
      const response=await fetch(`/api/fx?source=${encodeURIComponent(source)}&target=${encodeURIComponent(base)}`)
      if(!response.ok)return {source,rate:null,date:null}
      const data=await response.json();return {source,rate:Number(data.rate),date:data.date as string|null}
    })).then(rows=>{if(cancelled)return;const rates:Record<string,number>={};const missing:string[]=[];let date:string|null=null;for(const row of rows){if(typeof row.rate==='number'&&Number.isFinite(row.rate)){rates[row.source]=row.rate;if(row.date)date=row.date}else missing.push(row.source)}setState({loading:false,rates,missing,error:null,date})}).catch(err=>{if(!cancelled)setState({loading:false,rates:{},missing:targets,error:err instanceof Error?err.message:'FX_FAILED',date:null})})
    return()=>{cancelled=true}
  },[baseCurrency,key])
  return state
}
