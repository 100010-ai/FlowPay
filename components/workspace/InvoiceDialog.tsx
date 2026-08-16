'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { Button } from '@/components/ui/button'
import { useWorkspace } from './WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { currencyOptions } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'
import { workspaceCopy } from '@/lib/workspace-copy'
import { userError } from '@/lib/user-error'
import type { Invoice } from '@/lib/types'

type Props={open:boolean;onOpenChange:(value:boolean)=>void;initial?:Invoice|null}

export function InvoiceDialog({open,onOpenChange,initial=null}:Props){
  const ws=useWorkspace();const {lang}=useLanguage();const c=workspaceCopy[lang].invoice
  const [cpId,setCpId]=useState('');const [supplier,setSupplier]=useState('');const [number,setNumber]=useState('');const [issue,setIssue]=useState('');const [due,setDue]=useState('');const [amount,setAmount]=useState('');const [currency,setCurrency]=useState(ws.profile?.preferred_currency||'');const [reference,setReference]=useState('');const [notes,setNotes]=useState('');const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const cps=useMemo(()=>ws.counterparties.map(item=>({value:item.id,label:item.name,description:`${item.country} · ${item.currency}`,leading:<CountryFlag code={item.country}/>})),[ws.counterparties])
  const currencies=useMemo(()=>currencyOptions(lang).map(item=>({value:item.code,label:item.code,description:item.name,leading:<span className="w-5 text-center text-[14px] font-semibold">{item.symbol}</span>})),[lang])

  useEffect(()=>{if(!open)return;setCpId(initial?.counterparty_id||'');setSupplier(initial?.supplier_name||'');setNumber(initial?.invoice_number||'');setIssue(initial?.issue_date||'');setDue(initial?.due_date||'');setAmount(initial?String(initial.amount):'');setCurrency(initial?.currency||ws.profile?.preferred_currency||'');setReference(initial?.reference||'');setNotes(initial?.notes||'');setError('')},[open,initial,ws.profile?.preferred_currency])
  function choose(id:string){setCpId(id);const cp=ws.counterparties.find(item=>item.id===id);if(cp){setSupplier(cp.name);setCurrency(cp.currency)}}
  async function submit(e:FormEvent){e.preventDefault();if(!ws.user||!supplier.trim()||!currency||!Number.isFinite(Number(amount))||Number(amount)<=0)return;setSaving(true);setError('');try{const client=createClient();const {error}=await client.rpc('flowpay_upsert_invoice',{p_invoice_id:initial?.id||null,p_counterparty_id:cpId||null,p_invoice_number:number.trim(),p_supplier_name:supplier.trim(),p_issue_date:issue||null,p_due_date:due||null,p_amount:Number(amount),p_currency:currency,p_reference:reference.trim(),p_notes:notes.trim()});if(error)throw error;await ws.refresh();onOpenChange(false)}catch{setError(userError(lang,'save'))}finally{setSaving(false)}}
  const editing=Boolean(initial);const title=editing?(lang==='ru'?'Изменить счёт':lang==='fr'?'Modifier la facture':lang==='de'?'Rechnung bearbeiten':lang==='es'?'Editar factura':'Edit invoice'):c.title;const submitLabel=editing?(lang==='ru'?'Сохранить изменения':'Save changes'):c.create
  return <Dialog open={open} onOpenChange={onOpenChange} title={title} description={editing?(lang==='ru'?'Обновите сумму, сроки или реквизиты счёта.':'Update the invoice details, amount or due date.'):c.description} className="sm:max-w-[700px]"><form onSubmit={submit} className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.counterparty}</span><SearchSelect value={cpId} onChange={choose} options={cps} placeholder={c.optional}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.supplier}</span><Input required value={supplier} onChange={e=>setSupplier(e.target.value)}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.number}</span><Input value={number} onChange={e=>setNumber(e.target.value)}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.reference}</span><Input value={reference} onChange={e=>setReference(e.target.value)}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.issue}</span><Input type="date" value={issue} onChange={e=>setIssue(e.target.value)}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.due}</span><Input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.amount}</span><Input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.currency}</span><SearchSelect value={currency} onChange={setCurrency} options={currencies} variant="currency"/></label></div><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.notes}</span><Textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>{error&&<div className="rounded-[11px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-3 text-[14px] text-[var(--fp-red)]">{error}</div>}<div className="flex justify-end gap-2 border-t border-[var(--fp-border)] pt-5"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>{lang==='ru'?'Отмена':lang==='fr'?'Annuler':lang==='de'?'Abbrechen':lang==='es'?'Cancelar':'Cancel'}</Button><Button disabled={saving}>{saving&&<Loader2 className="animate-spin" size={15}/>} {submitLabel}</Button></div></form></Dialog>}
