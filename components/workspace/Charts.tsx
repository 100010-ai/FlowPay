'use client'

import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'

const tooltipStyle={background:'#fff',border:'1px solid #e7e9e4',borderRadius:10,boxShadow:'0 10px 30px rgba(20,38,26,.08)',fontSize:11,padding:'8px 10px'}
const compact=(value:number)=>new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(value)

type ChartDatum={label:string;value:number}

export function VolumeAreaChart({data,height=220,className,valueFormatter}:{data:ChartDatum[];height?:number;className?:string;valueFormatter?:(value:number)=>string}){
  const rawId=useId();const gradientId=`fp-area-${rawId.replace(/:/g,'')}`
  return <div className={cn('w-full',className)} style={{height}} role="img" aria-label="Payment volume chart">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{top:8,right:4,left:-20,bottom:0}}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6caf82" stopOpacity={.28}/><stop offset="100%" stopColor="#6caf82" stopOpacity={.02}/></linearGradient></defs>
        <CartesianGrid vertical={false}/>
        <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24}/>
        <YAxis axisLine={false} tickLine={false} tickFormatter={(v)=>compact(Number(v))}/>
        <Tooltip contentStyle={tooltipStyle} cursor={{stroke:'#dce4dd',strokeWidth:1}} formatter={(v)=>valueFormatter?valueFormatter(Number(v)):new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(Number(v))}/>
        <Area type="monotone" dataKey="value" stroke="#187a45" strokeWidth={2} fill={`url(#${gradientId})`} dot={{r:2.3,fill:'#187a45',stroke:'#fff',strokeWidth:1.5}} activeDot={{r:4,fill:'#187a45',stroke:'#fff',strokeWidth:2}} animationDuration={650}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>
}

export function DistributionBars({data,height=180,valueFormatter}:{data:ChartDatum[];height?:number;valueFormatter?:(value:number)=>string}){
  return <div className="w-full" style={{height}} role="img" aria-label="Distribution chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:8,right:0,left:-25,bottom:0}}><CartesianGrid vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={v=>compact(Number(v))}/><Tooltip cursor={{fill:'#f5f7f3'}} contentStyle={tooltipStyle} formatter={(v)=>valueFormatter?valueFormatter(Number(v)):new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(Number(v))}/><Bar dataKey="value" radius={[5,5,2,2]} fill="#82bd91" animationDuration={600}/></BarChart></ResponsiveContainer></div>
}

export function SavingsDonut({data,totalLabel,valueFormatter}:{data:{name:string;value:number;color:string}[];totalLabel:string;valueFormatter?:(value:number)=>string}){
  const total=data.reduce((s,x)=>s+x.value,0)
  return <div className="relative h-[210px]" role="img" aria-label={totalLabel}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={57} outerRadius={77} paddingAngle={1.5} stroke="none" animationDuration={650}>{data.map((item)=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v)=>valueFormatter?valueFormatter(Number(v)):new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(Number(v))}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><strong className="block text-[20px] font-semibold tracking-[-.04em]">{valueFormatter?valueFormatter(total):compact(total)}</strong><span className="text-[14px] text-[var(--fp-muted)]">{totalLabel}</span></div></div></div>
}
