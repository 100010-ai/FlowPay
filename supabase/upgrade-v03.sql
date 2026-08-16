-- FlowPay v0.3 upgrade
-- Run this in Supabase SQL Editor if v0.2 is already installed.

update public.provider_rules
set currencies = array['EUR','USD','GBP','CHF','CAD','AUD','NZD','JPY','CNY','HKD','SGD','INR','AED','SAR','QAR','KWD','BHD','OMR','TRY','PLN','CZK','HUF','RON','BGN','SEK','NOK','DKK','ISK','BRL','MXN','ARS','CLP','COP','PEN','UYU','ZAR','EGP','MAD','NGN','KES','GHS','ILS','KRW','TWD','THB','MYR','IDR','PHP','VND','PKR','BDT','LKR','KZT','UAH','GEL','AMD','AZN','RSD','XOF','XAF'], active = true
where rule_key in ('bank-global-v1','global-transfer-v1','fx-route-v1');

insert into public.provider_rules (rule_key, provider_code, from_country, to_country, currencies, fee_percent, fixed_fee, fx_markup_percent, speed_minutes, min_amount, max_amount, priority)
values
  ('regional-any-us-v1', 'regional_fast', '*', 'US', array['EUR','USD','GBP','CAD','CHF'], 0.16, 7, 0.10, 120, 100, 750000, 8),
  ('regional-any-gb-v1', 'regional_fast', '*', 'GB', array['EUR','GBP','USD','CHF'], 0.13, 6, 0.08, 90, 100, 750000, 8),
  ('regional-any-ae-v1', 'regional_fast', '*', 'AE', array['EUR','USD','GBP','AED','SAR'], 0.18, 8, 0.11, 150, 250, 750000, 8),
  ('regional-any-sg-v1', 'regional_fast', '*', 'SG', array['EUR','USD','GBP','SGD','AUD','HKD'], 0.17, 8, 0.10, 160, 250, 750000, 8),
  ('regional-any-in-v1', 'regional_fast', '*', 'IN', array['EUR','USD','GBP','INR','AED'], 0.19, 8, 0.12, 180, 250, 500000, 8),
  ('regional-any-jp-v1', 'regional_fast', '*', 'JP', array['EUR','USD','GBP','JPY'], 0.17, 8, 0.10, 180, 250, 750000, 8),
  ('regional-any-hk-v1', 'regional_fast', '*', 'HK', array['EUR','USD','GBP','HKD','CNY'], 0.16, 8, 0.10, 150, 250, 750000, 8)
on conflict (rule_key) where rule_key is not null do update set
  provider_code = excluded.provider_code,
  from_country = excluded.from_country,
  to_country = excluded.to_country,
  currencies = excluded.currencies,
  fee_percent = excluded.fee_percent,
  fixed_fee = excluded.fixed_fee,
  fx_markup_percent = excluded.fx_markup_percent,
  speed_minutes = excluded.speed_minutes,
  min_amount = excluded.min_amount,
  max_amount = excluded.max_amount,
  priority = excluded.priority,
  active = true;
