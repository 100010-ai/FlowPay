import type { Counterparty, Invoice, Language, PaymentDraft, ProviderRuleSummary } from './types'
import { bankDetailsState } from './payment-validation'

export type OperationsTaskKind = 'payment' | 'invoice' | 'counterparty' | 'approval' | 'routing'
export type OperationsTaskSeverity = 'critical' | 'high' | 'medium' | 'low'
export type OperationsTask = {
  id: string
  kind: OperationsTaskKind
  severity: OperationsTaskSeverity
  title: string
  description: string
  href: string
  dueAt: string | null
  entityLabel: string
  amount?: number
  currency?: string
}

export type OperationsSnapshot = {
  tasks: OperationsTask[]
  critical: number
  dueSevenDays: number
  approvalQueue: number
  settlementWatch: number
  routingGaps: number
  dataIssues: number
  score: number
}

function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

function daysFromToday(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return Math.round((date.getTime() - startOfToday().getTime()) / 86_400_000)
}

function taskWeight(severity: OperationsTaskSeverity) {
  return severity === 'critical' ? 10 : severity === 'high' ? 6 : severity === 'medium' ? 3 : 1
}

export function buildOperationsSnapshot(input: {
  payments: PaymentDraft[]
  invoices: Invoice[]
  counterparties: Counterparty[]
  providerRules: ProviderRuleSummary[]
  lang?: Language
}): OperationsSnapshot {
  const { payments, invoices, counterparties, providerRules } = input
  const ru = input.lang === 'ru'
  const tasks: OperationsTask[] = []

  for (const payment of payments) {
    if (payment.status === 'paid') {
      const expectedMinutes = Number(payment.route_snapshot?.speedMinutes)
      const paidAt = payment.paid_at ? new Date(payment.paid_at).getTime() : Number.NaN
      const elapsedMinutes = Number.isFinite(paidAt) ? Math.max(0, (Date.now() - paidAt) / 60_000) : 0
      if (Number.isFinite(expectedMinutes) && expectedMinutes > 0 && elapsedMinutes > expectedMinutes) {
        tasks.push({
          id: `settlement:${payment.id}`,
          kind: 'payment',
          severity: 'high',
          title: ru ? 'Платёж вышел за расчётный срок доставки' : 'Payment is beyond its route ETA',
          description: ru ? `${payment.supplier_name} · статус Received ещё не подтверждён после расчётного срока выбранного production route.` : `${payment.supplier_name} · Received is still unconfirmed after the selected production route ETA.`,
          href: `/payments?selected=${payment.id}`,
          dueAt: null,
          entityLabel: payment.invoice_number || payment.supplier_name,
          amount: payment.amount,
          currency: payment.currency,
        })
      }
      continue
    }
    if (['received', 'cancelled'].includes(payment.status)) continue
    const due = daysFromToday(payment.due_date)
    const approval = payment.approval_status
    if (approval === 'required' || approval === 'pending' || approval === 'rejected') {
      tasks.push({
        id: `approval:${payment.id}`,
        kind: 'approval',
        severity: approval === 'rejected' ? 'high' : due != null && due < 0 ? 'critical' : due != null && due <= 2 ? 'high' : 'medium',
        title: approval === 'rejected' ? (ru ? 'Платёж отклонён на проверке' : 'Payment approval rejected') : approval === 'pending' ? (ru ? 'Ожидается решение по платежу' : 'Payment is awaiting approval') : (ru ? 'Платёж требует согласования' : 'Payment requires approval'),
        description: ru ? `${payment.supplier_name} · согласование нужно завершить до отправки.` : `${payment.supplier_name} · approval must be completed before the payment can move forward.`,
        href: `/approvals?payment=${payment.id}`,
        dueAt: payment.due_date,
        entityLabel: payment.invoice_number || payment.supplier_name,
        amount: payment.amount,
        currency: payment.currency,
      })
    }
    if (due != null && due < 0) {
      tasks.push({
        id: `payment-overdue:${payment.id}`,
        kind: 'payment',
        severity: 'critical',
        title: ru ? 'Просрочен срок платежа' : 'Payment is overdue',
        description: ru ? `${payment.supplier_name} · просрочка ${Math.abs(due)} дн.` : `${payment.supplier_name} · ${Math.abs(due)} day(s) overdue.`,
        href: `/payments?selected=${payment.id}`,
        dueAt: payment.due_date,
        entityLabel: payment.invoice_number || payment.supplier_name,
        amount: payment.amount,
        currency: payment.currency,
      })
    } else if (due != null && due <= 7) {
      tasks.push({
        id: `payment-due:${payment.id}`,
        kind: 'payment',
        severity: due <= 1 ? 'high' : 'medium',
        title: ru ? 'Ближайший платёж' : 'Payment due soon',
        description: ru ? `${payment.supplier_name} · до срока ${due === 0 ? 'меньше дня' : `${due} дн.`}` : `${payment.supplier_name} · due ${due === 0 ? 'today' : `in ${due} day(s)`}.`,
        href: `/payments?selected=${payment.id}`,
        dueAt: payment.due_date,
        entityLabel: payment.invoice_number || payment.supplier_name,
        amount: payment.amount,
        currency: payment.currency,
      })
    }
    if (!payment.route_provider_code && payment.status !== 'failed') {
      tasks.push({
        id: `payment-route:${payment.id}`,
        kind: 'routing',
        severity: due != null && due <= 2 ? 'high' : 'low',
        title: ru ? 'Для платежа не выбран маршрут' : 'Payment has no selected route',
        description: ru ? `${payment.supplier_name} · сравните доступные production routes перед отправкой.` : `${payment.supplier_name} · compare available production routes before sending.`,
        href: `/payments/${payment.id}/edit`,
        dueAt: payment.due_date,
        entityLabel: payment.invoice_number || payment.supplier_name,
        amount: payment.amount,
        currency: payment.currency,
      })
    }
  }

  for (const invoice of invoices) {
    if (!['open', 'scheduled'].includes(invoice.status)) continue
    const due = daysFromToday(invoice.due_date)
    if (due != null && due < 0 && !invoice.payment_draft_id) {
      tasks.push({
        id: `invoice:${invoice.id}`,
        kind: 'invoice',
        severity: 'high',
        title: ru ? 'Просроченный счёт без платежа' : 'Overdue invoice without a payment',
        description: ru ? `${invoice.supplier_name} · создайте платёж или обновите состояние счёта.` : `${invoice.supplier_name} · create a payment or update the invoice state.`,
        href: `/invoices?selected=${invoice.id}`,
        dueAt: invoice.due_date,
        entityLabel: invoice.invoice_number || invoice.supplier_name,
        amount: invoice.amount,
        currency: invoice.currency,
      })
    }
  }

  for (const counterparty of counterparties) {
    const readiness = bankDetailsState(counterparty.bank_country, counterparty.account_number, counterparty.bic)
    if (readiness !== 'details_ready') {
      tasks.push({
        id: `counterparty:${counterparty.id}`,
        kind: 'counterparty',
        severity: 'low',
        title: readiness === 'details_invalid' ? (ru ? 'Проверьте банковские реквизиты' : 'Review bank details') : (ru ? 'Не заполнены банковские реквизиты' : 'Bank details are incomplete'),
        description: ru ? `${counterparty.name} · без готовых реквизитов платёж нельзя нормально подготовить.` : `${counterparty.name} · complete payment details before preparing a transfer.`,
        href: `/counterparties?selected=${counterparty.id}`,
        dueAt: null,
        entityLabel: counterparty.name,
      })
    }
  }

  const providerCodes = new Set(providerRules.filter(rule => rule.active).map(rule => rule.provider_code))
  const staleRules = providerRules.filter(rule => {
    if (!rule.active || !rule.source_updated_at) return true
    const age = Date.now() - new Date(rule.source_updated_at).getTime()
    return !Number.isFinite(age) || age > 45 * 86_400_000
  })
  if (providerRules.length === 0) {
    tasks.push({
      id: 'routing:none',
      kind: 'routing',
      severity: 'high',
      title: ru ? 'Нет активных production routes' : 'No active production routes',
      description: ru ? 'FlowPay не будет рассчитывать маршрут без подтверждённых правил провайдеров.' : 'FlowPay will not calculate a route without verified provider rules.',
      href: '/routes',
      dueAt: null,
      entityLabel: ru ? 'Маршрутизация' : 'Routing',
    })
  } else if (staleRules.length) {
    tasks.push({
      id: 'routing:stale',
      kind: 'routing',
      severity: staleRules.length === providerRules.length ? 'high' : 'medium',
      title: ru ? 'Есть устаревшие данные маршрутов' : 'Some route data needs refresh',
      description: ru ? `${staleRules.length} из ${providerRules.length} правил не обновлялись более 45 дней или не имеют даты источника.` : `${staleRules.length} of ${providerRules.length} rules are older than 45 days or have no source date.`,
      href: '/routes',
      dueAt: null,
      entityLabel: ru ? `${providerCodes.size} провайдеров` : `${providerCodes.size} providers`,
    })
  }

  const rank: Record<OperationsTaskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  tasks.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.dueAt || '9999').localeCompare(String(b.dueAt || '9999')) || a.title.localeCompare(b.title))

  const penalty = tasks.reduce((sum, task) => sum + taskWeight(task.severity), 0)
  return {
    tasks,
    critical: tasks.filter(task => task.severity === 'critical').length,
    dueSevenDays: payments.filter(payment => !['paid', 'received', 'cancelled'].includes(payment.status)).filter(payment => {
      const due = daysFromToday(payment.due_date)
      return due != null && due >= 0 && due <= 7
    }).length,
    approvalQueue: payments.filter(payment => ['required', 'pending', 'rejected'].includes(payment.approval_status)).length,
    settlementWatch: tasks.filter(task => task.id.startsWith('settlement:')).length,
    routingGaps: tasks.filter(task => task.kind === 'routing').length,
    dataIssues: tasks.filter(task => task.kind === 'counterparty').length,
    score: Math.max(0, Math.min(100, 100 - penalty)),
  }
}

export function paymentApprovalRequired(payment: PaymentDraft) {
  return ['required', 'pending', 'rejected'].includes(payment.approval_status)
}
