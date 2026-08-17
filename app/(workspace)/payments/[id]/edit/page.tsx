'use client'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PaymentForm } from '@/components/workspace/PaymentForm'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { EmptyState } from '@/components/workspace/primitives'
import { useLanguage } from '@/components/LanguageContext'
export default function EditPaymentPage(){const ws=useWorkspace();const {lang}=useLanguage();const params=useParams<{id:string}>();if(ws.loading)return <div className="grid min-h-[45vh] place-items-center"><Loader2 size={24} className="animate-spin text-[var(--fp-green)]"/></div>;const payment=ws.payments.find(item=>item.id===params.id)||null;return payment?<PaymentForm initialPayment={payment}/>:<EmptyState title={lang==='ru'?'Платёж не найден':'Payment not found'}/>}
