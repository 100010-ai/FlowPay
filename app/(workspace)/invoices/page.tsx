'use client'

import { useMemo, useRef, useState } from 'react'
import { BadgeCheck, CalendarClock, CheckCircle2, CircleAlert, CreditCard, FileText, Loader2, MoreHorizontal, Pencil, Plus, Search, Upload, XCircle } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { workspaceDictionaries } from '@/lib/workspace-i18n'
import { workspaceCopy } from '@/lib/workspace-copy'
import { PageHeader, EmptyState, MetricCard, StatusBadge } from '@/components/workspace/primitives'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SelectMenu } from '@/components/ui/select-menu'
import { InvoiceDialog } from '@/components/workspace/InvoiceDialog'
import { PaymentDialog } from '@/components/workspace/PaymentDialog'
import { money, relativeDate } from '@/lib/metrics'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { createClient } from '@/lib/supabase/client'
import { csvRecords } from '@/lib/csv'
import { isSupportedCurrency } from '@/lib/countries'
import { userError } from '@/lib/user-error'
import type { Invoice } from '@/lib/types'

type ImportState={tone:'success'|'error';text:string}|null
const statuses=new Set(['open','scheduled','paid','cancelled'])
function validDate(value:string){return !value||/^\d{4}-\d{2}-\d{2}$/.test(value)}

