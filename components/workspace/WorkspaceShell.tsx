'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, BarChart3, Bell, BookOpenText, ChevronDown, CircleHelp, Code2, Command,
  FileCheck2, FileText, Globe2, LayoutDashboard, Landmark, Menu, Plus, ReceiptText,
  RefreshCw, Route, Search, Settings, ShieldCheck, Sparkles, Users, WalletCards, X,
} from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Button } from '@/components/ui/button'
import { SelectMenu } from '@/components/ui/select-menu'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageContext'
import { workspaceDictionaries } from '@/lib/workspace-i18n'
import { initials, cn } from '@/lib/utils'
import { relativeDate } from '@/lib/metrics'
import { useWorkspace } from './WorkspaceProvider'
import { WorkspaceLoading } from './WorkspaceLoading'
import type { Language } from '@/lib/types'

const languageOptions=[{value:'ru',label:'Русский'},{value:'en',label:'English'},{value:'fr',label:'Français'},{value:'de',label:'Deutsch'},{value:'es',label:'Español'}]

type NavKey='overview'|'operations'|'payments'|'approvals'|'counterparties'|'routes'|'invoices'|'treasury'|'analytics'|'reports'|'activity'|'api'|'settings'
type NavItem={key:NavKey;path:string;icon:typeof LayoutDashboard}

const groups:{key:'work'|'network'|'intelligence'|'system';items:NavItem[]}[]=[
  {key:'work',items:[{key:'overview',path:'/dashboard',icon:LayoutDashboard},{key:'operations',path:'/operations',icon:Sparkles},{key:'payments',path:'/payments',icon:WalletCards},{key:'approvals',path:'/approvals',icon:FileCheck2}]},
  {key:'network',items:[{key:'counterparties',path:'/counterparties',icon:Users},{key:'routes',path:'/routes',icon:Route},{key:'invoices',path:'/invoices',icon:ReceiptText}]},
  {key:'intelligence',items:[{key:'treasury',path:'/treasury',icon:Landmark},{key:'analytics',path:'/analytics',icon:BarChart3},{key:'reports',path:'/reports',icon:BookOpenText},{key:'activity',path:'/activity',icon:Activity}]},
  {key:'system',items:[{key:'api',path:'/developer',icon:Code2},{key:'settings',path:'/settings',icon:Settings}]},
]
const allItems=groups.flatMap(group=>group.items)

type WorkspaceDictionary=(typeof workspaceDictionaries)[Language]

function label(key:NavKey,lang:Language,t:WorkspaceDictionary){
  const local:Record<Exclude<NavKey,'overview'|'payments'|'counterparties'|'routes'|'invoices'|'analytics'|'reports'|'api'|'settings'>,Record<Language,string>>={
    operations:{ru:'Операции',en:'Operations',fr:'Opérations',de:'Operationen',es:'Operaciones'},
    approvals:{ru:'Согласования',en:'Approvals',fr:'Approbations',de:'Freigaben',es:'Aprobaciones'},
    treasury:{ru:'Обязательства',en:'Treasury',fr:'Trésorerie',de:'Treasury',es:'Tesorería'},
    activity:{ru:'Активность',en:'Activity',fr:'Activité',de:'Aktivität',es:'Actividad'},
  }
  if(key in local)return local[key as keyof typeof local][lang]
  return t.nav[key as keyof typeof t.nav]
}
function groupLabel(key:'work'|'network'|'intelligence'|'system',lang:Language){
  const rows={work:{ru:'Работа',en:'Work',fr:'Travail',de:'Arbeit',es:'Trabajo'},network:{ru:'Платёжная сеть',en:'Payment network',fr:'Réseau de paiement',de:'Zahlungsnetz',es:'Red de pagos'},intelligence:{ru:'Контроль и данные',en:'Control & data',fr:'Contrôle & données',de:'Kontrolle & Daten',es:'Control y datos'},system:{ru:'Система',en:'System',fr:'Système',de:'System',es:'Sistema'}}
  return rows[key][lang]
}

