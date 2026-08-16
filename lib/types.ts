export type Language = 'ru' | 'en' | 'fr' | 'de' | 'es'

export type ReferenceFx = {
  sourceCurrency: string
  targetCurrency: string
  rate: number
  date: string
  source: 'ECB'
  isReference: true
}

export type QuoteInput = {
  fromCountry: string
  toCountry: string
  amount: number
  sourceCurrency: string
  recipientCurrency: string
}

export type RouteStep = {
  label?: string
  institution?: string
  country?: string
  etaMinutes?: number
  kind?: 'origin' | 'bank' | 'intermediary' | 'payout' | 'destination'
}

export type QuoteRoute = {
  id: string
  providerCode: string
  providerName: string
  fee: number
  fixedFee: number
  percentageFee: number
  fxMarkup: number
  fxMarkupPct: number
  effectiveRatePct: number
  totalCost: number
  recipientGets: number | null
  speedMinutes: number
  score: number
  reliabilityPercent: number | null
  intermediaryBanks: number | null
  routeSteps: RouteStep[]
  source: string
  sourceUpdatedAt: string | null
  isEstimate: boolean
  why?: string[]
}

export type QuoteResponse = {
  quoteId: string
  routes: QuoteRoute[]
  generatedAt: string
  estimatedSaving: number
  disclaimer: string
  referenceFx?: ReferenceFx | null
  sourceCurrency: string
  recipientCurrency: string
}

export type AuditResult = {
  bestProviderCode: string | null
  estimatedBestFee: number | null
  potentialSaving: number
  routes: QuoteRoute[]
}

export type PaymentDraft = {
  id: string
  user_id: string
  counterparty_id: string | null
  supplier_name: string
  invoice_number: string
  amount: number
  currency: string
  due_date: string | null
  route_provider_code: string | null
  estimated_fee: number | null
  payment_method: 'bank_transfer' | 'swift' | 'local'
  charge_type: 'shared' | 'sender' | 'recipient'
  status: 'draft' | 'ready' | 'paid' | 'received' | 'cancelled' | 'failed'
  notes: string
  route_from_country: string | null
  route_to_country: string | null
  recipient_currency: string | null
  recipient_amount: number | null
  reference: string
  route_snapshot: QuoteRoute | null
  paid_at: string | null
  received_at: string | null
  created_at: string
  updated_at: string
}

export type Counterparty = {
  id: string
  user_id: string
  name: string
  country: string
  currency: string
  bank_country: string
  account_number: string
  bic: string
  email: string
  total_sent: number
  last_payment_at: string | null
  verification_status: 'unverified' | 'in_review' | 'verified' | 'rejected'
  bank_name: string
  account_holder: string
  tax_id: string
  created_at: string
  updated_at: string
}

export type CompanyProfile = {
  name: string
  country: string
  preferred_currency: string
  registration_number: string
  business_address: string
  default_payment_method: string
  default_charge_type: string
  beneficiary_notifications: boolean
  notify_payment_confirmations: boolean
  notify_payment_failures: boolean
  notify_security_alerts: boolean
  notify_weekly_reports: boolean
}

export type Calculation = {
  id: string
  user_id: string
  quote_id: string
  from_country: string
  to_country: string
  amount: number
  currency: string
  recipient_currency: string | null
  best_provider_code: string
  best_fee: number
  best_total_cost: number
  best_speed_minutes: number
  estimated_saving: number
  routes_snapshot: QuoteRoute[]
  created_at: string
}

export type AuditRequest = {
  id: string
  user_id: string | null
  email: string
  from_country: string
  to_country: string
  amount: number
  currency: string
  recipient_currency: string | null
  actual_fee: number
  best_provider_code: string | null
  estimated_best_fee: number | null
  potential_saving: number
  status: string
  created_at: string
}

export type ApiKeyRow = { id:string; user_id:string; name:string; key_prefix:string; last_used_at:string|null; created_at:string; revoked_at:string|null }
export type WorkspaceInvitation = { id:string; owner_user_id:string; email:string; role:'admin'|'finance_manager'|'analyst'|'viewer'; status:'pending'|'accepted'|'cancelled'; created_at:string; accepted_at:string|null }
export type ProviderRuleSummary = { id:string; provider_code:string; display_name:string|null; from_country:string; to_country:string; currencies:string[]; active:boolean; source_updated_at:string|null }

export type Invoice = {
  id:string; user_id:string; counterparty_id:string|null; invoice_number:string; supplier_name:string; issue_date:string|null; due_date:string|null;
  amount:number; currency:string; status:'open'|'scheduled'|'paid'|'cancelled'; reference:string; notes:string; payment_draft_id:string|null; created_at:string; updated_at:string;
}

export type ApiRequestLog = { id:string; user_id:string; endpoint:string; status_code:number; duration_ms:number|null; request_id?:string|null; created_at:string }
export type ApiUsageDaily = { user_id:string; endpoint:string; usage_date:string; request_count:number; success_count:number; error_count:number; total_duration_ms:number; max_duration_ms:number; updated_at:string }
export type WorkspaceAuditLog = { id:string; user_id:string; entity_type:string; entity_id:string|null; action:string; created_at:string }
