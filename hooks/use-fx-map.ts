'use client'
import { useEffect, useMemo, useState } from 'react'

type RateState={loading:boolean;rates:Record<string,number>;missing:string[];error:string|null;date:string|null}
export function useFxMap(baseCurrency:string|null|undefined,currencies:string[]):RateState{
  const [state,setState]=useState<RateState>({loading:false,rates:{},missing:[],error:null,date:null})
  const key=useMemo(()=>Array.from(new Set(currencies.filter(Boolean).map(c=>c.toUpperCase()))).sort().join(','),[currencies])
  useEffect(()=>{
    const controller=new AbortController()
    if(!baseCurrency){setState({loading:false,rates:{},missing:[],error:null,date:null});return()=>controller.abort()}
    const base=baseCurrency.toUpperCase();const targets=key?key.split(','):[]
    if(!targets.length){setState({loading:false,rates:{},missing:[],error:null,date:null});return()=>controller.abort()}
    setState(s=>({...s,loading:true,error:null}))
    fetch(`/api/fx?sources=${encodeURIComponent(targets.join(','))}&target=${encodeURIComponent(base)}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('FX_FAILED');return response.json()})
      .then(data=>{if(controller.signal.aborted)return;const rates:Record<string,number>={};for(const [code,value] of Object.entries(data.rates||{})){const rate=Number(value);if(Number.isFinite(rate)&&rate>0)rates[code]=rate}setState({loading:false,rates,missing:Array.isArray(data.missing)?data.missing:[],error:null,date:typeof data.date==='string'?data.date:null})})
      .catch(error=>{if(controller.signal.aborted)return;setState({loading:false,rates:{},missing:targets,error:error instanceof Error?error.message:'FX_FAILED',date:null})})
    return()=>controller.abort()
  },[baseCurrency,key])
  return state
}