export default function InvoicesPage(){
  const ws=useWorkspace();const {lang}=useLanguage();const t=workspaceDictionaries[lang];const copy=workspaceCopy[lang].invoice
  const [open,setOpen]=useState(false);const [editingInvoice,setEditingInvoice]=useState<Invoice|null>(null);const [paymentInvoice,setPaymentInvoice]=useState<Invoice|null>(null);const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [importing,setImporting]=useState(false);const [importState,setImportState]=useState<ImportState>(null);const [actionId,setActionId]=useState<string|null>(null);const fileRef=useRef<HTMLInputElement>(null)
  const rows=useMemo(()=>{const q=query.toLowerCase().trim();return ws.invoices.filter(i=>(!status||i.status===status)&&(!q||`${i.invoice_number} ${i.supplier_name} ${i.reference}`.toLowerCase().includes(q)))},[ws.invoices,query,status])
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d},[])
  const monthStart=useMemo(()=>new Date(today.getFullYear(),today.getMonth(),1),[today])
  const openCount=ws.invoices.filter(i=>i.status==='open').length;const scheduledCount=ws.invoices.filter(i=>i.status==='scheduled').length;const overdueCount=ws.invoices.filter(i=>['open','scheduled'].includes(i.status)&&i.due_date&&new Date(`${i.due_date}T00:00:00`)<today).length;const paidMonth=ws.invoices.filter(i=>i.status==='paid'&&new Date(i.updated_at)>=monthStart).length

  async function importCsv(file:File){
    if(!ws.user)return;setImporting(true);setImportState(null)
    try{
      if(file.size>2_000_000)throw new Error(lang==='ru'?'CSV слишком большой (максимум 2 МБ).':'CSV is too large (2 MB maximum).')
      const records=csvRecords(await file.text());if(!records.length)throw new Error(lang==='ru'?'В CSV нет строк данных.':'The CSV has no data rows.')
      if(records.length>500)throw new Error(lang==='ru'?'За один импорт можно добавить не более 500 счетов.':'A single import is limited to 500 invoices.')
      const payload=records.map((r,index)=>{
        const supplier=(r.supplier_name||r.supplier||'').trim();const amount=Number((r.amount||'').replace(/\s/g,'').replace(',','.'));const currency=(r.currency||'').trim().toUpperCase();const invoiceNumber=(r.invoice_number||r.invoice||'').trim();const rowStatus=(r.status||'open').trim().toLowerCase()
        if(!supplier)throw new Error(`${lang==='ru'?'Строка':'Row'} ${index+2}: supplier_name`)
        if(!Number.isFinite(amount)||amount<=0)throw new Error(`${lang==='ru'?'Строка':'Row'} ${index+2}: amount`)
        if(!isSupportedCurrency(currency))throw new Error(`${lang==='ru'?'Строка':'Row'} ${index+2}: currency ${currency||'—'}`)
        if(!statuses.has(rowStatus))throw new Error(`${lang==='ru'?'Строка':'Row'} ${index+2}: status ${rowStatus}`)
        if(!validDate(r.issue_date||'')||!validDate(r.due_date||''))throw new Error(`${lang==='ru'?'Строка':'Row'} ${index+2}: date must be YYYY-MM-DD`)
        return {user_id:ws.user!.id,counterparty_id:null,invoice_number:invoiceNumber,supplier_name:supplier,issue_date:r.issue_date||null,due_date:r.due_date||null,amount,currency,status:rowStatus,reference:(r.reference||'').trim(),notes:(r.notes||'').trim(),payment_draft_id:null}
      })
      const {error}=await createClient().from('invoices').insert(payload);if(error)throw error
      await ws.refresh();setImportState({tone:'success',text:lang==='ru'?`Импортировано счетов: ${payload.length}`:`Imported ${payload.length} invoice${payload.length===1?'':'s'}.`})
    }catch(error){const raw=error instanceof Error?error.message:'';const safe=/^(CSV|Row|Строка|За один|В CSV|CSV слишком)/.test(raw);setImportState({tone:'error',text:safe?raw:userError(lang,'save')})}finally{setImporting(false);if(fileRef.current)fileRef.current.value=''}
  }

  async function updateStatus(invoice:Invoice,next:'paid'|'cancelled'){
    if(!ws.user)return
    const {error}=await createClient().rpc('flowpay_set_invoice_status',{p_invoice_id:invoice.id,p_status:next})
    if(error){setImportState({tone:'error',text:userError(lang,'save')});return}
    setActionId(null);await ws.refresh()
  }

  const actions=<div className="flex flex-wrap gap-2"><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void importCsv(file)}}/><Button variant="secondary" disabled={importing} onClick={()=>fileRef.current?.click()}>{importing?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>} {t.common.import}</Button><Button onClick={()=>{setEditingInvoice(null);setOpen(true)}}><Plus size={15}/>{t.invoices.create}</Button></div>
  return <div className="fp-enter"><PageHeader title={t.invoices.title} subtitle={t.invoices.subtitle} actions={actions}/>
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={lang==='ru'?'Открытые счета':'Open invoices'} value={String(openCount)} meta={lang==='ru'?'ожидают обработки':'awaiting action'} icon={<FileText size={16}/>}/><MetricCard label={lang==='ru'?'Запланировано':'Scheduled'} value={String(scheduledCount)} meta={lang==='ru'?'связаны с оплатой':'planned for payment'} icon={<CalendarClock size={16}/>}/><MetricCard label={lang==='ru'?'Просрочено':'Overdue'} value={String(overdueCount)} meta={overdueCount?(lang==='ru'?'требуют внимания':'need attention'):(lang==='ru'?'всё в срок':'nothing overdue')} icon={<CircleAlert size={16}/>} className={overdueCount?'[&_strong]:text-[var(--fp-red)]':''}/><MetricCard label={lang==='ru'?'Оплачено':'Paid'} value={String(paidMonth)} meta={lang==='ru'?'в этом месяце':'this month'} icon={<BadgeCheck size={16}/>}/></div>
    {importState&&<div className={`mb-4 rounded-[11px] border px-4 py-3 text-[14px] ${importState.tone==='success'?'border-[#cfe3d4] bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]':'border-[#f0cfd2] bg-[var(--fp-red-soft)] text-[var(--fp-red)]'}`}>{importState.text}</div>}
    <Card className="overflow-hidden"><div className="flex flex-col gap-4 border-b border-[var(--fp-border)] p-5 sm:flex-row"><label className="flex h-12 flex-1 items-center gap-2 rounded-[10px] border border-[var(--fp-border)] px-3"><Search size={15} className="text-[var(--fp-subtle)]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={copy.search} className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--fp-subtle)]"/></label><SelectMenu value={status} onChange={setStatus} placeholder={copy.allStatuses} ariaLabel={t.common.status} className="w-full sm:w-[170px]" options={[{value:'',label:copy.allStatuses},{value:'open',label:t.invoices.open},{value:'scheduled',label:t.invoices.scheduled},{value:'paid',label:t.invoices.paid},{value:'cancelled',label:t.invoices.cancelled}]}/></div>
    {rows.length?<><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-[15px]"><thead><tr className="bg-[#fafbf8] text-[14px] text-[var(--fp-muted)]"><th className="px-4 py-3">{copy.number}</th><th className="px-3">{copy.supplierColumn}</th><th className="px-3">{copy.amount}</th><th className="px-3">{copy.issueColumn}</th><th className="px-3">{copy.dueColumn}</th><th className="px-3">{t.common.status}</th><th className="px-3">{t.invoices.linkPayment}</th><th className="px-4 text-right">{t.common.actions}</th></tr></thead><tbody>{rows.map(i=>{const cp=i.counterparty_id?ws.counterparties.find(c=>c.id===i.counterparty_id):null;return <tr key={i.id} className="border-t border-[var(--fp-border)] transition-colors hover:bg-[#fbfcfa]"><td className="px-4 py-3 font-semibold text-[var(--fp-green)]">{i.invoice_number||'—'}</td><td className="px-3 py-3"><span className="flex items-center gap-2"><CountryFlag code={cp?.country}/><span className="max-w-[220px] truncate">{i.supplier_name}</span></span></td><td className="px-3 py-3 font-medium">{money(i.amount,i.currency,lang)}</td><td className="px-3 py-3 text-[var(--fp-muted)]">{relativeDate(i.issue_date,lang)}</td><td className="px-3 py-3 text-[var(--fp-muted)]">{relativeDate(i.due_date,lang)}</td><td className="px-3 py-3"><StatusBadge status={i.status}/></td><td className="px-3 py-3 text-[var(--fp-muted)]">{i.payment_draft_id?(lang==='ru'?'Связан':'Linked'):<button type="button" onClick={()=>setPaymentInvoice(i)} className="font-semibold text-[var(--fp-green)] hover:underline">{lang==='ru'?'Создать платёж':'Create payment'}</button>}</td><td className="relative px-4 py-3 text-right"><button type="button" onClick={()=>setActionId(actionId===i.id?null:i.id)} className="grid size-8 place-items-center rounded-lg text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)]"><MoreHorizontal size={16}/></button>{actionId===i.id&&<div className="fp-pop absolute right-4 top-10 z-30 w-44 rounded-[11px] border border-[var(--fp-border)] bg-white p-1.5 shadow-[var(--fp-shadow-lg)]"><button type="button" onClick={()=>{setEditingInvoice(i);setOpen(true);setActionId(null)}} className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[14px] hover:bg-[var(--fp-surface-muted)]"><Pencil size={14}/>{lang==='ru'?'Изменить счёт':'Edit invoice'}</button>{i.status!=='paid'&&i.status!=='cancelled'&&<button type="button" onClick={()=>void updateStatus(i,'paid')} className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[14px] hover:bg-[var(--fp-green-soft)]"><CheckCircle2 size={14}/>{lang==='ru'?'Отметить оплаченным':'Mark as paid'}</button>}{!i.payment_draft_id&&i.status!=='cancelled'&&<button type="button" onClick={()=>{setPaymentInvoice(i);setActionId(null)}} className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[14px] hover:bg-[var(--fp-green-soft)]"><CreditCard size={14}/>{lang==='ru'?'Создать платёж':'Create payment'}</button>}{!i.payment_draft_id&&i.status!=='paid'&&i.status!=='cancelled'&&<button type="button" onClick={()=>void updateStatus(i,'cancelled')} className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[14px] text-[var(--fp-red)] hover:bg-[var(--fp-red-soft)]"><XCircle size={14}/>{lang==='ru'?'Отменить счёт':'Cancel invoice'}</button>}</div>}</td></tr>})}</tbody></table></div><div className="divide-y divide-[var(--fp-border)] md:hidden">{rows.map(i=><div key={i.id} className="p-4"><div className="flex justify-between gap-3"><strong className="text-[14px]">{i.supplier_name}</strong><StatusBadge status={i.status}/></div><strong className="mt-2 block text-[15px]">{money(i.amount,i.currency,lang)}</strong><p className="mt-1 text-[14px] text-[var(--fp-muted)]">{i.invoice_number||'—'} · {copy.dueColumn.toLowerCase()} {relativeDate(i.due_date,lang)}</p>{!i.payment_draft_id&&i.status!=='cancelled'&&<button onClick={()=>setPaymentInvoice(i)} className="mt-3 text-[14px] font-semibold text-[var(--fp-green)]">{lang==='ru'?'Создать платёж →':'Create payment →'}</button>}</div>)}</div></>:<div className="p-4"><EmptyState title={ws.invoices.length?t.invoices.empty:(lang==='ru'?'Добавьте первый счёт':'Add your first invoice')} description={ws.invoices.length?(lang==='ru'?'Измените фильтр или поиск, чтобы найти другие счета.':'Adjust filters or search to find other invoices.'):(lang==='ru'?'Храните счета поставщиков, сроки и связь с платежами в одном месте.':'Keep supplier invoices, due dates and linked payments in one place.')} actionLabel={t.invoices.create} onAction={()=>setOpen(true)}/></div>}</Card>
    <p className="mt-3 text-[14px] leading-5 text-[var(--fp-muted)]">{lang==='ru'?'Импорт CSV поддерживает поставщика, сумму, валюту, номер счёта, даты, статус, референс и заметки. В первой строке файла должны быть названия столбцов.':'CSV import supports supplier, amount, currency, invoice number, dates, status, reference and notes. The first row must contain column names.'}</p>
    <InvoiceDialog open={open} initial={editingInvoice} onOpenChange={value=>{setOpen(value);if(!value)setEditingInvoice(null)}}/><PaymentDialog open={Boolean(paymentInvoice)} onOpenChange={v=>{if(!v)setPaymentInvoice(null)}} initialInvoice={paymentInvoice}/>
  </div>
}
