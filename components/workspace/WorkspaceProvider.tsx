'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ApiKeyRow, ApiRequestLog, ApiUsageDaily, AuditRequest, Calculation, CompanyProfile, Counterparty, Invoice, PaymentDraft, ProviderRuleSummary, WorkspaceAuditLog } from '@/lib/types'

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
  apiUsage: ApiUsageDaily[]
  providerRules: ProviderRuleSummary[]
  auditLogs: WorkspaceAuditLog[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

function numberize<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const clone = { ...row } as Record<string, unknown>
  for (const key of keys) if (clone[key] != null) clone[key] = Number(clone[key])
  return clone as T
}

type JobName = 'profile'|'payments'|'counterparties'|'calculations'|'audits'|'apiKeys'|'invoices'|'apiLogs'|'apiUsage'|'providerRules'|'auditLogs'
type Job = { name: JobName; promise: PromiseLike<any> }

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const loadedAt = useRef<Partial<Record<JobName, number>>>({})
  const authCache = useRef<{ user: User | null; validatedAt: number }>({ user: null, validatedAt: 0 })
  const loadedLimit = useRef<Partial<Record<JobName, number>>>({})
  const mounted = useRef(false)
  const [state, setState] = useState<Omit<WorkspaceState, 'refresh'>>({
    user: null, profile: null, payments: [], counterparties: [], calculations: [], audits: [], apiKeys: [], invoices: [], apiLogs: [], apiUsage: [], providerRules: [], auditLogs: [], loading: true, refreshing: false, error: null,
  })

  const load = useCallback(async (initial = false, force = false) => {
    setState(s => ({ ...s, ...(initial ? { loading: true } : force ? { refreshing: true } : {}), error: null }))
    try {
      let user = authCache.current.user
      const mustValidateAuth = force || !user || Date.now() - authCache.current.validatedAt > 60_000
      if (mustValidateAuth) {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        user = auth.user
        authCache.current = { user, validatedAt: Date.now() }
      }
      if (!user) {
        router.replace('/login')
        setState(s => ({ ...s, user: null, loading: false, refreshing: false }))
        return
      }
      const uid = user.id
      const highPaymentDetail = ['/dashboard','/payments','/counterparties','/analytics','/reports'].includes(pathname)
      const highCounterpartyDetail = ['/payments','/counterparties','/invoices','/reports'].includes(pathname)
      const highCalculationDetail = ['/dashboard','/routes','/analytics','/reports'].includes(pathname)
      const highAuditDetail = ['/reports','/settings','/developer'].includes(pathname)

      const jobs: Job[] = []
      const nowMs = Date.now()
      const stale = (name: JobName, ttlMs = 15_000) => force || !loadedAt.current[name] || nowMs - (loadedAt.current[name] || 0) >= ttlMs
      const staleWithLimit = (name: JobName, limit: number, ttlMs = 15_000) => stale(name, ttlMs) || (loadedLimit.current[name] || 0) < limit
      const paymentLimit = highPaymentDetail ? 500 : 80
      const counterpartyLimit = highCounterpartyDetail ? 300 : 100
      const calculationLimit = highCalculationDetail ? 500 : 50
      const auditLogLimit = highAuditDetail ? 300 : 50
      if (stale('profile', 60_000)) jobs.push({ name: 'profile', promise: supabase.from('company_profiles').select('name,country,preferred_currency,registration_number,business_address,default_payment_method,default_charge_type,beneficiary_notifications,notify_payment_confirmations,notify_payment_failures,notify_security_alerts,notify_weekly_reports').eq('user_id', uid).maybeSingle() })
      if (staleWithLimit('payments', paymentLimit)) jobs.push({ name: 'payments', promise: supabase.from('payment_drafts').select('id,user_id,counterparty_id,supplier_name,invoice_number,amount,currency,due_date,route_provider_code,estimated_fee,payment_method,charge_type,status,notes,route_from_country,route_to_country,recipient_currency,recipient_amount,reference,route_snapshot,paid_at,received_at,created_at,updated_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(paymentLimit) })
      if (staleWithLimit('counterparties', counterpartyLimit, 30_000)) jobs.push({ name: 'counterparties', promise: supabase.from('counterparties').select('id,user_id,name,country,currency,bank_country,account_number,bic,email,total_sent,last_payment_at,verification_status,bank_name,account_holder,tax_id,created_at,updated_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(counterpartyLimit) })
      if (staleWithLimit('calculations', calculationLimit, 20_000)) jobs.push({ name: 'calculations', promise: supabase.from('calculations').select('id,user_id,quote_id,from_country,to_country,amount,currency,recipient_currency,best_provider_code,best_fee,best_total_cost,best_speed_minutes,estimated_saving,routes_snapshot,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(calculationLimit) })
      if (staleWithLimit('auditLogs', auditLogLimit, 30_000)) jobs.push({ name: 'auditLogs', promise: supabase.from('workspace_audit_log').select('id,user_id,entity_type,entity_id,action,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(auditLogLimit) })

      if (pathname === '/analytics' && stale('audits', 30_000)) jobs.push({ name: 'audits', promise: supabase.from('audit_requests').select('id,user_id,email,from_country,to_country,amount,currency,recipient_currency,actual_fee,best_provider_code,estimated_best_fee,potential_saving,status,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(300) })
      if (['/developer','/settings'].includes(pathname) && stale('apiKeys', 30_000)) jobs.push({ name: 'apiKeys', promise: supabase.from('api_keys').select('id,user_id,name,key_prefix,last_used_at,created_at,revoked_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100) })
      if (['/dashboard','/counterparties','/invoices','/reports'].includes(pathname) && stale('invoices', 20_000)) jobs.push({ name: 'invoices', promise: supabase.from('invoices').select('id,user_id,counterparty_id,invoice_number,supplier_name,issue_date,due_date,amount,currency,status,reference,notes,payment_draft_id,created_at,updated_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(500) })
      if (['/developer','/reports'].includes(pathname) && stale('apiLogs', 20_000)) jobs.push({ name: 'apiLogs', promise: supabase.from('api_request_logs').select('id,user_id,endpoint,status_code,duration_ms,request_id,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(200) })
      if (['/developer','/reports'].includes(pathname) && stale('apiUsage', 30_000)) jobs.push({ name: 'apiUsage', promise: supabase.from('api_usage_daily').select('user_id,endpoint,usage_date,request_count,success_count,error_count,total_duration_ms,max_duration_ms,updated_at').eq('user_id', uid).order('usage_date', { ascending: false }).limit(365) })
      if (['/payments','/routes','/analytics','/settings'].includes(pathname) && stale('providerRules', 60_000)) jobs.push({ name: 'providerRules', promise: supabase.from('provider_rules').select('id,provider_code,display_name,from_country,to_country,currencies,active,source_updated_at').eq('active', true).limit(1000) })

      const results = await Promise.all(jobs.map(async job => [job.name, await job.promise] as const))
      const resultMap = new Map<JobName, { data: unknown; error: { message?: string } | null }>(results)
      const failed = results.find(([, result]) => result.error)?.[1].error
      if (failed) throw new Error(failed.message || 'WORKSPACE_LOAD_FAILED')
      const loadedNow = Date.now()
      for (const [name] of results) {
        loadedAt.current[name] = loadedNow
        if (name === 'payments') loadedLimit.current[name] = paymentLimit
        else if (name === 'counterparties') loadedLimit.current[name] = counterpartyLimit
        else if (name === 'calculations') loadedLimit.current[name] = calculationLimit
        else if (name === 'auditLogs') loadedLimit.current[name] = auditLogLimit
      }
      const get = <T,>(name: JobName) => resultMap.get(name)?.data as T | undefined

      setState(s => ({
        ...s,
        user,
        profile: resultMap.has('profile') ? ((get<CompanyProfile | null>('profile') || null) as CompanyProfile | null) : s.profile,
        payments: resultMap.has('payments') ? ((get<Record<string, unknown>[]>('payments') || []).map(r => numberize(r, ['amount','estimated_fee','recipient_amount'])) as PaymentDraft[]) : s.payments,
        counterparties: resultMap.has('counterparties') ? ((get<Record<string, unknown>[]>('counterparties') || []).map(r => numberize(r, ['total_sent'])) as Counterparty[]) : s.counterparties,
        calculations: resultMap.has('calculations') ? ((get<Record<string, unknown>[]>('calculations') || []).map(r => numberize(r, ['amount','best_fee','best_total_cost','estimated_saving'])) as Calculation[]) : s.calculations,
        audits: resultMap.has('audits') ? ((get<Record<string, unknown>[]>('audits') || []).map(r => numberize(r, ['amount','actual_fee','estimated_best_fee','potential_saving'])) as AuditRequest[]) : s.audits,
        apiKeys: resultMap.has('apiKeys') ? ((get<ApiKeyRow[]>('apiKeys') || []) as ApiKeyRow[]) : s.apiKeys,
        invoices: resultMap.has('invoices') ? ((get<Record<string, unknown>[]>('invoices') || []).map(r => numberize(r, ['amount'])) as Invoice[]) : s.invoices,
        apiLogs: resultMap.has('apiLogs') ? ((get<Record<string, unknown>[]>('apiLogs') || []).map(r => numberize(r, ['status_code','duration_ms'])) as ApiRequestLog[]) : s.apiLogs,
        apiUsage: resultMap.has('apiUsage') ? ((get<Record<string, unknown>[]>('apiUsage') || []).map(r => numberize(r, ['request_count','success_count','error_count','total_duration_ms','max_duration_ms'])) as ApiUsageDaily[]) : s.apiUsage,
        providerRules: resultMap.has('providerRules') ? ((get<ProviderRuleSummary[]>('providerRules') || []) as ProviderRuleSummary[]) : s.providerRules,
        auditLogs: resultMap.has('auditLogs') ? ((get<WorkspaceAuditLog[]>('auditLogs') || []) as WorkspaceAuditLog[]) : s.auditLogs,
        loading: false,
        refreshing: false,
        error: null,
      }))
    } catch (error) {
      setState(s => ({ ...s, loading: false, refreshing: false, error: error instanceof Error ? error.message : 'WORKSPACE_LOAD_FAILED' }))
    }
  }, [pathname, router, supabase])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        authCache.current = { user: null, validatedAt: 0 }
        if (event === 'SIGNED_OUT') router.replace('/login')
        return
      }
      authCache.current = { user: session.user, validatedAt: Date.now() }
      setState(current => current.user?.id === session.user.id ? current : { ...current, user: session.user })
    })
    return () => data.subscription.unsubscribe()
  }, [router, supabase])

  useEffect(() => {
    const initial = !mounted.current
    mounted.current = true
    void load(initial, false)
  }, [load])
  const value = useMemo<WorkspaceState>(() => ({ ...state, refresh: () => load(false, true) }), [state, load])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return value
}
