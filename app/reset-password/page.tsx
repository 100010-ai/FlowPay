'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageContext'

export default function ResetPasswordPage() {
  const { lang } = useLanguage()
  const ru = lang === 'ru'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 12 || password.length > 128) {
      setError(ru ? 'Используйте от 12 до 128 символов.' : 'Use 12 to 128 characters.')
      return
    }
    if (password !== confirm) {
      setError(ru ? 'Пароли не совпадают.' : 'Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const client = createClient()
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError
      // Password recovery is a credential-rotation event: invalidate every
      // existing session so a stolen refresh token cannot survive the reset.
      const { error: signOutError } = await client.auth.signOut({ scope: 'global' })
      if (signOutError) throw signOutError
      setDone(true)
    } catch {
      setError(ru ? 'Не удалось завершить безопасную смену пароля. Запросите новую ссылку восстановления.' : 'Could not complete the secure password reset. Request a new recovery link.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#fafaf7] p-5"><section className="w-full max-w-[460px] rounded-[22px] border border-[var(--fp-border)] bg-white p-6 shadow-[0_24px_80px_rgba(31,52,38,.08)] sm:p-8"><FlowPayLogo/>{done ? <div className="py-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><CheckCircle2 size={22}/></span><h1 className="mt-5 text-[26px] font-semibold tracking-[-.04em]">{ru ? 'Пароль обновлён' : 'Password updated'}</h1><p className="mt-2 text-[14px] leading-6 text-[var(--fp-muted)]">{ru ? 'Все активные сессии завершены. Войдите заново с новым паролем и подтвердите 2FA.' : 'All active sessions were signed out. Sign in again with the new password and complete 2FA.'}</p><Link href="/login"><Button className="mt-6 w-full">{ru ? 'Войти' : 'Sign in'}</Button></Link></div> : <><h1 className="mt-8 text-[30px] font-semibold tracking-[-.05em]">{ru ? 'Новый пароль' : 'Choose a new password'}</h1><p className="mt-2 text-[14px] leading-5 text-[var(--fp-muted)]">{ru ? 'Укажите новый пароль для аккаунта FlowPay. После смены все текущие сессии будут завершены.' : 'Set a new FlowPay password. All current sessions will be signed out after the change.'}</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{ru ? 'Новый пароль' : 'New password'}</span><Input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required/></label><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{ru ? 'Повторите пароль' : 'Confirm password'}</span><Input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} required/></label>{error && <div className="rounded-[11px] bg-[var(--fp-red-soft)] p-3 text-[14px] text-[var(--fp-red)]">{error}</div>}<Button className="w-full" disabled={loading}>{loading && <Loader2 size={15} className="animate-spin"/>}{ru ? 'Обновить пароль' : 'Update password'}</Button></form></>}</section></main>
}
