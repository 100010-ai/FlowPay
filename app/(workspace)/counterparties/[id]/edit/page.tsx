'use client'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { CounterpartyForm } from '@/components/workspace/CounterpartyForm'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { EmptyState } from '@/components/workspace/primitives'
import { useLanguage } from '@/components/LanguageContext'
export default function EditCounterpartyPage(){const ws=useWorkspace();const {lang}=useLanguage();const params=useParams<{id:string}>();if(ws.loading)return <div className="grid min-h-[45vh] place-items-center"><Loader2 size={24} className="animate-spin text-[var(--fp-green)]"/></div>;const counterparty=ws.counterparties.find(item=>item.id===params.id)||null;return counterparty?<CounterpartyForm initial={counterparty}/>:<EmptyState title={lang==='ru'?'Контрагент не найден':'Counterparty not found'}/>}
