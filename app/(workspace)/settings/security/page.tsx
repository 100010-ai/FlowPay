'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clipboard, KeyRound, Loader2, LockKeyhole, Plus, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { safeInternalPath } from '@/lib/client-security'
import { useLanguage } from '@/components/LanguageContext'

type FactorInfo = { id: string; friendly_name?: string | null }
type Enrollment = { factorId: string; qr: string; secret: string }

export default function SecuritySetupPage() {
  const { lang } = useLanguage()
  const ru = lang === 'ru'
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState<'aal1' | 'aal2' | null>(null)
  const [verifiedFactors, setVerifiedFactors] = useState<FactorInfo[]>([])
  const [enroll, setEnroll] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [nextPath, setNextPath] = useState('/dashboard')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const client = createClient()
      const { data: user } = await client.auth.getUser()
      if (!user.user) {
        router.replace('/login')
        return
      }
      const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] = await Promise.all([
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
        client.auth.mfa.listFactors(),
      ])
      if (aalError) throw aalError
      if (factorsError) throw factorsError
      setCurrentLevel(aal.currentLevel)
      setVerifiedFactors((factors.totp || []).filter(item => item.status === 'verified').map(item => ({ id: item.id, friendly_name: item.friendly_name })))
    } catch {
      setError(ru ? 'Не удалось загрузить настройки 2FA.' : 'Could not load 2FA settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setNextPath(safeInternalPath(new URLSearchParams(window.location.search).get('next')))
    void load()
  }, [])

  async function beginEnrollment() {
    if (busy || verifiedFactors.length >= 3) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const client = createClient()
      const { data, error: enrollError } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `FlowPay Authenticator ${verifiedFactors.length + 1}`,
      })
      if (enrollError) throw enrollError
      if (!data.totp) throw new Error('TOTP_REQUIRED')
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
      setCode('')
    } catch {
      setError(ru ? 'Не удалось начать настройку TOTP. Повторите позже.' : 'Could not start TOTP enrollment. Try again later.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnrollment() {
    if (!enroll || busy) return
    setBusy(true)
    setError('')
    try {
      const client = createClient()
      const { error: removeError } = await client.auth.mfa.unenroll({ factorId: enroll.factorId })
      if (removeError) throw removeError
      setEnroll(null)
      setCode('')
    } catch {
      setError(ru ? 'Не удалось отменить незавершённую настройку.' : 'Could not cancel the unfinished enrollment.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyEnrollment(event: FormEvent) {
    event.preventDefault()
    if (!enroll || busy || !/^[0-9]{6}$/.test(code)) return
    setBusy(true)
    setError('')
    try {
      const client = createClient()
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: enroll.factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await client.auth.mfa.verify({ factorId: enroll.factorId, challengeId: challenge.id, code })
      if (verifyError) throw verifyError
      setEnroll(null)
      setCode('')
      setMessage(ru ? 'TOTP-фактор подтверждён. Сессия защищена AAL2.' : 'TOTP factor verified. The session is protected with AAL2.')
      await load()
      setTimeout(() => {
        if (new URLSearchParams(window.location.search).get('required') === '1') router.replace(nextPath)
      }, 700)
    } catch {
      setError(ru ? 'Код не подтверждён. Проверьте его и попробуйте снова.' : 'The code could not be verified. Check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function removeFactor(factor: FactorInfo) {
    if (busy || currentLevel !== 'aal2') return
    const prompt = verifiedFactors.length > 1
      ? (ru ? 'Удалить этот TOTP-фактор? Все активные сессии будут завершены.' : 'Remove this TOTP factor? All active sessions will be signed out.')
      : (ru ? 'Удалить последний TOTP-фактор? Доступ к рабочим данным будет заблокирован до новой настройки 2FA, а все сессии будут завершены.' : 'Remove the last TOTP factor? Workspace data will be locked until 2FA is enrolled again, and all sessions will be signed out.')
    if (!confirm(prompt)) return
    setBusy(true)
    setError('')
    try {
      const client = createClient()
      const { error: removeError } = await client.auth.mfa.unenroll({ factorId: factor.id })
      if (removeError) throw removeError
      const { error: refreshError } = await client.auth.refreshSession()
      if (refreshError) throw refreshError
      await client.auth.signOut({ scope: 'global' })
      router.replace('/login?security=mfa-removed')
    } catch {
      setError(ru ? 'Не удалось удалить фактор.' : 'Could not remove the factor.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="fp-enter">
    <button onClick={() => router.push('/settings')} className="mb-3 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--fp-muted)] hover:text-[var(--fp-text)]"><ArrowLeft size={14}/>{ru ? 'Настройки' : 'Settings'}</button>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><span className="text-[11px] font-semibold uppercase tracking-[.13em] text-[var(--fp-green)]">Security Center</span><h1 className="mt-2 text-[32px] font-semibold tracking-[-.05em]">{ru ? 'Двухфакторная защита' : 'Two-factor protection'}</h1><p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[var(--fp-muted)]">{ru ? 'FlowPay v1.6 требует AAL2 перед доступом к финансовым данным и любыми изменениями рабочего пространства. Можно подключить резервный TOTP-фактор на втором устройстве.' : 'FlowPay v1.6 requires AAL2 before workspace financial data or mutations are available. You can enroll a backup TOTP factor on a second device.'}</p></div>
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ${currentLevel === 'aal2' ? 'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]' : 'bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]'}`}>{currentLevel === 'aal2' ? <ShieldCheck size={14}/> : <ShieldAlert size={14}/>}AAL: {currentLevel || '0'}</span>
    </div>

    {error && <div className="mt-5 rounded-[12px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-3.5 text-[13px] text-[var(--fp-red)]">{error}</div>}
    {message && <div className="mt-5 rounded-[12px] border border-[#cde1d1] bg-[var(--fp-green-soft)] p-3.5 text-[13px] text-[var(--fp-green-strong)]">{message}</div>}

    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_.78fr]">
      <Card className="p-5 sm:p-6">
        {loading ? <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[var(--fp-muted)]"><Loader2 className="animate-spin" size={16}/>{ru ? 'Проверяем защиту…' : 'Checking security…'}</div>
          : enroll ? <form onSubmit={verifyEnrollment}>
            <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-[12px] bg-[#eef4ef] text-[var(--fp-green)]"><Smartphone size={20}/></span><div><h2 className="text-[16px] font-semibold">{ru ? 'Подключите приложение-аутентификатор' : 'Connect an authenticator app'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? 'Отсканируйте QR-код на основном или резервном устройстве. Секрет ниже равнозначен QR-коду — храните его как пароль.' : 'Scan the QR code on your primary or backup device. The secret below is equivalent to the QR code and must be protected like a password.'}</p></div></div>
            <div className="mt-5 grid gap-5 sm:grid-cols-[190px_1fr]"><div className="rounded-[14px] border border-[var(--fp-border)] bg-white p-3"><img src={enroll.qr} alt="TOTP QR code" className="mx-auto size-[164px]"/></div><div><span className="text-[12px] font-semibold text-[var(--fp-muted)]">{ru ? 'Секрет для ручного ввода' : 'Manual setup secret'}</span><div className="mt-2 flex items-center gap-2 rounded-[10px] bg-[#f6f8f5] p-3"><code className="min-w-0 flex-1 break-all text-[12px]">{enroll.secret}</code><button type="button" onClick={() => navigator.clipboard.writeText(enroll.secret)} className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-[var(--fp-border)] bg-white text-[var(--fp-green)]" aria-label={ru ? 'Скопировать секрет' : 'Copy secret'}><Clipboard size={14}/></button></div><label className="mt-4 block space-y-2 text-[13px] font-medium text-[var(--fp-muted)]"><span>{ru ? 'Шестизначный код' : 'Six-digit code'}</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="font-mono tracking-[.2em]"/></label><div className="mt-4 flex gap-2"><Button className="flex-1" disabled={busy || code.length !== 6}>{busy && <Loader2 size={14} className="animate-spin"/>}{ru ? 'Подтвердить TOTP' : 'Verify TOTP'}</Button><Button type="button" variant="secondary" onClick={cancelEnrollment} disabled={busy}>{ru ? 'Отмена' : 'Cancel'}</Button></div></div></div>
          </form>
          : verifiedFactors.length ? <>
            <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-[12px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><CheckCircle2 size={20}/></span><div><h2 className="text-[16px] font-semibold">{ru ? 'TOTP-факторы настроены' : 'TOTP factors enrolled'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? `${verifiedFactors.length} подтверждённых фактор(а). Рекомендуется отдельное резервное устройство.` : `${verifiedFactors.length} verified factor(s). A separate backup device is recommended.`}</p></div></div>
            <div className="mt-5 space-y-2">{verifiedFactors.map((factor, index) => <div key={factor.id} className="flex items-center gap-3 rounded-[11px] border border-[var(--fp-border)] bg-[#fbfcfa] p-3"><span className="grid size-9 place-items-center rounded-[9px] bg-white text-[var(--fp-green)]"><KeyRound size={15}/></span><div className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{factor.friendly_name || `FlowPay Authenticator ${index + 1}`}</strong><span className="text-[11px] text-[var(--fp-subtle)]">{ru ? 'TOTP · подтверждён' : 'TOTP · verified'}</span></div><button type="button" disabled={busy || currentLevel !== 'aal2'} onClick={() => removeFactor(factor)} className="grid size-9 place-items-center rounded-[9px] border border-[var(--fp-border)] bg-white text-[var(--fp-red)] disabled:opacity-40" aria-label={ru ? 'Удалить фактор' : 'Remove factor'}><Trash2 size={14}/></button></div>)}</div>
            {currentLevel !== 'aal2' ? <div className="mt-5 rounded-[12px] border border-[#eadab9] bg-[var(--fp-amber-soft)] p-4"><strong className="text-[13px]">{ru ? 'Нужно подтвердить текущую сессию' : 'Current session needs step-up'}</strong><p className="mt-1 text-[12px] leading-5 text-[var(--fp-muted)]">{ru ? 'Факторы существуют, но эта сессия пока AAL1.' : 'Factors exist, but this session is still AAL1.'}</p><Button className="mt-3" onClick={() => router.push(`/mfa?next=${encodeURIComponent(nextPath)}`)}><LockKeyhole size={14}/>{ru ? 'Подтвердить 2FA' : 'Verify 2FA'}</Button></div>
              : <><div className="mt-5 rounded-[12px] border border-[#cde1d1] bg-[#f7fbf7] p-4 text-[13px] text-[var(--fp-green-strong)]"><ShieldCheck size={16}/><strong className="mt-2 block">{ru ? 'Защищённая сессия активна' : 'Protected session active'}</strong><p className="mt-1 text-[12px] leading-5 text-[var(--fp-muted)]">{ru ? 'База данных проверяет AAL2 и владельца строки перед доступом.' : 'Database policies verify AAL2 and row ownership before access.'}</p></div>{verifiedFactors.length < 3 && <Button variant="secondary" className="mt-4" onClick={beginEnrollment} disabled={busy}><Plus size={14}/>{ru ? 'Добавить резервный TOTP' : 'Add backup TOTP'}</Button>}</>}
          </>
          : <><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-[12px] bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]"><KeyRound size={20}/></span><div><h2 className="text-[16px] font-semibold">{ru ? '2FA ещё не настроена' : '2FA is not configured yet'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? 'До настройки второго фактора финансовые таблицы, API-ключи и операции изменения закрыты политиками базы данных.' : 'Until a second factor is configured, financial tables, API keys and mutation operations are blocked by database policies.'}</p></div></div><Button className="mt-5" onClick={beginEnrollment} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin"/>}{ru ? 'Настроить TOTP' : 'Set up TOTP'}</Button></>}
      </Card>

      <Card className="p-5 sm:p-6"><h2 className="text-[15px] font-semibold">{ru ? 'Что именно защищает AAL2' : 'What AAL2 protects'}</h2><ul className="mt-4 space-y-3 text-[13px] leading-5 text-[var(--fp-muted)]"><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Чтение платежей, контрагентов, счетов, аналитики и журналов.' : 'Reading payments, counterparties, invoices, analytics and logs.'}</li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Создание и изменение финансовых данных через защищённые RPC.' : 'Creating and changing financial data through protected RPCs.'}</li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Создание, просмотр метаданных и отзыв API-ключей.' : 'Creating, reading metadata and revoking API keys.'}</li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Админские операции и удаление аккаунта.' : 'Admin operations and account deletion.'}</li></ul><div className="mt-5 border-t border-[var(--fp-border)] pt-4"><p className="text-[12px] leading-5 text-[var(--fp-subtle)]">{ru ? 'Для восстановления лучше подключить второй TOTP-фактор на отдельном защищённом устройстве. FlowPay не показывает одноразовые коды восстановления.' : 'For recovery, enroll a second TOTP factor on a separate protected device. FlowPay does not display one-time recovery codes.'}</p></div></Card>
    </div>
  </div>
}
