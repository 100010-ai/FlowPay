'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageContext'
import type { Language } from '@/lib/types'

const copy:Record<Language,any>={
  ru:{title:'С возвращением',sub:'Войдите в рабочее пространство FlowPay и продолжите управлять платежами.',email:'Рабочий email',password:'Пароль',button:'Войти в FlowPay',forgot:'Забыли пароль?',no:'Нет аккаунта?',create:'Создать аккаунт',back:'На главную',invalid:'Неверный email или пароль.',unconfirmed:'Подтвердите email по ссылке из письма и попробуйте снова.',rate:'Слишком много попыток. Подождите несколько минут.',generic:'Не удалось войти. Попробуйте ещё раз.',reset:'Если такой аккаунт существует, ссылка для восстановления отправлена на почту.',needEmail:'Сначала укажите рабочий email.',safe:'Защищённый вход',sideTitle:'Финансовые операции без лишней ручной работы.',sideSub:'FlowPay собирает платежи, контрагентов, маршруты и аналитику в одном рабочем пространстве.',points:['Изолированные данные рабочего пространства','Маршруты и комиссии без вымышленных значений','API, отчётность и история действий'],small:'FlowPay не запрашивает пароль от интернет-банка.'},
  en:{title:'Welcome back',sub:'Sign in to your FlowPay workspace and continue managing payment operations.',email:'Work email',password:'Password',button:'Sign in to FlowPay',forgot:'Forgot password?',no:'New to FlowPay?',create:'Create account',back:'Back home',invalid:'Incorrect email or password.',unconfirmed:'Confirm your email using the link we sent, then try again.',rate:'Too many attempts. Wait a few minutes.',generic:'We could not sign you in. Try again.',reset:'If an account exists, a recovery link has been sent.',needEmail:'Enter your work email first.',safe:'Secure sign-in',sideTitle:'Financial operations without unnecessary manual work.',sideSub:'FlowPay brings payments, counterparties, routing and analytics into one workspace.',points:['Isolated workspace data','Routes and fees without invented values','API, reporting and activity history'],small:'FlowPay never asks for your online-banking password.'},
  fr:{title:'Bon retour',sub:'Connectez-vous à votre espace FlowPay.',email:'Email professionnel',password:'Mot de passe',button:'Se connecter',forgot:'Mot de passe oublié ?',no:'Nouveau sur FlowPay ?',create:'Créer un compte',back:'Accueil',invalid:'Email ou mot de passe incorrect.',unconfirmed:'Confirmez votre email puis réessayez.',rate:'Trop de tentatives.',generic:'Connexion impossible. Réessayez.',reset:'Si le compte existe, un lien de récupération a été envoyé.',needEmail:'Saisissez d’abord votre email.',safe:'Connexion sécurisée',sideTitle:'Les opérations financières sans travail manuel inutile.',sideSub:'FlowPay regroupe paiements, bénéficiaires, routes et analyses.',points:['Données de workspace isolées','Routes et frais transparents','API, rapports et historique'],small:'FlowPay ne demande jamais votre mot de passe bancaire.'},
  de:{title:'Willkommen zurück',sub:'Melden Sie sich in Ihrem FlowPay-Arbeitsbereich an.',email:'Geschäftliche E-Mail',password:'Passwort',button:'Bei FlowPay anmelden',forgot:'Passwort vergessen?',no:'Neu bei FlowPay?',create:'Konto erstellen',back:'Startseite',invalid:'E-Mail oder Passwort falsch.',unconfirmed:'Bestätigen Sie Ihre E-Mail.',rate:'Zu viele Versuche.',generic:'Anmeldung fehlgeschlagen.',reset:'Falls das Konto existiert, wurde ein Wiederherstellungslink gesendet.',needEmail:'Geben Sie zuerst Ihre E-Mail ein.',safe:'Sichere Anmeldung',sideTitle:'Finanzabläufe ohne unnötige Handarbeit.',sideSub:'FlowPay bündelt Zahlungen, Partner, Routen und Analysen.',points:['Isolierte Workspace-Daten','Transparente Routen und Gebühren','API, Reports und Verlauf'],small:'FlowPay fragt nie nach Ihrem Online-Banking-Passwort.'},
  es:{title:'Bienvenido de nuevo',sub:'Entra en tu espacio de trabajo FlowPay.',email:'Email de trabajo',password:'Contraseña',button:'Entrar en FlowPay',forgot:'¿Olvidaste la contraseña?',no:'¿Nuevo en FlowPay?',create:'Crear cuenta',back:'Inicio',invalid:'Email o contraseña incorrectos.',unconfirmed:'Confirma tu email y vuelve a intentarlo.',rate:'Demasiados intentos.',generic:'No se pudo iniciar sesión.',reset:'Si la cuenta existe, se ha enviado un enlace de recuperación.',needEmail:'Introduce primero tu email.',safe:'Acceso seguro',sideTitle:'Operaciones financieras sin trabajo manual innecesario.',sideSub:'FlowPay reúne pagos, contrapartes, rutas y analítica.',points:['Datos de workspace aislados','Rutas y comisiones transparentes','API, informes e historial'],small:'FlowPay nunca solicita tu contraseña bancaria.'}
}

