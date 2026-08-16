-- FlowPay 1.1 security hardening.
-- Public pricing/routing rules move behind server-side FlowPay endpoints.

alter table public.provider_rules enable row level security;
alter table public.audit_requests enable row level security;

drop policy if exists "provider rules public read" on public.provider_rules;
drop policy if exists "provider rules authenticated read" on public.provider_rules;
create policy "provider rules authenticated read" on public.provider_rules
for select to authenticated using (active = true);

-- Audit requests are persisted by the server-side /api/audit handler.
drop policy if exists "audit public insert" on public.audit_requests;
drop policy if exists "audit own insert" on public.audit_requests;

-- Transactional payment/invoice operations for FlowPay 1.1.
alter table public.payment_drafts add column if not exists payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer','swift','local'));
alter table public.payment_drafts add column if not exists charge_type text not null default 'shared' check (charge_type in ('shared','sender','recipient'));

create or replace function public.flowpay_set_payment_status(p_payment_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_payment public.payment_drafts%rowtype;
  now_at timestamptz := now();
begin
  if p_status not in ('ready','paid','received') then raise exception 'INVALID_PAYMENT_STATUS' using errcode = '22023'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=auth.uid() for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode = '42501'; end if;
  if current_payment.status='received' and p_status<>'received' then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;
  if current_payment.status='paid' and p_status not in ('paid','received') then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;
  update public.payment_drafts set
    status=p_status,
    paid_at=case when p_status in ('paid','received') then coalesce(paid_at,now_at) else paid_at end,
    received_at=case when p_status='received' then coalesce(received_at,now_at) else received_at end
  where id=current_payment.id and user_id=auth.uid();
  if p_status in ('paid','received') then
    update public.invoices set status='paid' where payment_draft_id=current_payment.id and user_id=auth.uid() and status<>'cancelled';
  end if;
end;
$$;

create or replace function public.flowpay_set_invoice_status(p_invoice_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_invoice public.invoices%rowtype;
  now_at timestamptz := now();
begin
  if p_status not in ('paid','cancelled') then raise exception 'INVALID_INVOICE_STATUS' using errcode='22023'; end if;
  select * into current_invoice from public.invoices where id=p_invoice_id and user_id=auth.uid() for update;
  if not found then raise exception 'INVOICE_NOT_FOUND' using errcode='42501'; end if;
  if current_invoice.status='paid' and p_status<>'paid' then raise exception 'INVALID_INVOICE_TRANSITION' using errcode='22023'; end if;
  if current_invoice.status='cancelled' and p_status<>'cancelled' then raise exception 'INVALID_INVOICE_TRANSITION' using errcode='22023'; end if;
  if p_status='cancelled' and current_invoice.payment_draft_id is not null then raise exception 'INVOICE_HAS_LINKED_PAYMENT' using errcode='22023'; end if;
  update public.invoices set status=p_status where id=current_invoice.id and user_id=auth.uid();
  if p_status='paid' and current_invoice.payment_draft_id is not null then
    update public.payment_drafts set status=case when status='received' then status else 'paid' end, paid_at=coalesce(paid_at,now_at)
    where id=current_invoice.payment_draft_id and user_id=auth.uid();
  end if;
end;
$$;

create or replace function public.flowpay_link_invoice_payment(p_invoice_id uuid, p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_invoice public.invoices%rowtype;
  current_payment public.payment_drafts%rowtype;
begin
  select * into current_invoice from public.invoices where id=p_invoice_id and user_id=auth.uid() for update;
  if not found then raise exception 'INVOICE_NOT_FOUND' using errcode='42501'; end if;
  if current_invoice.status in ('paid','cancelled') then raise exception 'INVOICE_CANNOT_BE_LINKED' using errcode='22023'; end if;
  if current_invoice.payment_draft_id is not null and current_invoice.payment_draft_id <> p_payment_id then raise exception 'INVOICE_ALREADY_LINKED' using errcode='23505'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=auth.uid() for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if exists (select 1 from public.invoices where payment_draft_id=p_payment_id and id<>p_invoice_id and user_id=auth.uid()) then raise exception 'PAYMENT_ALREADY_LINKED' using errcode='23505'; end if;
  update public.invoices set payment_draft_id=current_payment.id,status='scheduled' where id=current_invoice.id and user_id=auth.uid();
end;
$$;

create or replace function public.flowpay_delete_payment_draft(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare current_payment public.payment_drafts%rowtype;
begin
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=auth.uid() for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status<>'draft' then raise exception 'ONLY_DRAFT_PAYMENT_CAN_BE_DELETED' using errcode='22023'; end if;
  update public.invoices set payment_draft_id=null,status=case when status='scheduled' then 'open' else status end
  where payment_draft_id=current_payment.id and user_id=auth.uid();
  delete from public.payment_drafts where id=current_payment.id and user_id=auth.uid();
end;
$$;


create or replace function public.flowpay_delete_counterparty(p_counterparty_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_counterparty public.counterparties%rowtype;
begin
  select * into current_counterparty
  from public.counterparties
  where id = p_counterparty_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'COUNTERPARTY_NOT_FOUND' using errcode = '42501';
  end if;
  if exists (select 1 from public.payment_drafts where counterparty_id = p_counterparty_id and user_id = auth.uid())
     or exists (select 1 from public.invoices where counterparty_id = p_counterparty_id and user_id = auth.uid()) then
    raise exception 'COUNTERPARTY_HAS_HISTORY' using errcode = '23503';
  end if;

  delete from public.counterparties where id = p_counterparty_id and user_id = auth.uid();
end;
$$;


revoke all on function public.flowpay_delete_counterparty(uuid) from public;
grant execute on function public.flowpay_delete_counterparty(uuid) to authenticated;

revoke all on function public.flowpay_set_payment_status(uuid,text) from public;
revoke all on function public.flowpay_set_invoice_status(uuid,text) from public;
revoke all on function public.flowpay_link_invoice_payment(uuid,uuid) from public;
revoke all on function public.flowpay_delete_payment_draft(uuid) from public;
grant execute on function public.flowpay_set_payment_status(uuid,text) to authenticated;
grant execute on function public.flowpay_set_invoice_status(uuid,text) to authenticated;
grant execute on function public.flowpay_link_invoice_payment(uuid,uuid) to authenticated;
grant execute on function public.flowpay_delete_payment_draft(uuid) to authenticated;
