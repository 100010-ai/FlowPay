'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { safeInternalPath } from '@/lib/client-security'
import { ClientTimeoutError, withClientTimeout } from '@/lib/client-timeout'
import { useLanguage } from '@/components/LanguageContext'

type FactorInfo = { id: string; friendly_name?: string | null }

export default function MfaPage() {
  const { lang } = useLanguage()
  const ru = lang === 'ru'
  const router = useRouter()
  const [factors, setFactors] = useState<FactorInfo[]>([])
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [nextPath, setNextPath] = useState('/dashboard')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const requested = safeInternalPath(new URLSearchParams(window.location.search).get('next'))
      setNextPath(requested)
      const client = createClient()
      const { data: userData, error: userError } = await withClientTimeout(client.auth.getUser(), 8_000, 'MFA_USER_TIMEOUT')
      if (userError) throw userError
      if (!userData.user) {
        router.replace('/login')
        return
      }
      const { data: aal, error: aalError } = await withClientTimeout(client.auth.mfa.getAuthenticatorAssuranceLevel(), 8_000, 'MFA_AAL_TIMEOUT')
      if (aalError) throw aalError
      if (aal.currentLevel === 'aal2') {
        router.replace(requested)
        return
      }
      const { data: factorData, error: factorsError } = await withClientTimeout(client.auth.mfa.listFactors(), 8_000, 'MFA_FACTORS_TIMEOUT')
      if (factorsError) throw factorsError
      const verified = (factorData.totp || []).filter(item => item.status === 'verified').map(item => ({ id: item.id, friendly_name: item.friendly_name }))
      if (!verified.length) {
        router.replace(`/settings/security?required=1&next=${encodeURIComponent(requested)}`)
        return
      }
      if (!cancelled) {
        setFactors(verified)
        setFactorId(verified[0].id)
        setLoading(false)
      }
    })().catch((err) => {
      if (!cancelled) {
        setError(err instanceof ClientTimeoutError ? (ru ? 'FlowPay слишком долго ждёт ответ 2FA-сервиса. Повторите попытку.' : 'FlowPay is taking too long to reach the 2FA service. Try again.') : (ru ? 'Не удалось подготовить проверку 2FA.' : 'Could not prepare 2FA verification.'))
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [router, ru])

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (verifying || !factorId || !/^[0-9]{6}$/.test(code)) return
    setVerifying(true)
    setError('')
    try {
      const client = createClient()
      const { data: challenge, error: challengeError } = await withClientTimeout(client.auth.mfa.challenge({ factorId }), 8_000, 'MFA_CHALLENGE_TIMEOUT')
      if (challengeError) throw challengeError
      const { error: verifyError } = await withClientTimeout(client.auth.mfa.verify({ factorId, challengeId: challenge.id, code }), 10_000, 'MFA_VERIFY_TIMEOUT')
      if (verifyError) throw verifyError
      const { data: aal, error: aalError } = await withClientTimeout(client.auth.mfa.getAuthenticatorAssuranceLevel(), 8_000, 'MFA_AAL_TIMEOUT')
      if (aalError || aal.currentLevel !== 'aal2') throw aalError || new Error('AAL2_REQUIRED')
      router.replace(nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientTimeoutError ? (ru ? '2FA-сервис отвечает слишком долго. Повторите попытку.' : 'The 2FA service is taking too long to respond. Try again.') : (ru ? 'Код не подошёл или истёк. Проверьте время на устройстве и попробуйте снова.' : 'The code is invalid or expired. Check your device time and try again.'))
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] p-4 sm:p-6"><section className="w-full max-w-[500px] overflow-hidden rounded-[22px] border border-[var(--fp-border)] bg-white shadow-[0_28px_90px_rgba(26,48,33,.09)]"><header className="flex items-center justify-between border-b border-[var(--fp-border)] px-5 py-4 sm:px-6"><FlowPayLogo/><Link href="/login" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-text)]"><ArrowLeft size={13}/>{ru ? 'Выйти' : 'Back'}</Link></header><div className="p-6 sm:p-8"><span className="grid size-12 place-items-center rounded-[14px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><ShieldCheck size={22}/></span><h1 className="mt-5 text-[30px] font-semibold tracking-[-.045em]">{ru ? 'Подтвердите вход' : 'Confirm your sign-in'}</h1><p className="mt-2 text-[14px] leading-6 text-[var(--fp-muted)]">{ru ? 'Введите шестизначный код из одного из подключённых приложений-аутентификаторов. Финансовые данные не открываются AAL1-сессии.' : 'Enter the six-digit code from one of your enrolled authenticators. Workspace financial data is not exposed to an AAL1 session.'}</p>
      {!loading && error && !factors.length ? <div className="mt-7 rounded-[12px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-4 text-[13px] text-[var(--fp-red)]"><p>{error}</p><Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}><RefreshCw size={14}/>{ru ? 'Повторить' : 'Retry'}</Button></div> : loading ? <div className="mt-7 flex items-center gap-2 rounded-[12px] bg-[#f7f9f6] p-4 text-[13px] text-[var(--fp-muted)]"><Loader2 size={15} className="animate-spin"/>{ru ? 'Проверяем сессию…' : 'Checking session…'}</div> : <form onSubmit={verify} className="mt-7">
        {factors.length > 1 && <div className="mb-4"><span className="text-[12px] font-semibold text-[var(--fp-muted)]">{ru ? 'Выберите устройство' : 'Choose an authenticator'}</span><div className="mt-2 grid gap-2">{factors.map((factor, index) => <button key={factor.id} type="button" onClick={() => { setFactorId(factor.id); setCode(''); setError('') }} className={`rounded-[10px] border px-3 py-2.5 text-left text-[12px] font-semibold ${factorId === factor.id ? 'border-[#9fc4aa] bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]' : 'border-[var(--fp-border)] bg-white text-[var(--fp-muted)]'}`}>{factor.friendly_name || `FlowPay Authenticator ${index + 1}`}</button>)}</div></div>}
        <label className="block space-y-2 text-[13px] font-medium text-[var(--fp-muted)]"><span>{ru ? 'Код 2FA' : '2FA code'}</span><div className="relative"><KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fp-subtle)]" size={16}/><Input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="h-[50px] pl-11 font-mono text-[18px] tracking-[.28em]" placeholder="000000"/></div></label>{error && <div className="mt-4 rounded-[11px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-3 text-[13px] leading-5 text-[var(--fp-red)]">{error}</div>}<Button size="lg" className="mt-5 h-[50px] w-full" disabled={verifying || code.length !== 6}>{verifying && <Loader2 size={16} className="animate-spin"/>}{ru ? 'Подтвердить 2FA' : 'Verify 2FA'}</Button>
      </form>}
      <p className="mt-5 text-center text-[11px] leading-5 text-[var(--fp-subtle)]">{ru ? 'Никому не сообщайте одноразовый код. FlowPay никогда не попросит его в сообщении или по телефону.' : 'Never share a one-time code. FlowPay will never request it in a message or phone call.'}</p></div></section></main>
}
