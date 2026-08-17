'use client'
import { useSearchParams } from 'next/navigation'
import { PaymentForm } from '@/components/workspace/PaymentForm'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
export default function NewPaymentPage(){const ws=useWorkspace();const params=useSearchParams();const invoiceId=params.get('invoice');const invoice=invoiceId?ws.invoices.find(item=>item.id===invoiceId)||null:null;return <PaymentForm initialInvoice={invoice}/>}
