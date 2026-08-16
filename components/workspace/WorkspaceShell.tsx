'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, Bell, BookOpenText, Building2, ChevronDown, CircleHelp, Code2, FileText, Globe2, LayoutDashboard, Menu, Plus, ReceiptText, RefreshCw, Route, Search, Settings, Users, WalletCards, X } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Button } from '@/components/ui/button'
import { SelectMenu } from '@/components/ui/select-menu'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageContext'
import { workspaceDictionaries } from '@/lib/workspace-i18n'
import { workspaceCopy } from '@/lib/workspace-copy'
import { initials, cn } from '@/lib/utils'
import { useWorkspace } from './WorkspaceProvider'
import { WorkspaceLoading } from './WorkspaceLoading'
import type { Language } from '@/lib/types'

const iconMap={overview:LayoutDashboard,payments:WalletCards,counterparties:Users,routes:Route,analytics:BarChart3,reports:BookOpenText,settings:Settings,invoices:ReceiptText,team:Building2,api:Code2}
const primary=[['overview','/dashboard'],['payments','/payments'],['counterparties','/counterparties'],['routes','/routes'],['analytics','/analytics'],['reports','/reports'],['settings','/settings']] as const
const more=[['invoices','/invoices'],['api','/developer']] as const

const languageOptions=[{value:'ru',label:'Русский'},{value:'en',label:'English'},{value:'fr',label:'Français'},{value:'de',label:'Deutsch'},{value:'es',label:'Español'}]

