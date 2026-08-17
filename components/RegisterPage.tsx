'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, FileCheck2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { LEGAL_VERSIONS, legalDocument } from '@/lib/legal'
import type { Language } from '@/lib/types'

type Step='privacy'|'terms'|'account'|'done'
const copy:Record<Language,any>={
  ru:{back:'На главную',title:'Создать аккаунт FlowPay',sub:'Перед регистрацией ознакомьтесь с документами. После этого потребуется только рабочий email и пароль.',privacy:'Политика конфиденциальности',terms:'Условия использования',account:'Аккаунт',readBottom:'Прокрутите документ до конца, чтобы продолжить.',readDone:'Документ прочитан до конца',ackPrivacy:'Я прочитал(а) и понимаю Политику конфиденциальности.',acceptTerms:'Я прочитал(а) и принимаю Условия использования.',continue:'Продолжить',email:'Рабочий email',password:'Пароль',confirm:'Повторите пароль',create:'Создать аккаунт',have:'Уже есть аккаунт?',signin:'Войти',short:'Пароль должен содержать минимум 8 символов.',mismatch:'Пароли не совпадают.',exists:'Аккаунт с таким email уже существует.',generic:'Не удалось создать аккаунт. Попробуйте снова.',created:'Аккаунт создан',createdSub:'Проверьте почту и подтвердите email, если FlowPay отправил письмо. После подтверждения можно войти и завершить настройку компании.',toLogin:'Перейти ко входу',legalNote:'FlowPay сохранит версии документов и серверное время принятия в защищённом журнале.'},
  en:{back:'Back home',title:'Create your FlowPay account',sub:'Review the legal documents before registration. Then you only need a work email and password.',privacy:'Privacy Policy',terms:'Terms of Service',account:'Account',readBottom:'Scroll to the end of the document to continue.',readDone:'Document read to the end',ackPrivacy:'I have read and understand the Privacy Policy.',acceptTerms:'I have read and accept the Terms of Service.',continue:'Continue',email:'Work email',password:'Password',confirm:'Confirm password',create:'Create account',have:'Already have an account?',signin:'Sign in',short:'Password must contain at least 8 characters.',mismatch:'Passwords do not match.',exists:'An account with this email already exists.',generic:'We could not create the account. Try again.',created:'Account created',createdSub:'Check your inbox and confirm your email if FlowPay sent a verification message. Then sign in to finish company setup.',toLogin:'Go to sign in',legalNote:'FlowPay records document versions and server-side acceptance time in a protected ledger.'},
  fr:{back:'Accueil',title:'Créer votre compte FlowPay',sub:'Consultez les documents juridiques avant de créer le compte.',privacy:'Politique de confidentialité',terms:'Conditions d’utilisation',account:'Compte',readBottom:'Faites défiler le document jusqu’en bas.',readDone:'Document lu jusqu’à la fin',ackPrivacy:'J’ai lu et compris la politique de confidentialité.',acceptTerms:'J’ai lu et j’accepte les conditions d’utilisation.',continue:'Continuer',email:'Email professionnel',password:'Mot de passe',confirm:'Confirmer',create:'Créer le compte',have:'Déjà un compte ?',signin:'Connexion',short:'Au moins 8 caractères sont requis.',mismatch:'Les mots de passe ne correspondent pas.',exists:'Ce compte existe déjà.',generic:'Impossible de créer le compte.',created:'Compte créé',createdSub:'Consultez votre boîte mail pour confirmer votre adresse, puis connectez-vous.',toLogin:'Se connecter',legalNote:'FlowPay enregistre les versions des documents et l’heure d’acceptation.'},
  de:{back:'Startseite',title:'FlowPay-Konto erstellen',sub:'Lesen Sie vor der Registrierung die rechtlichen Dokumente.',privacy:'Datenschutzrichtlinie',terms:'Nutzungsbedingungen',account:'Konto',readBottom:'Scrollen Sie bis zum Ende des Dokuments.',readDone:'Dokument vollständig gelesen',ackPrivacy:'Ich habe die Datenschutzrichtlinie gelesen und verstanden.',acceptTerms:'Ich habe die Nutzungsbedingungen gelesen und akzeptiere sie.',continue:'Weiter',email:'Geschäftliche E-Mail',password:'Passwort',confirm:'Passwort bestätigen',create:'Konto erstellen',have:'Bereits ein Konto?',signin:'Anmelden',short:'Mindestens 8 Zeichen erforderlich.',mismatch:'Passwörter stimmen nicht überein.',exists:'Dieses Konto existiert bereits.',generic:'Konto konnte nicht erstellt werden.',created:'Konto erstellt',createdSub:'Prüfen Sie Ihre E-Mail und bestätigen Sie die Adresse, dann melden Sie sich an.',toLogin:'Zur Anmeldung',legalNote:'FlowPay speichert Dokumentversionen und serverseitige Annahmezeitpunkte in einem geschützten Register.'},
  es:{back:'Inicio',title:'Crear tu cuenta FlowPay',sub:'Lee los documentos legales antes del registro.',privacy:'Política de privacidad',terms:'Condiciones de uso',account:'Cuenta',readBottom:'Desplázate hasta el final del documento.',readDone:'Documento leído hasta el final',ackPrivacy:'He leído y comprendo la Política de privacidad.',acceptTerms:'He leído y acepto las Condiciones de uso.',continue:'Continuar',email:'Email de trabajo',password:'Contraseña',confirm:'Confirmar contraseña',create:'Crear cuenta',have:'¿Ya tienes cuenta?',signin:'Entrar',short:'Se requieren al menos 8 caracteres.',mismatch:'Las contraseñas no coinciden.',exists:'Esta cuenta ya existe.',generic:'No se pudo crear la cuenta.',created:'Cuenta creada',createdSub:'Revisa tu correo, confirma la dirección si es necesario y después inicia sesión.',toLogin:'Ir a iniciar sesión',legalNote:'FlowPay registra las versiones y la hora de aceptación del servidor en un registro protegido.'}
}

