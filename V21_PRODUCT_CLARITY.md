# FlowPay 2.1 — Product Clarity & Reconciliation

## Product model

FlowPay 2.1 deliberately exposes one primary workflow instead of asking a new user to understand every finance module first:

**Supplier → Payment → Compare options → Approval → Settlement → Reconciliation**

The public landing page explains this outcome in plain language. Inside the workspace, Dashboard chooses the next useful action from actual account state, while “How FlowPay works” remains available from desktop and mobile navigation.

## Information architecture

Navigation labels describe tasks rather than implementation concepts. “Operations” is presented as **What needs attention**, routing as **Compare options**, treasury as **Payment plan**, and reconciliation as **Payment reconciliation**. Advanced analytics, reports, API and settings stay available but are visually secondary to daily payment work.

## Reconciliation

A payment marked `paid` or `received` becomes `unmatched` automatically. Operators can then record:

- bank/reference identifier;
- actual fee in the payment currency;
- actual recipient amount in the recipient currency;
- reconciliation note;
- `matched` or `needs_review` state.

`matched` requires evidence in the form of a non-empty bank reference. FlowPay does not estimate missing values.

## Event history

`payment_events` records creation and material changes server-side. Direct browser writes are revoked. Reads are owner-scoped and protected by FORCE RLS plus a restrictive AAL2 policy. The ledger powers payment timeline and Activity.

## Bulk operations

Bulk status changes call one transactional RPC. Existing `flowpay_set_payment_status` transition and approval checks remain authoritative for each payment. One invalid row aborts the batch instead of producing a partially updated selection.

## Approval currency fix

Approval threshold currency is an explicit profile field. v2.1 profile writes use `flowpay_update_profile_v21(p_approval_currency ...)`, and payment preview evaluates against this configured currency. Cross-currency cases still require an explicit decision rather than synthetic FX conversion.

## Routing invariant

2.1 does **not** add fallback routing. Quotes remain executable only when an active eligible production `provider_rule` exists. Missing coverage returns `NO_ELIGIBLE_PROVIDER_ROUTES`.
