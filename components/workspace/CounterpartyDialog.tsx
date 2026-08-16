'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/components/ui/search-select'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { useWorkspace } from './WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { countryOptions, currencyOptions, defaultCurrencyForCountry } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'
import { countryUsesIban, formatIban, isValidBic, isValidIban } from '@/lib/payment-validation'
import { workspaceCopy } from '@/lib/workspace-copy'
import { userError } from '@/lib/user-error'
import type { Counterparty } from '@/lib/types'

type Props = {
  open: boolean
  onOpenChange: (value: boolean) => void
  initial?: Counterparty | null
}

export function CounterpartyDialog({ open, onOpenChange, initial = null }: Props) {
  const ws = useWorkspace()
  const { lang } = useLanguage()
  const c = workspaceCopy[lang].counterparty
  const common = workspaceCopy[lang].common
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')
  const [bankCountry, setBankCountry] = useState('')
  const [bankName, setBankName] = useState('')
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [bic, setBic] = useState('')
  const [email, setEmail] = useState('')
  const [taxId, setTaxId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const countries = useMemo(() => countryOptions(lang).map(([code, label]) => ({ value: code, label, description: code, leading: <CountryFlag code={code}/> })), [lang])
  const currencies = useMemo(() => currencyOptions(lang).map(item => ({ value: item.code, label: item.code, description: item.name, leading: <span className="w-5 text-center text-[14px] font-semibold">{item.symbol}</span> })), [lang])

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCountry(initial?.country ?? '')
    setCurrency(initial?.currency ?? '')
    setBankCountry(initial?.bank_country ?? initial?.country ?? '')
    setBankName(initial?.bank_name ?? '')
    setAccount(initial?.account_number ?? '')
    setHolder(initial?.account_holder ?? '')
    setBic(initial?.bic ?? '')
    setEmail(initial?.email ?? '')
    setTaxId(initial?.tax_id ?? '')
    setError('')
  }, [open, initial])

  function chooseCountry(code: string) {
    setCountry(code)
    if (!bankCountry) setBankCountry(code)
    if (!initial || !currency) setCurrency(defaultCurrencyForCountry(code))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ws.user || !name.trim() || !country || !currency || !bankCountry) return
    setError('')
    if (account && countryUsesIban(bankCountry) && !isValidIban(account)) {
      setError(lang === 'ru' ? 'Проверьте IBAN — контрольная сумма не совпадает.' : 'Please check the IBAN — its checksum is invalid.')
      return
    }
    if (bic && !isValidBic(bic)) {
      setError(lang === 'ru' ? 'Проверьте BIC / SWIFT — формат реквизита неверный.' : 'Please check the BIC / SWIFT — the format is invalid.')
      return
    }

    setSaving(true)
    try {
      const client = createClient()
      const { error } = await client.rpc('flowpay_upsert_counterparty', {
        p_counterparty_id: initial?.id || null,
        p_name: name.trim(),
        p_country: country,
        p_currency: currency,
        p_bank_country: bankCountry,
        p_bank_name: bankName.trim(),
        p_account_number: account ? formatIban(account) : '',
        p_account_holder: holder.trim(),
        p_bic: bic.trim().toUpperCase(),
        p_email: email.trim(),
        p_tax_id: taxId.trim(),
      })
      if (error) throw error
      await ws.refresh()
      onOpenChange(false)
    } catch {
      setError(userError(lang, 'save'))
    } finally {
      setSaving(false)
    }
  }

  const isEditing = Boolean(initial)
  const title = isEditing
    ? (lang === 'ru' ? 'Изменить контрагента' : lang === 'fr' ? 'Modifier le bénéficiaire' : lang === 'de' ? 'Geschäftspartner bearbeiten' : lang === 'es' ? 'Editar contraparte' : 'Edit counterparty')
    : c.title
  const description = isEditing
    ? (lang === 'ru' ? 'Обновите данные компании и платёжные реквизиты.' : 'Update company and payment details.')
    : c.description
  const submitLabel = isEditing
    ? (lang === 'ru' ? 'Сохранить изменения' : lang === 'fr' ? 'Enregistrer' : lang === 'de' ? 'Änderungen speichern' : lang === 'es' ? 'Guardar cambios' : 'Save changes')
    : c.create

  return <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} className="sm:max-w-[760px]">
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.company}</span><Input value={name} onChange={e=>setName(e.target.value)} required/></label>
        <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.companyCountry}</span><SearchSelect value={country} onChange={chooseCountry} options={countries} placeholder={common.selectCountry}/></label>
        <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.preferredCurrency}</span><SearchSelect value={currency} onChange={setCurrency} options={currencies} variant="currency"/></label>
        <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.email}</span><Input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)] sm:col-span-2"><span>{c.taxId}</span><Input value={taxId} onChange={e=>setTaxId(e.target.value)}/></label>
      </div>
      <div className="rounded-[16px] border border-[var(--fp-border)] bg-[#fafbf8] p-5">
        <div className="mb-4"><h3 className="text-[15px] font-semibold">{c.bankDetails}</h3><p className="mt-1 text-[13px] text-[var(--fp-muted)]">{lang==='ru'?'Используются при подготовке платежей этому получателю.':'Used when preparing payments to this beneficiary.'}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.bankCountry}</span><SearchSelect value={bankCountry} onChange={setBankCountry} options={countries} placeholder={common.selectCountry}/></label>
          <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.bankName}</span><Input value={bankName} onChange={e=>setBankName(e.target.value)}/></label>
          <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)] sm:col-span-2"><span>{c.account}</span><Input value={account} onChange={e=>setAccount(e.target.value)} autoCapitalize="characters"/></label>
          <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.accountHolder}</span><Input value={holder} onChange={e=>setHolder(e.target.value)}/></label>
          <label className="space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.bic}</span><Input value={bic} onChange={e=>setBic(e.target.value)} autoCapitalize="characters"/></label>
        </div>
      </div>
      {error&&<div className="rounded-[12px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] px-4 py-3 text-[14px] text-[var(--fp-red)]">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-[var(--fp-border)] pt-5">
        <Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>{lang==='ru'?'Отмена':lang==='fr'?'Annuler':lang==='de'?'Abbrechen':lang==='es'?'Cancelar':'Cancel'}</Button>
        <Button disabled={saving}>{saving&&<Loader2 size={15} className="animate-spin"/>}{submitLabel}</Button>
      </div>
    </form>
  </Dialog>
}