export function WorkspaceShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const {lang,setLang}=useLanguage();const t=workspaceDictionaries[lang];const ws=useWorkspace()
  const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState('');const [activeSearchIndex,setActiveSearchIndex]=useState(0);const [activityOpen,setActivityOpen]=useState(false);const [profileOpen,setProfileOpen]=useState(false);const [mobileOpen,setMobileOpen]=useState(false);const [adminAccess,setAdminAccess]=useState(false)
  const activityRef=useRef<HTMLDivElement>(null);const profileRef=useRef<HTMLDivElement>(null)

  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true)}if(e.key==='Escape'){setSearchOpen(false);setActivityOpen(false);setProfileOpen(false);setMobileOpen(false)}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[])
  useEffect(()=>{const fn=(e:MouseEvent)=>{if(activityRef.current&&!activityRef.current.contains(e.target as Node))setActivityOpen(false);if(profileRef.current&&!profileRef.current.contains(e.target as Node))setProfileOpen(false)};document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)},[])

  const canEvaluateSetup=!ws.loading&&Boolean(ws.user)&&ws.mfaCurrentLevel==='aal2'
  const needsSetup=canEvaluateSetup&&(!ws.profile?.name?.trim()||!ws.profile?.country||!ws.profile?.preferred_currency)
  useEffect(()=>{if(needsSetup&&pathname!=='/onboarding')router.replace('/onboarding')},[needsSetup,pathname,router])

  useEffect(()=>{let cancelled=false;if(!ws.user||ws.mfaCurrentLevel!=='aal2'){setAdminAccess(false);return}void(async()=>{try{const {data}=await createClient().auth.getSession();const token=data.session?.access_token;if(!token)return;const response=await fetch('/api/admin/access',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!cancelled)setAdminAccess(response.ok)}catch{if(!cancelled)setAdminAccess(false)}})();return()=>{cancelled=true}},[ws.user?.id,ws.mfaCurrentLevel])

  const attentionCount=useMemo(()=>{const today=new Date();today.setHours(0,0,0,0);const overdue=ws.payments.filter(p=>!['paid','received','cancelled'].includes(p.status)&&p.due_date&&new Date(`${p.due_date}T00:00:00`)<today).length;const approvals=ws.payments.filter(p=>['required','pending','rejected'].includes(p.approval_status)).length;return overdue+approvals},[ws.payments])

  const activities=useMemo(()=>{
    const rows:{id:string;title:string;subtitle:string;date:string;tone:'success'|'info'|'warning'|'neutral'}[]=[]
    for(const event of ws.approvalEvents.slice(0,8)){const payment=ws.payments.find(p=>p.id===event.payment_id);rows.push({id:`approval-${event.id}`,title:event.event==='approved'?(lang==='ru'?'Платёж согласован':'Payment approved'):event.event==='rejected'?(lang==='ru'?'Платёж отклонён':'Payment rejected'):(lang==='ru'?'Запрошено согласование':'Approval requested'),subtitle:payment?.supplier_name||event.payment_id,date:event.created_at,tone:event.event==='approved'?'success':event.event==='rejected'?'warning':'info'})}
    for(const p of ws.payments.slice(0,18)){if((p.status==='paid'||p.status==='received')&&ws.profile?.notify_payment_confirmations===false)continue;rows.push({id:`p-${p.id}-${p.updated_at}`,title:p.status==='received'?(lang==='ru'?'Платёж получен':'Payment received'):p.status==='paid'?(lang==='ru'?'Платёж оплачен':'Payment paid'):p.status==='ready'?(lang==='ru'?'Платёж готов':'Payment ready'):p.status==='failed'?(lang==='ru'?'Ошибка платежа':'Payment failed'):(lang==='ru'?'Платёж обновлён':'Payment updated'),subtitle:`${p.supplier_name} · ${p.currency} ${Number(p.amount).toLocaleString()}`,date:p.updated_at,tone:(p.status==='paid'||p.status==='received')?'success':p.status==='ready'?'info':p.status==='failed'?'warning':'neutral'})}
    if(ws.profile?.notify_security_alerts!==false)for(const a of ws.auditLogs.filter(row=>row.entity_type==='api_keys').slice(0,4))rows.push({id:`security-${a.id}`,title:lang==='ru'?'Изменён API-доступ':'API access changed',subtitle:`${a.entity_type} · ${a.action}`,date:a.created_at,tone:'warning'})
    return rows.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index).slice(0,12)
  },[ws.approvalEvents,ws.payments,ws.auditLogs,ws.profile,lang])

  const searchItems=useMemo(()=>{
    const q=query.trim().toLowerCase();const nav=allItems.map(item=>({type:'page',id:item.path,label:label(item.key,lang,t),meta:item.path,path:item.path,icon:item.icon}));if(adminAccess)nav.push({type:'page',id:'/admin',label:lang==='ru'?'Админ-панель':'Admin console',meta:'/admin',path:'/admin',icon:ShieldCheck})
    const cps=ws.counterparties.map(c=>({type:'counterparty',id:c.id,label:c.name,meta:`${c.country} · ${c.currency}`,path:`/counterparties?selected=${c.id}`,icon:Users}))
    const pays=ws.payments.map(p=>({type:'payment',id:p.id,label:p.invoice_number||p.supplier_name,meta:`${p.supplier_name} · ${p.currency} ${Number(p.amount).toLocaleString()}`,path:`/payments?selected=${p.id}`,icon:WalletCards}))
    const invoices=ws.invoices.map(i=>({type:'invoice',id:i.id,label:i.invoice_number||i.supplier_name,meta:`${i.supplier_name} · ${i.currency} ${Number(i.amount).toLocaleString()}`,path:`/invoices?selected=${i.id}`,icon:ReceiptText}))
    const quick=[{type:'action',id:'new-payment',label:lang==='ru'?'Создать платёж':'Create payment',meta:lang==='ru'?'Быстрое действие':'Quick action',path:'/payments/new',icon:Plus},{type:'action',id:'compare',label:lang==='ru'?'Сравнить маршрут':'Compare route',meta:lang==='ru'?'Production routing':'Production routing',path:'/routes',icon:Route}]
    return [...quick,...nav,...pays,...cps,...invoices].filter(item=>!q||`${item.label} ${item.meta}`.toLowerCase().includes(q)).slice(0,18)
  },[query,ws.counterparties,ws.payments,ws.invoices,adminAccess,lang,t])

  useEffect(()=>{setActiveSearchIndex(0)},[query,searchOpen])
  useEffect(()=>{
    if(!searchOpen)return
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='ArrowDown'){event.preventDefault();setActiveSearchIndex(index=>Math.min(index+1,Math.max(0,searchItems.length-1)))}
      else if(event.key==='ArrowUp'){event.preventDefault();setActiveSearchIndex(index=>Math.max(0,index-1))}
      else if(event.key==='Enter'&&searchItems[activeSearchIndex]){event.preventDefault();const item=searchItems[activeSearchIndex];router.push(item.path);setSearchOpen(false);setQuery('')}
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[searchOpen,searchItems,activeSearchIndex,router])

  async function signOut(){await createClient().auth.signOut();router.replace('/login');router.refresh()}
  if(ws.loading||needsSetup)return <WorkspaceLoading/>
  if(ws.error)return <div className="grid min-h-screen place-items-center bg-[var(--fp-bg)] p-6"><div className="w-full max-w-lg rounded-[20px] border border-[var(--fp-border)] bg-white p-7 shadow-[var(--fp-shadow-lg)]"><FlowPayLogo/><div className="mt-8 rounded-[14px] bg-[var(--fp-red-soft)] p-4 text-[14px] text-[var(--fp-red)]"><strong className="block">{t.shell.setupRequired}</strong><p className="mt-1 leading-5">{t.shell.setupText}</p></div><Button className="mt-5" onClick={()=>ws.refresh()}><RefreshCw size={15}/>{t.common.refresh}</Button></div></div>

  const company=ws.profile?.name?.trim()||(lang==='ru'?'Личный аккаунт':'Personal account')
  return <div className="min-h-screen bg-[var(--fp-bg)] text-[var(--fp-text)]">
    <aside className="fp-shell-sidebar fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-[var(--fp-border)] bg-white lg:flex lg:flex-col">
      <div className="flex h-[70px] items-center justify-between px-5"><Link href="/dashboard"><FlowPayLogo/></Link><Badge tone="neutral" className="border-0 bg-[#f2f5f1] text-[10px] font-bold tracking-[.08em]">2.0</Badge></div>
      <div className="mx-4 rounded-[14px] border border-[#dce7de] bg-[linear-gradient(145deg,#f8fbf8,#f1f7f2)] p-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-[10px] bg-white text-[var(--fp-green)] shadow-sm"><Command size={15}/></span><div className="min-w-0"><strong className="block truncate text-[13px]">FlowPay Control</strong><span className="block text-[11px] text-[var(--fp-muted)]">{attentionCount?(lang==='ru'?`${attentionCount} действий требуют внимания`:`${attentionCount} actions need attention`):(lang==='ru'?'Операции под контролем':'Operations under control')}</span></div></div></div>
      <nav className="fp-scrollbar flex-1 overflow-y-auto px-3 pb-4 pt-4">{groups.map(group=><div key={group.key} className="mb-4"><div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--fp-subtle)]">{groupLabel(group.key,lang)}</div>{group.items.map(item=>{const Icon=item.icon;const active=pathname===item.path||pathname.startsWith(`${item.path}/`);const badge=item.key==='operations'&&attentionCount?attentionCount:item.key==='approvals'?ws.payments.filter(p=>['required','pending','rejected'].includes(p.approval_status)).length:0;return <Link key={item.key} href={item.path} className={cn('mb-0.5 flex h-10 items-center gap-3 rounded-[11px] px-3 text-[13px] font-medium text-[#465049] transition hover:bg-[#f4f6f3] hover:text-[var(--fp-text)]',active&&'bg-[#eaf3ec] text-[var(--fp-green-strong)] shadow-[inset_0_0_0_1px_rgba(24,122,69,.04)]')}><Icon size={16.5} strokeWidth={1.8}/><span className="flex-1 truncate">{label(item.key,lang,t)}</span>{badge>0&&<span className={cn('grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold leading-5',active?'bg-white/80 text-[var(--fp-green-strong)]':'bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]')}>{Math.min(badge,99)}</span>}</Link>})}</div>)}</nav>
      <div className="border-t border-[var(--fp-border)] p-3">{adminAccess&&<Link href="/admin" className={cn('mb-2 flex h-10 items-center gap-3 rounded-[11px] px-3 text-[13px] font-semibold',pathname.startsWith('/admin')?'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]':'text-[var(--fp-muted)] hover:bg-[#f5f7f4]')}><ShieldCheck size={16}/>{lang==='ru'?'Админ-панель':'Admin console'}</Link>}<Link href="/settings" className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 hover:bg-[#f5f7f4]"><CircleHelp size={16} className="text-[var(--fp-green)]"/><span className="min-w-0"><strong className="block text-[12px]">{t.shell.help}</strong><small className="block truncate text-[11px] text-[var(--fp-muted)]">{lang==='ru'?'Настройки, безопасность, доступ':'Settings, security, access'}</small></span></Link></div>
    </aside>

    <div className="fp-shell-main lg:pl-[272px]">
      <header className="fp-shell-topbar sticky top-0 z-30 flex h-[70px] items-center border-b border-[var(--fp-border)] bg-white/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <button className="mr-3 grid size-9 place-items-center rounded-[10px] text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)] lg:hidden" onClick={()=>setMobileOpen(true)} aria-label="Menu"><Menu size={19}/></button><Link className="lg:hidden" href="/dashboard"><FlowPayLogo compact/></Link>
        <button onClick={()=>setSearchOpen(true)} className="ml-3 hidden h-10 w-full max-w-[560px] items-center gap-2 rounded-[11px] border border-[var(--fp-border)] bg-[#fbfcfa] px-3.5 text-left text-[13px] text-[var(--fp-subtle)] transition hover:border-[var(--fp-border-strong)] hover:bg-white sm:flex lg:ml-0"><Search size={15}/><span className="flex-1 truncate">{lang==='ru'?'Поиск по платежам, счетам, контрагентам…':'Search payments, invoices, counterparties…'}</span><kbd className="rounded-md border border-[var(--fp-border)] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fp-muted)]">⌘K</kbd></button>
        <div className="ml-auto flex items-center gap-1.5"><span className="hidden items-center gap-1.5 rounded-full bg-[#f1f6f2] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--fp-green-strong)] xl:inline-flex"><span className="size-1.5 rounded-full bg-[var(--fp-green)]"/>AAL2</span>
          <div className="relative" ref={activityRef}><button onClick={()=>setActivityOpen(v=>!v)} className="relative grid size-9 place-items-center rounded-[10px] text-[#303a34] hover:bg-[var(--fp-surface-muted)]" aria-label={t.shell.notifications}><Bell size={17} strokeWidth={1.8}/>{activities.length>0&&<span className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full bg-[var(--fp-green)] px-1 text-[9px] font-bold leading-[15px] text-white">{Math.min(activities.length,9)}</span>}</button>{activityOpen&&<div className="fp-pop absolute right-0 top-11 w-[360px] overflow-hidden rounded-[16px] border border-[var(--fp-border)] bg-white shadow-[var(--fp-shadow-lg)]"><div className="flex items-center justify-between border-b border-[var(--fp-border)] px-4 py-3"><div><strong className="text-[13px]">{lang==='ru'?'Центр активности':'Activity center'}</strong><p className="mt-0.5 text-[11px] text-[var(--fp-subtle)]">{lang==='ru'?'Последние изменения workspace':'Latest workspace changes'}</p></div><Link href="/activity" onClick={()=>setActivityOpen(false)} className="text-[11px] font-semibold text-[var(--fp-green)]">{lang==='ru'?'Все':'View all'}</Link></div><div className="fp-scrollbar max-h-[400px] overflow-auto p-2">{activities.length?activities.map(a=><div key={a.id} className="rounded-[10px] px-3 py-2.5 hover:bg-[#f7f8f5]"><div className="flex items-center justify-between gap-3"><span className="truncate text-[12px] font-semibold">{a.title}</span><Badge tone={a.tone} className="h-5 px-1.5 text-[9px]">{relativeDate(a.date,lang)}</Badge></div><p className="mt-1 truncate text-[11px] text-[var(--fp-muted)]">{a.subtitle}</p></div>):<p className="p-6 text-center text-[13px] text-[var(--fp-muted)]">{t.shell.noNotifications}</p>}</div></div>}</div>
          <div className="hidden md:block"><SelectMenu value={lang} onChange={v=>setLang(v as Language)} options={languageOptions.map(o=>({...o,leading:<Globe2 size={14}/>}))} compact align="right" ariaLabel={t.settings.language} triggerClassName="w-[124px] border-transparent bg-transparent hover:border-[var(--fp-border)] hover:bg-[var(--fp-surface-muted)]"/></div>
          <div className="relative" ref={profileRef}><button onClick={()=>setProfileOpen(v=>!v)} className="ml-1 flex h-10 items-center gap-2 rounded-[11px] px-1.5 hover:bg-[var(--fp-surface-muted)]"><span className="grid size-8 place-items-center rounded-full bg-[#e7efe9] text-[11px] font-bold text-[var(--fp-green-strong)]">{initials(company)}</span><span className="hidden max-w-[150px] text-left xl:block"><strong className="block truncate text-[12px] font-semibold">{company}</strong><small className="block truncate text-[10px] text-[var(--fp-muted)]">{ws.user?.email}</small></span><ChevronDown size={13} className="hidden text-[var(--fp-subtle)] xl:block"/></button>{profileOpen&&<div className="fp-pop absolute right-0 top-12 w-56 rounded-[13px] border border-[var(--fp-border)] bg-white p-1.5 shadow-[var(--fp-shadow-lg)]"><Link href="/settings" className="flex items-center gap-2 rounded-[9px] px-3 py-2 text-[13px] hover:bg-[var(--fp-surface-muted)]"><Settings size={14}/>{t.nav.settings}</Link><button onClick={signOut} className="flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-left text-[13px] text-[var(--fp-red)] hover:bg-[var(--fp-red-soft)]"><X size={14}/>{t.shell.signOut}</button></div>}</div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-70px)] w-full max-w-[1680px] px-4 pb-24 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12 xl:px-10">{children}</main>
    </div>

    <nav className="fp-shell-mobile-nav fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-[var(--fp-border)] bg-white/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <MobileLink href="/dashboard" active={pathname==='/dashboard'} icon={LayoutDashboard} label={t.nav.overview}/><MobileLink href="/operations" active={pathname==='/operations'} icon={Sparkles} label={lang==='ru'?'Операции':'Ops'} badge={attentionCount}/><Link href="/payments/new" className="mx-auto -mt-4 grid size-12 place-items-center self-center rounded-full bg-[var(--fp-green)] text-white shadow-[0_10px_30px_rgba(24,122,69,.22)]"><Plus size={21}/></Link><MobileLink href="/routes" active={pathname==='/routes'} icon={Route} label={t.nav.routes}/><button onClick={()=>setMobileOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-[var(--fp-muted)]"><Menu size={18}/>{lang==='ru'?'Ещё':'More'}</button>
    </nav>

    {mobileOpen&&<div className="fixed inset-0 z-[90] bg-[rgba(12,18,14,.16)] lg:hidden" onMouseDown={e=>{if(e.target===e.currentTarget)setMobileOpen(false)}}><aside className="fp-pop absolute inset-y-0 left-0 w-[306px] border-r border-[var(--fp-border)] bg-white p-4 shadow-[var(--fp-shadow-lg)]"><div className="flex h-12 items-center justify-between px-2"><FlowPayLogo/><button onClick={()=>setMobileOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--fp-surface-muted)]"><X size={18}/></button></div><nav className="fp-scrollbar mt-4 max-h-[calc(100vh-120px)] overflow-auto">{groups.map(group=><div key={group.key} className="mb-4"><div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--fp-subtle)]">{groupLabel(group.key,lang)}</div>{group.items.map(item=>{const Icon=item.icon;const active=pathname===item.path;return <Link onClick={()=>setMobileOpen(false)} key={item.key} href={item.path} className={cn('mb-1 flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)]',active&&'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]')}><Icon size={16}/>{label(item.key,lang,t)}</Link>})}</div>)}</nav><div className="absolute inset-x-4 bottom-4 border-t border-[var(--fp-border)] pt-4"><SelectMenu value={lang} onChange={v=>setLang(v as Language)} options={languageOptions.map(o=>({...o,leading:<Globe2 size={14}/>}))} ariaLabel={t.settings.language}/></div></aside></div>}

    {searchOpen&&<div className="fixed inset-0 z-[100] flex items-start justify-center bg-[rgba(12,18,14,.16)] px-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><section className="fp-pop w-full max-w-[680px] overflow-hidden rounded-[18px] border border-[var(--fp-border)] bg-white shadow-[0_28px_100px_rgba(20,37,26,.18)]"><label className="flex h-15 items-center gap-3 border-b border-[var(--fp-border)] px-4"><Search size={18} className="text-[var(--fp-muted)]"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={lang==='ru'?'Команда, платёж, счёт или контрагент…':'Command, payment, invoice or counterparty…'} className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--fp-subtle)]"/><kbd className="rounded-md border border-[var(--fp-border)] bg-[#f7f8f5] px-2 py-1 text-[10px] text-[var(--fp-muted)]">ESC</kbd></label><div className="flex items-center justify-between border-b border-[var(--fp-border)] bg-[#fbfcfa] px-4 py-2 text-[10px] font-semibold text-[var(--fp-subtle)]"><span>{query.trim()?(lang==='ru'?'Результаты':'Results'):(lang==='ru'?'Быстрый доступ':'Quick access')}</span><span>⌘K</span></div><div className="fp-scrollbar max-h-[470px] overflow-y-auto p-2">{searchItems.length?searchItems.map((item,index)=>{const Icon=item.icon;return <button key={`${item.type}-${item.id}`} onMouseEnter={()=>setActiveSearchIndex(index)} onClick={()=>{router.push(item.path);setSearchOpen(false);setQuery('')}} className={cn('group flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left',index===activeSearchIndex?'bg-[var(--fp-surface-muted)]':'hover:bg-[var(--fp-surface-muted)]')}><span className="grid size-9 place-items-center rounded-[10px] bg-[#eff4ef] text-[var(--fp-green)]"><Icon size={15}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-medium">{item.label}</strong><small className="block truncate text-[11px] text-[var(--fp-muted)]">{item.meta}</small></span><span className={cn('text-[11px] text-[var(--fp-subtle)] transition',index===activeSearchIndex?'opacity-100':'opacity-0 group-hover:opacity-100')}>↵</span></button>}):<div className="grid min-h-36 place-items-center px-6 text-center"><div><strong className="text-[13px]">{lang==='ru'?'Ничего не найдено':'No results'}</strong><p className="mt-1 text-[12px] text-[var(--fp-muted)]">{lang==='ru'?'Попробуйте номер счёта, контрагента или название раздела.':'Try an invoice number, counterparty or page name.'}</p></div></div>}</div></section></div>}
  </div>
}

function MobileLink({href,active,icon:Icon,label,badge=0}:{href:string;active:boolean;icon:typeof LayoutDashboard;label:string;badge?:number}){return <Link href={href} className={cn('relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-[var(--fp-muted)]',active&&'text-[var(--fp-green)]')}><span className="relative"><Icon size={18}/>{badge>0&&<span className="absolute -right-2.5 -top-1.5 grid min-w-[14px] place-items-center rounded-full bg-[var(--fp-amber)] px-1 text-[8px] font-bold leading-[14px] text-white">{Math.min(badge,9)}</span>}</span>{label}</Link>}
