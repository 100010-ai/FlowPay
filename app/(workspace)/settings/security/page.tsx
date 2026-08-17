'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clipboard, KeyRound, Loader2, LockKeyhole, Plus, RefreshCw, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { safeInternalPath } from '@/lib/client-security'
import { ClientTimeoutError, withClientTimeout } from '@/lib/client-timeout'
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
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [error, setError] = useState('')
  const [nextPath, setNextPath] = useState('/dashboard')

  const timeoutMessage = ru
    ? 'FlowPay слишком долго ждёт ответ 2FA-сервиса. Проверьте соединение и нажмите «Повторить».'
    : 'FlowPay is taking too long to reach the 2FA service. Check your connection and try again.'

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true)
    setError('')
    try {
      const client = createClient()
      const { data: user, error: userError } = await withClientTimeout(client.auth.getUser(), 8_000, 'MFA_USER_TIMEOUT')
      if (userError) throw userError
      if (!user.user) {
        window.location.replace('/login')
        return
      }
      const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] = await Promise.all([
        withClientTimeout(client.auth.mfa.getAuthenticatorAssuranceLevel(), 8_000, 'MFA_AAL_TIMEOUT'),
        withClientTimeout(client.auth.mfa.listFactors(), 8_000, 'MFA_FACTORS_TIMEOUT'),
      ])
      if (aalError) throw aalError
      if (factorsError) throw factorsError
      setCurrentLevel(aal.currentLevel)
      setVerifiedFactors((factors.totp || []).filter(item => item.status === 'verified').map(item => ({ id: item.id, friendly_name: item.friendly_name })))
    } catch (err) {
      setError(err instanceof ClientTimeoutError ? timeoutMessage : (ru ? 'Не удалось загрузить настройки 2FA.' : 'Could not load 2FA settings.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setNextPath(safeInternalPath(new URLSearchParams(window.location.search).get('next')))
    void load()
    // load is intentionally run once for the current page session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function beginEnrollment() {
    if (busy || verifiedFactors.length >= 3) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const client = createClient()
      const { data, error: enrollError } = await withClientTimeout(client.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'FlowPay',
        friendlyName: verifiedFactors.length === 0 ? 'FlowPay · Primary' : `FlowPay · Backup ${verifiedFactors.length + 1}`,
      }), 10_000, 'MFA_ENROLL_TIMEOUT')
      if (enrollError) throw enrollError
      if (!data.totp) throw new Error('TOTP_REQUIRED')
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
      setCode('')
    } catch (err) {
      setError(err instanceof ClientTimeoutError ? timeoutMessage : (ru ? 'Не удалось начать настройку TOTP. Повторите попытку.' : 'Could not start TOTP enrollment. Try again.'))
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
      const { error: removeError } = await withClientTimeout(client.auth.mfa.unenroll({ factorId: enroll.factorId }), 8_000, 'MFA_CANCEL_TIMEOUT')
      if (removeError) throw removeError
      setEnroll(null)
      setCode('')
    } catch (err) {
      setError(err instanceof ClientTimeoutError ? timeoutMessage : (ru ? 'Не удалось отменить незавершённую настройку.' : 'Could not cancel the unfinished enrollment.'))
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
      const { data: challenge, error: challengeError } = await withClientTimeout(client.auth.mfa.challenge({ factorId: enroll.factorId }), 8_000, 'MFA_CHALLENGE_TIMEOUT')
      if (challengeError) throw challengeError
      const { error: verifyError } = await withClientTimeout(client.auth.mfa.verify({ factorId: enroll.factorId, challengeId: challenge.id, code }), 10_000, 'MFA_VERIFY_TIMEOUT')
      if (verifyError) throw verifyError
      setEnroll(null)
      setCode('')
      setMessage(ru ? 'TOTP-фактор подтверждён. Сессия защищена AAL2.' : 'TOTP factor verified. The session is protected with AAL2.')
      await load(false)
      if (new URLSearchParams(window.location.search).get('required') === '1') {
        window.location.replace(nextPath)
      }
    } catch (err) {
      setError(err instanceof ClientTimeoutError ? timeoutMessage : (ru ? 'Код не подтверждён. Проверьте код и время на устройстве, затем попробуйте снова.' : 'The code could not be verified. Check the code and device time, then try again.'))
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
      const { error: removeError } = await withClientTimeout(client.auth.mfa.unenroll({ factorId: factor.id }), 10_000, 'MFA_REMOVE_TIMEOUT')
      if (removeError) throw removeError
      const { error: refreshError } = await withClientTimeout(client.auth.refreshSession(), 10_000, 'MFA_REFRESH_TIMEOUT')
      if (refreshError) throw refreshError
      await withClientTimeout(client.auth.signOut({ scope: 'global' }), 10_000, 'MFA_SIGNOUT_TIMEOUT')
      window.location.replace('/login?security=mfa-removed')
    } catch (err) {
      setError(err instanceof ClientTimeoutError ? timeoutMessage : (ru ? 'Не удалось удалить фактор.' : 'Could not remove the factor.'))
    } finally {
      setBusy(false)
    }
  }

  return <div className="fp-enter mx-auto w-full max-w-[1180px]">
    <button onClick={() => router.push('/settings')} className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--fp-muted)] hover:text-[var(--fp-text)]"><ArrowLeft size={14}/>{ru ? 'Настройки' : 'Settings'}</button>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><span className="text-[11px] font-semibold uppercase tracking-[.13em] text-[var(--fp-green)]">Security Center</span><h1 className="mt-2 text-[32px] font-semibold tracking-[-.05em] sm:text-[36px]">{ru ? 'Двухфакторная защита' : 'Two-factor protection'}</h1><p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[var(--fp-muted)]">{ru ? 'AAL2 защищает финансовые данные и критические действия. Подключите основной и, при необходимости, резервный TOTP-фактор.' : 'AAL2 protects financial data and critical actions. Enroll a primary and, if needed, backup TOTP factor.'}</p></div>
      <Badge tone={currentLevel === 'aal2' ? 'success' : 'warning'} className="w-fit">{currentLevel === 'aal2' ? <ShieldCheck size={13}/> : <ShieldAlert size={13}/>}AAL: {currentLevel || '0'}</Badge>
    </div>

    {error && <div className="mt-5 flex flex-col gap-3 rounded-[12px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-3.5 text-[13px] text-[var(--fp-red)] sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14}/>{ru ? 'Повторить' : 'Retry'}</Button></div>}
    {message && <div className="mt-5 rounded-[12px] border border-[#cde1d1] bg-[var(--fp-green-soft)] p-3.5 text-[13px] text-[var(--fp-green-strong)]">{message}</div>}

    <div className="mt-5 grid items-stretch gap-4 xl:grid-cols-2">
      <Card className="min-h-[430px] p-5 sm:p-6">
        {loading ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><span className="grid size-11 place-items-center rounded-[12px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><Loader2 className="animate-spin" size={19}/></span><strong className="mt-4 text-[14px]">{ru ? 'Проверяем защиту' : 'Checking security'}</strong><p className="mt-1 max-w-[300px] text-[12px] leading-5 text-[var(--fp-muted)]">{ru ? 'Обычно это занимает меньше нескольких секунд.' : 'This normally takes only a few seconds.'}</p></div>
          : enroll ? <form onSubmit={verifyEnrollment}>
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[#eef4ef] text-[var(--fp-green)]"><Smartphone size={20}/></span><div><h2 className="text-[16px] font-semibold">{ru ? 'Подключите приложение-аутентификатор' : 'Connect an authenticator app'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? 'Отсканируйте QR-код. Если камера недоступна, используйте секрет для ручного ввода.' : 'Scan the QR code. If the camera is unavailable, use the manual setup secret.'}</p><p className="mt-1 text-[11px] font-medium text-[var(--fp-green)]">{ru?'В Google Authenticator запись появится как FlowPay.':'The entry will appear as FlowPay in Google Authenticator.'}</p></div></div>
            <div className="mt-6 grid items-start gap-5 sm:grid-cols-[184px_minmax(0,1fr)]"><div className="grid place-items-center rounded-[14px] border border-[var(--fp-border)] bg-white p-2.5"><img src={enroll.qr} alt="TOTP QR code" className="size-[164px]"/></div><div className="min-w-0"><span className="text-[12px] font-semibold text-[var(--fp-muted)]">{ru ? 'Секрет для ручного ввода' : 'Manual setup secret'}</span><div className="mt-2 flex min-h-[44px] items-center gap-2 rounded-[10px] bg-[#f6f8f5] p-3"><code className="min-w-0 flex-1 break-all text-[12px] leading-5">{enroll.secret}</code><button type="button" onClick={async () => { await navigator.clipboard.writeText(enroll.secret); setCopiedSecret(true); window.setTimeout(() => setCopiedSecret(false), 1400) }} className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-[var(--fp-border)] bg-white text-[var(--fp-green)]" aria-label={ru ? 'Скопировать секрет' : 'Copy secret'}><Clipboard size={14}/></button></div>{copiedSecret&&<p className="mt-1.5 text-[11px] font-medium text-[var(--fp-green)]">{ru?'Секрет скопирован':'Secret copied'}</p>}<label className="mt-4 block space-y-2 text-[13px] font-medium text-[var(--fp-muted)]"><span>{ru ? 'Шестизначный код' : 'Six-digit code'}</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-[46px] font-mono text-[16px] tracking-[.22em]"/></label><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><Button className="w-full" disabled={busy || code.length !== 6}>{busy && <Loader2 size={14} className="animate-spin"/>}{ru ? 'Подтвердить TOTP' : 'Verify TOTP'}</Button><Button type="button" variant="secondary" onClick={cancelEnrollment} disabled={busy}>{ru ? 'Отмена' : 'Cancel'}</Button></div></div></div>
          </form>
          : verifiedFactors.length ? <>
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><CheckCircle2 size={20}/></span><div><h2 className="text-[16px] font-semibold">{ru ? 'TOTP-факторы настроены' : 'TOTP factors enrolled'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? `${verifiedFactors.length} подтверждённых фактор(а). Рекомендуется отдельное резервное устройство.` : `${verifiedFactors.length} verified factor(s). A separate backup device is recommended.`}</p></div></div>
            <div className="mt-5 space-y-2">{verifiedFactors.map((factor, index) => <div key={factor.id} className="flex min-h-[62px] items-center gap-3 rounded-[11px] border border-[var(--fp-border)] bg-[#fbfcfa] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-white text-[var(--fp-green)]"><KeyRound size={15}/></span><div className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{factor.friendly_name || `FlowPay Authenticator ${index + 1}`}</strong><span className="text-[11px] text-[var(--fp-subtle)]">{ru ? 'TOTP · подтверждён' : 'TOTP · verified'}</span></div><button type="button" disabled={busy || currentLevel !== 'aal2'} onClick={() => removeFactor(factor)} className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-[var(--fp-border)] bg-white text-[var(--fp-red)] disabled:opacity-40" aria-label={ru ? 'Удалить фактор' : 'Remove factor'}><Trash2 size={14}/></button></div>)}</div>
            {currentLevel !== 'aal2' ? <div className="mt-5 rounded-[12px] border border-[#eadab9] bg-[var(--fp-amber-soft)] p-4"><strong className="text-[13px]">{ru ? 'Нужно подтвердить текущую сессию' : 'Current session needs step-up'}</strong><p className="mt-1 text-[12px] leading-5 text-[var(--fp-muted)]">{ru ? 'Факторы существуют, но эта сессия пока AAL1.' : 'Factors exist, but this session is still AAL1.'}</p><Button className="mt-3" onClick={() => router.push(`/mfa?next=${encodeURIComponent(nextPath)}`)}><LockKeyhole size={14}/>{ru ? 'Подтвердить 2FA' : 'Verify 2FA'}</Button></div>
              : <><div className="mt-5 rounded-[12px] border border-[#cde1d1] bg-[#f7fbf7] p-4 text-[13px] text-[var(--fp-green-strong)]"><ShieldCheck size={16}/><strong className="mt-2 block">{ru ? 'Защищённая сессия активна' : 'Protected session active'}</strong><p className="mt-1 text-[12px] leading-5 text-[var(--fp-muted)]">{ru ? 'База данных проверяет AAL2 и владельца строки перед доступом.' : 'Database policies verify AAL2 and row ownership before access.'}</p></div>{verifiedFactors.length < 3 && <Button variant="secondary" className="mt-4" onClick={beginEnrollment} disabled={busy}><Plus size={14}/>{ru ? 'Добавить резервный TOTP' : 'Add backup TOTP'}</Button>}</>}
          </>
          : <div className="flex min-h-[360px] flex-col justify-center"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]"><KeyRound size={20}/></span><div><h2 className="text-[16px] font-semibold">{ru ? '2FA ещё не настроена' : '2FA is not configured yet'}</h2><p className="mt-1 max-w-[520px] text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? 'До настройки второго фактора финансовые таблицы, API-ключи и операции изменения закрыты политиками базы данных.' : 'Until a second factor is configured, financial tables, API keys and mutation operations are blocked by database policies.'}</p></div></div><Button className="mt-5 w-fit" onClick={beginEnrollment} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin"/>}{ru ? 'Настроить TOTP' : 'Set up TOTP'}</Button></div>}
      </Card>

      <Card className="min-h-[430px] p-5 sm:p-6"><div className="flex h-full flex-col"><div><span className="grid size-11 place-items-center rounded-[12px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><ShieldCheck size={20}/></span><h2 className="mt-4 text-[16px] font-semibold">{ru ? 'Что именно защищает AAL2' : 'What AAL2 protects'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru ? 'Второй фактор проверяется не только интерфейсом, но и сервером и политиками базы данных.' : 'The second factor is enforced by the server and database policies, not only by the interface.'}</p></div><ul className="mt-5 space-y-3 text-[13px] leading-5 text-[var(--fp-muted)]"><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Чтение платежей, контрагентов, счетов, аналитики и журналов.' : 'Reading payments, counterparties, invoices, analytics and logs.'}</li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Создание и изменение финансовых данных через защищённые RPC.' : 'Creating and changing financial data through protected RPCs.'}</li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Создание, просмотр метаданных и отзыв API-ключей.' : 'Creating, reading metadata and revoking API keys.'}</li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/>{ru ? 'Админские операции и удаление аккаунта.' : 'Admin operations and account deletion.'}</li></ul><div className="mt-auto border-t border-[var(--fp-border)] pt-5"><p className="text-[12px] leading-5 text-[var(--fp-subtle)]">{ru ? 'Для восстановления подключите второй TOTP-фактор на отдельном защищённом устройстве. FlowPay не показывает одноразовые recovery-коды.' : 'For recovery, enroll a second TOTP factor on a separate protected device. FlowPay does not display one-time recovery codes.'}</p></div></div></Card>
    </div>
  </div>
}