export function RegisterPage(){
  const {lang}=useLanguage();const c=useMemo(()=>copy[lang],[lang]);const router=useRouter()
  const [step,setStep]=useState<Step>('privacy');const [privacyRead,setPrivacyRead]=useState(false);const [termsRead,setTermsRead]=useState(false);const [privacyAck,setPrivacyAck]=useState(false);const [termsAccepted,setTermsAccepted]=useState(false)
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [show,setShow]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState('')
  const privacy=legalDocument('privacy',lang);const terms=legalDocument('terms',lang)
  const doc=step==='privacy'?privacy:terms
  const scrollRef=useRef<HTMLDivElement>(null)

  function handleScroll(){const el=scrollRef.current;if(!el)return;const atEnd=el.scrollTop+el.clientHeight>=el.scrollHeight-20;if(atEnd){if(step==='privacy')setPrivacyRead(true);if(step==='terms')setTermsRead(true)}}
  function nextPrivacy(){if(!privacyRead||!privacyAck)return;setStep('terms');requestAnimationFrame(()=>scrollRef.current?.scrollTo({top:0}))}
  function nextTerms(){if(!termsRead||!termsAccepted)return;setStep('account')}

  async function submit(event:FormEvent){
    event.preventDefault();if(loading||!privacyAck||!termsAccepted)return
    setError('');if(password.length<8){setError(c.short);return}if(password!==confirm){setError(c.mismatch);return}
    setLoading(true)
    try{
      const {data,error}=await createClient().auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${window.location.origin}/login`,data:{privacy_version:LEGAL_VERSIONS.privacy,terms_version:LEGAL_VERSIONS.terms,privacy_acknowledged:true,terms_accepted:true,legal_locale:lang}}})
      if(error)throw error
      if(data.session){router.replace('/onboarding');router.refresh();return}
      setStep('done')
    }catch(e){const raw=e instanceof Error?e.message.toLowerCase():'';setError(raw.includes('already')||raw.includes('exists')?c.exists:c.generic)}finally{setLoading(false)}
  }

  const steps=[{key:'privacy',label:c.privacy},{key:'terms',label:c.terms},{key:'account',label:c.account}]
  return <main className="min-h-screen bg-[#f7f8f5] p-3 sm:p-5">
    <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1180px] overflow-hidden rounded-[22px] border border-[#e1e6e0] bg-white shadow-[0_28px_90px_rgba(26,48,33,.08)] sm:min-h-[calc(100vh-40px)]">
      <header className="flex h-[72px] items-center border-b border-[var(--fp-border)] px-5 sm:px-8"><Link href="/"><FlowPayLogo/></Link><Link href="/" className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-medium text-[var(--fp-muted)] hover:bg-[#f4f6f2]"><ArrowLeft size={13}/>{c.back}</Link></header>
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--fp-border)] bg-[#f8faf7] p-6 lg:min-h-[calc(100vh-114px)] lg:border-b-0 lg:border-r lg:p-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--fp-green-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fp-green-strong)]"><ShieldCheck size={13}/>FlowPay onboarding</span>
          <h1 className="mt-5 text-[28px] font-semibold leading-[1.08] tracking-[-.045em]">{c.title}</h1><p className="mt-3 text-[13px] leading-5 text-[var(--fp-muted)]">{c.sub}</p>
          <div className="mt-7 space-y-2">{steps.map((item,index)=>{const active=item.key===step;const completed=item.key==='privacy'?privacyAck:item.key==='terms'?termsAccepted:step==='done';return <div key={item.key} className={`flex items-center gap-3 rounded-[11px] border px-3 py-3 ${active?'border-[#b9d2bf] bg-white shadow-sm':'border-transparent'}`}><span className={`grid size-7 place-items-center rounded-full text-[11px] font-bold ${completed?'bg-[var(--fp-green)] text-white':active?'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]':'bg-[#ecefec] text-[var(--fp-subtle)]'}`}>{completed?<Check size={13}/>:index+1}</span><span className={`text-[12px] font-semibold ${active?'text-[var(--fp-text)]':'text-[var(--fp-muted)]'}`}>{item.label}</span></div>})}</div>
          <p className="mt-7 text-[11px] leading-5 text-[var(--fp-subtle)]">{c.legalNote}</p>
        </aside>

        <section className="min-w-0 p-5 sm:p-8 lg:p-10">
          {(step==='privacy'||step==='terms')&&<div className="mx-auto max-w-[760px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--fp-green)]">{step==='privacy'?'Step 1':'Step 2'} / 3</span><h2 className="mt-2 text-[30px] font-semibold tracking-[-.045em]">{doc.shortTitle}</h2><p className="mt-2 text-[12px] text-[var(--fp-muted)]">{doc.updated}</p></div><Link target="_blank" href={step==='privacy'?'/privacy':'/terms'} className="text-[12px] font-semibold text-[var(--fp-green)] hover:underline">{lang==='ru'?'Открыть отдельной страницей ↗':'Open full page ↗'}</Link></div>
            <div ref={scrollRef} onScroll={handleScroll} className="fp-scrollbar mt-5 max-h-[55vh] min-h-[420px] overflow-y-auto rounded-[16px] border border-[var(--fp-border)] bg-[#fbfcfa] p-5 sm:p-6">
              <p className="text-[13px] leading-6 text-[var(--fp-muted)]">{doc.intro}</p>
              <div className="mt-6 space-y-6">{doc.sections.map(section=><section key={section.id}><h3 className="text-[15px] font-semibold">{section.title}</h3><div className="mt-2 space-y-2 text-[12px] leading-6 text-[var(--fp-muted)]">{section.paragraphs.map((p,i)=><p key={i}>{p}</p>)}{section.bullets&&<ul className="space-y-1.5 pl-5">{section.bullets.map(b=><li className="list-disc" key={b}>{b}</li>)}</ul>}</div></section>)}</div>
              <div className="mt-7 rounded-[12px] border border-[#cae0cf] bg-[var(--fp-green-soft)] p-4 text-[12px] font-medium text-[var(--fp-green-strong)]"><CheckCircle2 size={15} className="mb-2"/>{lang==='ru'?'Вы дошли до конца документа. Теперь можно подтвердить ознакомление.':'You reached the end of the document. You can now confirm.'}</div>
            </div>
            <div className="mt-4 rounded-[14px] border border-[var(--fp-border)] bg-white p-4"><label className={`flex items-start gap-3 ${step==='privacy'&&!privacyRead||step==='terms'&&!termsRead?'opacity-50':''}`}><input type="checkbox" className="mt-1 size-4 accent-[#187a45]" disabled={step==='privacy'?!privacyRead:!termsRead} checked={step==='privacy'?privacyAck:termsAccepted} onChange={e=>step==='privacy'?setPrivacyAck(e.target.checked):setTermsAccepted(e.target.checked)}/><span><strong className="block text-[13px]">{step==='privacy'?c.ackPrivacy:c.acceptTerms}</strong><small className="mt-1 block text-[11px] leading-5 text-[var(--fp-muted)]">{(step==='privacy'?privacyRead:termsRead)?c.readDone:c.readBottom}</small></span></label></div>
            <div className="mt-5 flex justify-between gap-3">{step==='terms'?<Button variant="secondary" onClick={()=>setStep('privacy')}><ArrowLeft size={14}/>{c.privacy}</Button>:<span/>}<Button onClick={step==='privacy'?nextPrivacy:nextTerms} disabled={step==='privacy'?(!privacyRead||!privacyAck):(!termsRead||!termsAccepted)}>{c.continue}<ArrowRight size={14}/></Button></div>
          </div>}

          {step==='account'&&<div className="mx-auto max-w-[480px] py-6 sm:py-10"><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--fp-green)]">Step 3 / 3</span><h2 className="mt-2 text-[34px] font-semibold tracking-[-.05em]">{c.account}</h2><p className="mt-3 text-[13px] leading-6 text-[var(--fp-muted)]">{lang==='ru'?'Юридические документы подтверждены. Теперь создайте данные для входа.':'Legal review is complete. Create your sign-in credentials.'}</p>
            <form onSubmit={submit} className="mt-7 space-y-4"><label className="block space-y-2 text-[13px] font-medium text-[var(--fp-muted)]"><span>{c.email}</span><Input autoFocus required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="h-[50px]"/></label><label className="block space-y-2 text-[13px] font-medium text-[var(--fp-muted)]"><span>{c.password}</span><div className="relative"><Input required type={show?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="h-[50px] pr-12"/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--fp-subtle)]">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><label className="block space-y-2 text-[13px] font-medium text-[var(--fp-muted)]"><span>{c.confirm}</span><Input required type={show?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="h-[50px]"/></label>
            {error&&<div className="rounded-[11px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-3 text-[13px] text-[var(--fp-red)]">{error}</div>}
            <div className="grid gap-2 rounded-[12px] border border-[#dce8de] bg-[#f7faf7] p-3 text-[11px] text-[var(--fp-muted)]"><span className="flex items-center gap-2"><Check size={13} className="text-[var(--fp-green)]"/>{c.privacy} · {LEGAL_VERSIONS.privacy}</span><span className="flex items-center gap-2"><Check size={13} className="text-[var(--fp-green)]"/>{c.terms} · {LEGAL_VERSIONS.terms}</span></div>
            <Button size="lg" className="h-[50px] w-full" disabled={loading||!email.trim()||!password||!confirm}>{loading?<Loader2 size={16} className="animate-spin"/>:<LockKeyhole size={16}/>} {c.create}</Button></form>
            <div className="mt-6 flex items-center gap-2 text-[12px]"><span className="text-[var(--fp-muted)]">{c.have}</span><Link href="/login" className="font-semibold text-[var(--fp-green)] hover:underline">{c.signin}</Link></div>
          </div>}

          {step==='done'&&<div className="mx-auto grid max-w-[560px] place-items-center py-24 text-center"><span className="grid size-14 place-items-center rounded-[16px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><FileCheck2 size={25}/></span><h2 className="mt-5 text-[34px] font-semibold tracking-[-.05em]">{c.created}</h2><p className="mt-3 max-w-[450px] text-[13px] leading-6 text-[var(--fp-muted)]">{c.createdSub}</p><Link href="/login" className="mt-7"><Button>{c.toLogin}<ArrowRight size={14}/></Button></Link></div>}
        </section>
      </div>
    </div>
  </main>
}
