'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ApiKeyRow, ApiRequestLog, AuditRequest, Calculation, CompanyProfile, Counterparty, Invoice, PaymentDraft, ProviderRuleSummary, WorkspaceAuditLog } from '@/lib/types'

type WorkspaceState = {
  user: User | null
  profile: CompanyProfile | null
  payments: PaymentDraft[]
  counterparties: Counterparty[]
  calculations: Calculation[]
  audits: AuditRequest[]
  apiKeys: ApiKeyRow[]
  invoices: Invoice[]
  apiLogs: ApiRequestLog[]
  providerRules: ProviderRuleSummary[]
  auditLogs: WorkspaceAuditLog[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

const WorkspaceContext=createContext<WorkspaceState|null>(null)

function numberize<T extends Record<string,unknown>>(row:T,keys:string[]){const clone={...row} as Record<string,unknown>;for(const key of keys){if(clone[key]!=null)clone[key]=Number(clone[key])}return clone as T}

export function WorkspaceProvider({children}:{children:React.ReactNode}){
  const router=useRouter();const supabase=useMemo(()=>createClient(),[])
  const [state,setState]=useState<Omit<WorkspaceState,'refresh'>>({user:null,profile:null,payments:[],counterparties:[],calculations:[],audits:[],apiKeys:[],invoices:[],apiLogs:[],providerRules:[],auditLogs:[],loading:true,refreshing:false,error:null})

  const load=useCallback(async(initial=false)=>{
    setState(s=>({...s,[initial?'loading':'refreshing']:true,error:null}))
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();if(authError)throw authError
      if(!auth.user){router.replace('/login');setState(s=>({...s,user:null,loading:false,refreshing:false}));return}
      const uid=auth.user.id
      const [profileRes,paymentsRes,counterpartiesRes,calculationsRes,auditsRes,keysRes,invoicesRes,logsRes,rulesRes,auditLogRes]=await Promise.all([
        supabase.from('company_profiles').select('*').eq('user_id',uid).maybeSingle(),
        supabase.from('payment_drafts').select('*').eq('user_id',uid).order('updated_at',{ascending:false}).limit(500),
        supabase.from('counterparties').select('*').eq('user_id',uid).order('updated_at',{ascending:false}).limit(300),
        supabase.from('calculations').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(500),
        supabase.from('audit_requests').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(300),
        supabase.from('api_keys').select('id,user_id,name,key_prefix,last_used_at,created_at,revoked_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(100),
        supabase.from('invoices').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(500),
        supabase.from('api_request_logs').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(500),
        supabase.from('provider_rules').select('id,provider_code,display_name,from_country,to_country,currencies,active,source,source_updated_at').eq('active',true).limit(1000),
        supabase.from('workspace_audit_log').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(300),
      ])
      const all=[profileRes,paymentsRes,counterpartiesRes,calculationsRes,auditsRes,keysRes,invoicesRes,logsRes,rulesRes,auditLogRes]
      const firstError=all.find(r=>r.error)?.error;if(firstError)throw firstError
      setState({
        user:auth.user,profile:(profileRes.data||null) as CompanyProfile|null,
        payments:(paymentsRes.data||[]).map(r=>numberize(r,['amount','estimated_fee','recipient_amount'])) as PaymentDraft[],
        counterparties:(counterpartiesRes.data||[]).map(r=>numberize(r,['total_sent'])) as Counterparty[],
        calculations:(calculationsRes.data||[]).map(r=>numberize(r,['amount','best_fee','best_total_cost','estimated_saving'])) as Calculation[],
        audits:(auditsRes.data||[]).map(r=>numberize(r,['amount','actual_fee','estimated_best_fee','potential_saving'])) as AuditRequest[],
        apiKeys:(keysRes.data||[]) as ApiKeyRow[],
        invoices:(invoicesRes.data||[]).map(r=>numberize(r,['amount'])) as Invoice[],
        apiLogs:(logsRes.data||[]).map(r=>numberize(r,['status_code','duration_ms'])) as ApiRequestLog[],providerRules:(rulesRes.data||[]) as ProviderRuleSummary[],auditLogs:(auditLogRes.data||[]) as WorkspaceAuditLog[],
        loading:false,refreshing:false,error:null,
      })
    }catch(error){setState(s=>({...s,loading:false,refreshing:false,error:error instanceof Error?error.message:'WORKSPACE_LOAD_FAILED'}))}
  },[router,supabase])

  useEffect(()=>{void load(true)},[load])
  const value=useMemo<WorkspaceState>(()=>({...state,refresh:()=>load(false)}),[state,load])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(){const value=useContext(WorkspaceContext);if(!value)throw new Error('useWorkspace must be used within WorkspaceProvider');return value}