export function WorkspaceShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const {lang,setLang}=useLanguage();const t=workspaceDictionaries[lang];const copy=workspaceCopy[lang];const ws=useWorkspace()
  const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState('');const [activityOpen,setActivityOpen]=useState(false);const [profileOpen,setProfileOpen]=useState(false);const [mobileOpen,setMobileOpen]=useState(false);const activityRef=useRef<HTMLDivElement>(null);const profileRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true)}if(e.key==='Escape'){setSearchOpen(false);setActivityOpen(false);setProfileOpen(false);setMobileOpen(false)}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[])
  useEffect(()=>{const fn=(e:MouseEvent)=>{if(activityRef.current&&!activityRef.current.contains(e.target as Node))setActivityOpen(false);if(profileRef.current&&!profileRef.current.contains(e.target as Node))setProfileOpen(false)};document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)},[])
  const needsSetup=!ws.loading&&Boolean(ws.user)&&(!ws.profile?.name?.trim()||!ws.profile?.country||!ws.profile?.preferred_currency)
  useEffect(()=>{if(needsSetup)router.replace('/onboarding')},[needsSetup,router])

  const activities=useMemo(()=>{
    const rows:{id:string;title:string;subtitle:string;date:string;tone:'success'|'info'|'warning'|'neutral'}[]=[]
    const profile=ws.profile
    const now=new Date();now.setHours(0,0,0,0)
    const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1)
    for(const p of ws.payments.slice(0,20)){
      const isConfirmation=p.status==='received'||p.status==='paid'
      if(isConfirmation&&profile?.notify_payment_confirmations===false)continue
      if(p.status==='draft'&&profile?.notify_payment_confirmations===false)continue
      rows.push({
        id:`p-${p.id}`,
        title:p.status==='received'?(lang==='ru'?'Платёж получен':'Payment received'):p.status==='paid'?(lang==='ru'?'Платёж оплачен':'Payment paid'):p.status==='ready'?(lang==='ru'?'Платёж готов к оплате':'Payment ready'):(lang==='ru'?'Платёж обновлён':'Payment updated'),
        subtitle:`${p.supplier_name} · ${p.currency} ${Number(p.amount).toLocaleString()}`,
        date:p.updated_at,
        tone:isConfirmation?'success':p.status==='ready'?'info':'neutral'
      })
      if(profile?.notify_payment_failures!==false&&['draft','ready'].includes(p.status)&&p.due_date){
        const due=new Date(`${p.due_date}T00:00:00`)
        if(due<now)rows.push({id:`overdue-${p.id}`,title:lang==='ru'?'Срок платежа истёк':'Payment overdue',subtitle:p.supplier_name,date:p.due_date,tone:'warning'})
        else if(due.getTime()===tomorrow.getTime())rows.push({id:`due-${p.id}`,title:lang==='ru'?'Срок платежа завтра':'Payment due tomorrow',subtitle:p.supplier_name,date:p.due_date,tone:'warning'})
      }
    }
    for(const c of ws.calculations.slice(0,5))rows.push({id:`c-${c.id}`,title:lang==='ru'?'Сравнение маршрутов готово':'Route comparison ready',subtitle:`${c.from_country} → ${c.to_country} · ${c.currency} ${Number(c.amount).toLocaleString()}`,date:c.created_at,tone:'success'})
    if(profile?.notify_security_alerts!==false){
      for(const a of ws.auditLogs.filter(row=>row.entity_type==='api_keys').slice(0,4))rows.push({id:`security-${a.id}`,title:a.action==='delete'||a.action==='update'?(lang==='ru'?'Изменён API-доступ':'API access changed'):(lang==='ru'?'Создан API-ключ':'API key created'),subtitle:lang==='ru'?'Проверьте доступы, если это действие выполняли не вы.':'Review access if you did not make this change.',date:a.created_at,tone:'warning'})
    }
    return rows.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index).slice(0,10)
  },[ws.payments,ws.calculations,ws.auditLogs,ws.profile,lang])

  const searchItems=useMemo(()=>{
    const q=query.trim().toLowerCase();const nav=[...primary,...more].map(([key,path])=>({type:'page',id:path,label:t.nav[key as keyof typeof t.nav],meta:path,path}))
    const cps=ws.counterparties.map(c=>({type:'counterparty',id:c.id,label:c.name,meta:`${c.country} · ${c.currency}`,path:`/counterparties?selected=${c.id}`}))
    const pays=ws.payments.map(p=>({type:'payment',id:p.id,label:p.invoice_number||p.supplier_name,meta:`${p.supplier_name} · ${p.currency} ${Number(p.amount).toLocaleString()}`,path:`/payments?selected=${p.id}`}))
    return [...nav,...cps,...pays].filter(item=>!q||`${item.label} ${item.meta}`.toLowerCase().includes(q)).slice(0,14)
  },[query,t,ws.counterparties,ws.payments])

  async function signOut(){await createClient().auth.signOut();router.replace('/login');router.refresh()}
  if(ws.loading)return <WorkspaceLoading/>
  if(needsSetup)return <WorkspaceLoading/>
  if(ws.error)return <div className="grid min-h-screen place-items-center bg-[var(--fp-bg)] p-6"><div className="w-full max-w-lg rounded-2xl border border-[var(--fp-border)] bg-white p-7 shadow-[var(--fp-shadow-lg)]"><FlowPayLogo/><div className="mt-8 rounded-xl bg-[var(--fp-red-soft)] p-4 text-[14px] text-[var(--fp-red)]"><strong className="block text-[14px]">{t.shell.setupRequired}</strong><p className="mt-1 leading-5">{t.shell.setupText}</p></div><Button className="mt-5" onClick={()=>ws.refresh()}><RefreshCw size={15}/>{t.common.refresh}</Button></div></div>

  const company=ws.profile?.name?.trim()||(lang==='ru'?'Личный аккаунт':lang==='fr'?'Compte personnel':lang==='de'?'Persönliches Konto':lang==='es'?'Cuenta personal':'Personal account')
  return <div className="min-h-screen bg-[var(--fp-bg)] text-[var(--fp-text)]">
    <aside className="fp-shell-sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-[var(--fp-border)] bg-white lg:flex lg:flex-col">
      <div className="flex h-[76px] items-center px-5"><Link href="/dashboard"><FlowPayLogo/></Link></div>
      <nav className="flex-1 px-3 pt-3"><div>{primary.map(([key,path])=>{const Icon=iconMap[key];const active=pathname===path||pathname.startsWith(`${path}/`);return <Link key={key} href={path} className={cn('mb-1 flex h-11 items-center gap-3 rounded-[12px] px-3.5 text-[15px] font-medium text-[#3f4842] transition hover:bg-[#f5f6f3] hover:text-[var(--fp-text)]',active&&'bg-[#eaf2eb] text-[var(--fp-green-strong)] shadow-[inset_0_0_0_1px_rgba(24,122,69,.035)]')}><Icon size={18} strokeWidth={1.8}/><span>{t.nav[key]}</span></Link>})}</div><div className="mx-3 my-4 border-t border-[var(--fp-border)]"/><div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--fp-subtle)]">{lang==='ru'?'Дополнительно':lang==='fr'?'Plus':lang==='de'?'Weitere':lang==='es'?'Más':'More'}</div>{more.map(([key,path])=>{const Icon=iconMap[key];const active=pathname===path||pathname.startsWith(`${path}/`);return <Link key={key} href={path} className={cn('mb-1 flex h-10 items-center gap-3 rounded-[11px] px-3.5 text-[14px] font-medium text-[#59635d] transition hover:bg-[#f5f6f3] hover:text-[var(--fp-text)]',active&&'bg-[#f0f5f0] text-[var(--fp-green-strong)]')}><Icon size={17} strokeWidth={1.8}/><span>{t.nav[key as keyof typeof t.nav]}</span></Link>})}</nav>
      <div className="p-4"><Link href="/settings" className="block rounded-[14px] border border-[var(--fp-border)] bg-[linear-gradient(180deg,#fbfcfa,#f6f9f6)] p-4 transition hover:border-[#cedbd0] hover:bg-white"><span className="flex items-center gap-2 text-[14px] font-semibold"><CircleHelp size={17} className="text-[var(--fp-green)]"/>{t.shell.help}</span><p className="mt-2 text-[14px] leading-5 text-[var(--fp-muted)]">{t.shell.helpText}</p></Link></div>
    </aside>

    <div className="fp-shell-main lg:pl-[248px]">
      <header className="fp-shell-topbar sticky top-0 z-30 flex h-[76px] items-center border-b border-[var(--fp-border)] bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <button className="mr-3 grid size-9 place-items-center rounded-lg text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)] lg:hidden" onClick={()=>setMobileOpen(true)} aria-label="Menu"><Menu size={20}/></button>
        <button onClick={()=>setSearchOpen(true)} className="hidden h-10 w-full max-w-[520px] items-center gap-2 rounded-[10px] border border-[var(--fp-border)] bg-white px-3.5 text-left text-[15px] text-[var(--fp-subtle)] transition hover:border-[var(--fp-border-strong)] sm:flex"><Search size={16}/><span className="flex-1 truncate">{t.common.search}</span><kbd className="rounded-md border border-[var(--fp-border)] bg-[#f7f8f5] px-1.5 py-0.5 text-[14px] text-[var(--fp-muted)]">⌘K</kbd></button>
        <Link className="lg:hidden sm:ml-2" href="/dashboard"><FlowPayLogo compact/></Link>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative" ref={activityRef}><button onClick={()=>setActivityOpen(v=>!v)} className="relative grid size-9 place-items-center rounded-lg text-[#303a34] hover:bg-[var(--fp-surface-muted)]" aria-label={t.shell.notifications}><Bell size={18} strokeWidth={1.7}/>{activities.length>0&&<span className="absolute right-1.5 top-1.5 grid min-w-[14px] place-items-center rounded-full bg-[var(--fp-green)] px-1 text-[14px] font-bold leading-[14px] text-white">{Math.min(activities.length,9)}</span>}</button>{activityOpen&&<div className="fp-pop absolute right-0 top-11 w-[330px] overflow-hidden rounded-[14px] border border-[var(--fp-border)] bg-white shadow-[var(--fp-shadow-lg)]"><div className="flex items-center justify-between border-b border-[var(--fp-border)] px-4 py-3"><strong className="text-[14px]">{t.shell.notifications}</strong><Activity size={15} className="text-[var(--fp-muted)]"/></div><div className="fp-scrollbar max-h-[390px] overflow-auto p-2">{activities.length?activities.map(a=><div key={a.id} className="rounded-lg px-3 py-2.5 hover:bg-[#f7f8f5]"><div className="flex items-center justify-between gap-3"><span className="text-[14px] font-semibold">{a.title}</span><Badge tone={a.tone} className="h-5 px-1.5 text-[14px]">{new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(a.date))}</Badge></div><p className="mt-1 truncate text-[14px] text-[var(--fp-muted)]">{a.subtitle}</p></div>):<p className="p-6 text-center text-[14px] text-[var(--fp-muted)]">{t.shell.noNotifications}</p>}</div></div>}</div>
          <div className="hidden md:block"><SelectMenu value={lang} onChange={v=>setLang(v as Language)} options={languageOptions.map(o=>({...o,leading:<Globe2 size={14}/>}))} compact align="right" ariaLabel={t.settings.language} triggerClassName="w-[132px] border-transparent bg-transparent hover:border-[var(--fp-border)] hover:bg-[var(--fp-surface-muted)]"/></div>
          <div className="relative" ref={profileRef}><button onClick={()=>setProfileOpen(v=>!v)} className="ml-1 flex h-10 items-center gap-2 rounded-[10px] px-2 hover:bg-[var(--fp-surface-muted)]"><span className="grid size-8 place-items-center rounded-full bg-[#e8efe9] text-[14px] font-bold text-[var(--fp-green-strong)]">{initials(company)}</span><span className="hidden max-w-[150px] text-left xl:block"><strong className="block truncate text-[15px] font-semibold">{company}</strong><small className="block truncate text-[14px] text-[var(--fp-muted)]">{ws.user?.email}</small></span><ChevronDown size={14} className="hidden text-[var(--fp-subtle)] xl:block"/></button>{profileOpen&&<div className="fp-pop absolute right-0 top-12 w-56 rounded-[12px] border border-[var(--fp-border)] bg-white p-1.5 shadow-[var(--fp-shadow-lg)]"><Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] hover:bg-[var(--fp-surface-muted)]"><Settings size={15}/>{t.nav.settings}</Link><button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-[var(--fp-red)] hover:bg-[var(--fp-red-soft)]"><X size={15}/>{t.shell.signOut}</button></div>}</div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-76px)] w-full max-w-[1580px] px-4 pb-24 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12 xl:px-10">{children}</main>
    </div>

    <nav className="fp-shell-mobile-nav fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-[var(--fp-border)] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {([['overview','/dashboard'],['payments','/payments']] as const).map(([key,path])=>{const Icon=iconMap[key];const active=pathname===path;return <Link key={key} href={path} className={cn('flex flex-col items-center justify-center gap-1 text-[14px] font-medium text-[var(--fp-muted)]',active&&'text-[var(--fp-green)]')}><Icon size={18}/>{t.nav[key]}</Link>})}
      <Link href="/payments?new=1" className="mx-auto -mt-4 grid size-12 place-items-center self-center rounded-full bg-[var(--fp-green)] text-white shadow-lg shadow-green-900/15"><Plus size={22}/></Link>
      <Link href="/routes" className={cn('flex flex-col items-center justify-center gap-1 text-[14px] font-medium text-[var(--fp-muted)]',pathname==='/routes'&&'text-[var(--fp-green)]')}><Route size={18}/>{t.nav.routes}</Link>
      <button onClick={()=>setMobileOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[14px] font-medium text-[var(--fp-muted)]"><Menu size={18}/>{copy.common.more}</button>
    </nav>

    {mobileOpen&&<div className="fixed inset-0 z-[90] bg-[rgba(20,34,25,.20)] backdrop-blur-[2px] lg:hidden" onMouseDown={e=>{if(e.target===e.currentTarget)setMobileOpen(false)}}><aside className="fp-pop absolute inset-y-0 left-0 w-[290px] border-r border-[var(--fp-border)] bg-white p-4 shadow-[var(--fp-shadow-lg)]"><div className="flex h-12 items-center justify-between px-2"><FlowPayLogo/><button onClick={()=>setMobileOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--fp-surface-muted)]"><X size={18}/></button></div><nav className="mt-5">{[...primary,...more].map(([key,path])=>{const Icon=iconMap[key];const active=pathname===path;return <Link onClick={()=>setMobileOpen(false)} key={key} href={path} className={cn('mb-1 flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)]',active&&'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]')}><Icon size={17}/>{t.nav[key as keyof typeof t.nav]}</Link>})}</nav><div className="mt-5 border-t border-[var(--fp-border)] pt-4"><SelectMenu value={lang} onChange={v=>setLang(v as Language)} options={languageOptions.map(o=>({...o,leading:<Globe2 size={14}/>}))} ariaLabel={t.settings.language}/></div></aside></div>}

    {searchOpen&&<div className="fixed inset-0 z-[100] flex items-start justify-center bg-[rgba(20,34,25,.20)] px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><section className="fp-pop w-full max-w-[620px] overflow-hidden rounded-[16px] border border-[var(--fp-border)] bg-white shadow-[var(--fp-shadow-lg)]"><label className="flex h-14 items-center gap-3 border-b border-[var(--fp-border)] px-4"><Search size={18} className="text-[var(--fp-muted)]"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.shell.command} className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--fp-subtle)]"/><kbd className="rounded-md border border-[var(--fp-border)] bg-[#f7f8f5] px-2 py-1 text-[14px] text-[var(--fp-muted)]">ESC</kbd></label><div className="fp-scrollbar max-h-[440px] overflow-y-auto p-2">{searchItems.map(item=><button key={`${item.type}-${item.id}`} onClick={()=>{router.push(item.path);setSearchOpen(false);setQuery('')}} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-[var(--fp-surface-muted)]"><span className="grid size-8 place-items-center rounded-lg bg-[#f1f4ef] text-[var(--fp-green)]">{item.type==='counterparty'?<Users size={15}/>:item.type==='payment'?<FileText size={15}/>:<LayoutDashboard size={15}/>}</span><span className="min-w-0"><strong className="block truncate text-[14px] font-medium">{item.label}</strong><small className="block truncate text-[14px] text-[var(--fp-muted)]">{item.meta}</small></span></button>)}</div></section></div>}
  </div>
}