function messageFor(error:unknown,c:any){
  const raw=(typeof error==='object'&&error&&'message'in error?String((error as any).message):String(error||'')).toLowerCase()
  if(raw.includes('rate limit'))return c.rate
  if(raw.includes('email not confirmed'))return c.unconfirmed
  if(raw.includes('invalid login'))return c.invalid
  return c.generic
}

export function AuthPage(){
  const {lang}=useLanguage();const c=useMemo(()=>copy[lang],[lang]);const router=useRouter()
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);const [loading,setLoading]=useState(false);const [message,setMessage]=useState<{kind:'error'|'success';text:string}|null>(null)

  async function resetPassword(){
    if(!email.trim()){setMessage({kind:'error',text:c.needEmail});return}
    setLoading(true);setMessage(null)
    try{const {error}=await createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`});if(error)throw error;setMessage({kind:'success',text:c.reset})}
    catch(error){setMessage({kind:'error',text:messageFor(error,c)})}
    finally{setLoading(false)}
  }

  async function submit(event:FormEvent){
    event.preventDefault();if(loading)return
    setMessage(null);setLoading(true)
    try{
      const supabase=createClient();const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error
      if(!data.user)throw new Error('UNAUTHORIZED')
      const {data:onboarding,error:onboardingError}=await supabase.rpc('flowpay_onboarding_status');if(onboardingError)throw onboardingError
      const target=onboarding?'/dashboard':'/onboarding'
      if(target==='/onboarding'){router.replace(target);router.refresh();return}
      const {data:aal,error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aalError)throw aalError
      if(aal.currentLevel==='aal2')router.replace(target)
      else if(aal.nextLevel==='aal2')router.replace(`/mfa?next=${encodeURIComponent(target)}`)
      else router.replace(`/settings/security?required=1&next=${encodeURIComponent(target)}`)
      router.refresh()
    }catch(error){setMessage({kind:'error',text:messageFor(error,c)})}finally{setLoading(false)}
  }

  return <main className="min-h-screen bg-[#f7f8f5] p-3 sm:p-5">
    <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1320px] overflow-hidden rounded-[22px] border border-[#e1e6e0] bg-white shadow-[0_28px_90px_rgba(26,48,33,.08)] sm:min-h-[calc(100vh-40px)] lg:grid-cols-[.92fr_1.08fr]">
      <section className="flex min-h-[720px] flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between"><Link href="/"><FlowPayLogo/></Link><Link href="/" className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-medium text-[var(--fp-muted)] transition hover:bg-[#f4f6f2] hover:text-[var(--fp-text)]"><ArrowLeft size={13}/>{c.back}</Link></div>
        <div className="my-auto w-full max-w-[440px] py-12 lg:py-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce7de] bg-[#f5f9f5] px-3 py-1.5 text-[11px] font-semibold text-[var(--fp-green-strong)]"><ShieldCheck size={13}/>{c.safe}</div>
          <h1 className="text-[40px] font-semibold leading-[1.02] tracking-[-.06em] sm:text-[48px]">{c.title}</h1>
          <p className="mt-4 max-w-[390px] text-[14px] leading-6 text-[var(--fp-muted)]">{c.sub}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block space-y-2 text-[13px] font-medium text-[#59645d]"><span>{c.email}</span><Input autoFocus type="email" autoComplete="email" maxLength={320} value={email} onChange={e=>setEmail(e.target.value)} required className="h-[50px]"/></label>
            <label className="block space-y-2 text-[13px] font-medium text-[#59645d]"><div className="flex items-center justify-between"><span>{c.password}</span><button type="button" onClick={resetPassword} disabled={loading} className="text-[12px] font-semibold text-[var(--fp-green)] hover:underline disabled:opacity-50">{c.forgot}</button></div><div className="relative"><Input type={show?'text':'password'} autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required className="h-[50px] pr-12"/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--fp-subtle)] hover:text-[var(--fp-text)]" aria-label={show?'Hide password':'Show password'}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
            {message&&<div className={`rounded-[11px] border px-3.5 py-3 text-[13px] leading-5 ${message.kind==='success'?'border-[#cfe3d4] bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]':'border-[#f0cfd2] bg-[var(--fp-red-soft)] text-[var(--fp-red)]'}`}>{message.text}</div>}
            <Button size="lg" className="h-[50px] w-full" disabled={loading||!email.trim()||!password}>{loading?<Loader2 size={16} className="animate-spin"/>:<LockKeyhole size={16}/>} {c.button}</Button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-[13px]"><span className="text-[var(--fp-muted)]">{c.no}</span><Link href="/register" className="inline-flex items-center gap-1 font-semibold text-[var(--fp-green)] hover:underline">{c.create}<ArrowRight size={13}/></Link></div>
          <div className="mt-8 flex items-start gap-2.5 rounded-[12px] border border-[var(--fp-border)] bg-[#fafbf8] p-3.5"><KeyRound size={15} className="mt-0.5 shrink-0 text-[var(--fp-green)]"/><p className="text-[11px] leading-5 text-[var(--fp-muted)]">{c.small}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--fp-subtle)]"><Link href="/privacy" className="hover:text-[var(--fp-text)]">Privacy</Link><Link href="/terms" className="hover:text-[var(--fp-text)]">Terms</Link><Link href="/security" className="hover:text-[var(--fp-text)]">Security</Link><span>© 2026 FlowPay</span></div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-[#e1e8e2] bg-[#edf4ef] lg:flex lg:min-h-[720px] lg:flex-col lg:justify-center lg:p-14 xl:p-20">
        <div className="absolute inset-0 opacity-[.32]" style={{backgroundImage:'radial-gradient(#9fb6a5 1px, transparent 1px)',backgroundSize:'24px 24px'}}/>
        <div className="absolute -right-24 -top-24 size-[360px] rounded-full bg-white/45 blur-3xl"/>
        <div className="relative max-w-[520px]">
          <span className="grid size-11 place-items-center rounded-[13px] border border-white/80 bg-white text-[var(--fp-green)] shadow-sm"><Sparkles size={19}/></span>
          <h2 className="mt-8 text-[42px] font-semibold leading-[1.04] tracking-[-.055em] xl:text-[50px]">{c.sideTitle}</h2>
          <p className="mt-5 max-w-[470px] text-[14px] leading-6 text-[#637168]">{c.sideSub}</p>
          <div className="mt-8 space-y-3">{c.points.map((point:string,index:number)=><div key={point} className="flex items-center gap-3 rounded-[13px] border border-white/90 bg-white/72 px-4 py-3.5 shadow-[0_8px_24px_rgba(40,70,50,.035)]"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e7f3e9] text-[var(--fp-green)]"><CheckCircle2 size={14}/></span><span className="text-[13px] font-medium">{point}</span><span className="ml-auto text-[11px] font-semibold text-[#9aa89f]">0{index+1}</span></div>)}</div>
        </div>
      </aside>
    </div>
  </main>
}
