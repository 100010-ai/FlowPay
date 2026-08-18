# FlowPay 2.0 — Platform Notes

## Release intent

FlowPay 2.0 changes the workspace from a set of payment-management screens into an operational control plane. The new systems are deliberately built on existing workspace rows and production route metadata; they do not introduce demo financial data or hidden provider fallbacks.

## New control systems

### Operations Center

`/operations` derives a deterministic queue from payments, invoices, counterparties and provider-rule metadata. Severity is based on due dates and blockers. The Ops Score is a workflow-health indicator, not a credit/risk score.

### Payment Controls

Settings expose an optional approval policy with a threshold in the reporting currency. Server-side SQL/RPC is the enforcement boundary. Payments marked `required`, `pending` or `rejected` cannot advance to `ready` or `paid`. Every request/decision writes an immutable payment-detail snapshot into the approval event ledger so later edits do not rewrite what was reviewed.

For a payment in a currency different from the policy/reporting currency, FlowPay requires approval rather than estimating the threshold through a synthetic FX conversion.

The current product is still a user-owned workspace. This control is an explicit approval checkpoint, **not** a multi-user segregation-of-duties implementation.

### Duplicate Guard

The payment form detects likely duplicates using invoice identity when available and a conservative supplier/amount/currency/due-date signature otherwise. It warns the operator and never automatically mutates/deletes existing payments.

### Treasury

`/treasury` builds commitments from actual active payment drafts. Reference FX may be used for reporting normalization only when available. Missing FX stays visible as separate currency exposure and is excluded from normalized totals.

### Settlement Watch

Operations отслеживает `paid` платежи относительно `speedMinutes` из сохранённого выбранного route snapshot. Если production route ETA превышен, появляется задача. При отсутствии сохранённого ETA никакой запасной SLA не придумывается.

### Activity

`/activity` combines payment approval events, payment/workspace audit changes and security/access events into one searchable timeline.

### Search & navigation

The workspace shell adds grouped information architecture, mobile navigation and `Ctrl/Cmd + K` search across pages/actions plus rows already loaded for the authenticated workspace.

## Routing invariant

FlowPay 2.0 preserves the v1.9 routing model:

1. Provider catalog describes potential network presence only.
2. `provider_rules` contain executable, source-backed production pricing/routing rules.
3. A quote is eligible only when country/currency/amount constraints match an active strict rule.
4. If nothing matches, the route engine returns no eligible route.
5. The UI, catalog and reference FX layer cannot inject a provider or synthetic route.

## Database migration

For a v1.9 database, apply:

```text
supabase/upgrade-v20.sql
```

The migration adds approval policy fields, payment approval state, immutable approval event history, RLS and AAL2-protected RPCs. It also replaces the payment status transition RPC with an approval-aware implementation.

For older databases, follow the migration sequence in `README.md`; `upgrade-v20.sql` must be last.

## Deployment order

1. Back up the production database.
2. Apply all missing SQL migrations through `upgrade-v20.sql`.
3. Run `npm ci` using Node 24.x.
4. Run `npm run check:env`.
5. Run `npm run audit` and `npm run typecheck`.
6. Build/deploy a Preview.
7. Complete `LAUNCH_CHECKLIST.md`, especially approval transitions and no-route behavior.
8. Promote the exact verified build to production.
