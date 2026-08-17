'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, CheckCircle2, Globe2, LocateFixed, Loader2, RotateCcw, WalletCards } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { useLanguage } from '@/components/LanguageContext'
import { countryName, countryOptions, currencyOptions, defaultCurrencyForCountry } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'
import { ClientTimeoutError, fetchWithClientTimeout, withClientTimeout } from '@/lib/client-timeout'

const copy={
  ru:{checking:'Проверяем состояние аккаунта…',legacy:'Аккаунт уже настроен. Перенаправляем в FlowPay…',legal:'Для аккаунта требуется повторно подтвердить юридические документы. Выйдите из аккаунта и начните регистрацию заново.',eyebrow:'Настройка аккаунта',title:'Подготовим FlowPay к работе',sub:'Три базовых параметра нужны для корректных валют, отчётности и платёжных направлений.',company:'Название компании',companyPh:'ООО / компания',country:'Страна компании',currency:'Базовая валюта',hint:'Её можно изменить позже в настройках.',button:'Продолжить в FlowPay',saving:'Сохраняем…',error:'Не удалось сохранить настройки. Попробуйте ещё раз.',timeout:'FlowPay слишком долго ждёт ответ сервера. Проверьте соединение и повторите попытку.',statusError:'Не удалось проверить состояние аккаунта.',retry:'Повторить',steps:['Компания','Регион','Отчётность'],safe:'Настройки применяются только к вашему аккаунту.',detecting:'Определяем регион…',detected:'Регион определён автоматически',detectedSub:'FlowPay использовал регион подключения только для начальной настройки. Проверьте данные перед продолжением.',manual:'Страну не удалось определить автоматически. Выберите её вручную.',timezone:'Часовой пояс'},
  en:{checking:'Checking account status…',legacy:'Your account is already configured. Redirecting to FlowPay…',legal:'This account must accept the current legal documents before setup can continue.',eyebrow:'Account setup',title:'Set up FlowPay for your business',sub:'Three details let us configure reporting, currencies and relevant payment corridors.',company:'Company name',companyPh:'Your company',country:'Company country',currency:'Reporting currency',hint:'You can change this later in Settings.',button:'Continue to FlowPay',saving:'Saving…',error:'We could not save your settings. Please try again.',timeout:'FlowPay is taking too long to respond. Check your connection and try again.',statusError:'Could not check account status.',retry:'Try again',steps:['Company','Region','Reporting'],safe:'These settings apply only to your account.',detecting:'Detecting region…',detected:'Region detected automatically',detectedSub:'FlowPay used the connection region only for initial setup. Review it before continuing.',manual:'We could not detect your country automatically. Choose it manually.',timezone:'Time zone'},
  fr:{checking:'Vérification du compte…',legacy:'Votre compte est déjà configuré. Redirection vers FlowPay…',legal:'Ce compte doit accepter les documents juridiques actuels avant de continuer.',eyebrow:'Configuration',title:'Configurez FlowPay pour votre entreprise',sub:'Trois informations suffisent pour préparer les devises, rapports et corridors.',company:'Nom de l’entreprise',companyPh:'Votre entreprise',country:'Pays',currency:'Devise de reporting',hint:'Modifiable plus tard dans les paramètres.',button:'Continuer vers FlowPay',saving:'Enregistrement…',error:'Impossible d’enregistrer. Réessayez.',timeout:'FlowPay met trop de temps à répondre. Vérifiez la connexion et réessayez.',statusError:'Impossible de vérifier le compte.',retry:'Réessayer',steps:['Entreprise','Région','Reporting'],safe:'Ces paramètres ne concernent que votre compte.',detecting:'Détection de la région…',detected:'Région détectée automatiquement',detectedSub:'FlowPay a utilisé la région de connexion uniquement pour la configuration initiale. Vérifiez les données.',manual:'Impossible de détecter automatiquement le pays. Sélectionnez-le manuellement.',timezone:'Fuseau horaire'},
  de:{checking:'Kontostatus wird geprüft…',legacy:'Ihr Konto ist bereits eingerichtet. Weiterleitung zu FlowPay…',legal:'Dieses Konto muss die aktuellen rechtlichen Dokumente akzeptieren, bevor die Einrichtung fortgesetzt werden kann.',eyebrow:'Einrichtung',title:'FlowPay für Ihr Unternehmen einrichten',sub:'Drei Angaben konfigurieren Reporting, Währungen und relevante Zahlungswege.',company:'Unternehmensname',companyPh:'Ihr Unternehmen',country:'Land',currency:'Berichtswährung',hint:'Später in den Einstellungen änderbar.',button:'Weiter zu FlowPay',saving:'Speichern…',error:'Einstellungen konnten nicht gespeichert werden.',timeout:'FlowPay wartet zu lange auf eine Antwort. Verbindung prüfen und erneut versuchen.',statusError:'Kontostatus konnte nicht geprüft werden.',retry:'Erneut versuchen',steps:['Unternehmen','Region','Reporting'],safe:'Diese Einstellungen gelten nur für Ihr Konto.',detecting:'Region wird erkannt…',detected:'Region automatisch erkannt',detectedSub:'FlowPay hat die Verbindungsregion nur für die Ersteinrichtung verwendet. Bitte prüfen Sie die Angaben.',manual:'Das Land konnte nicht automatisch erkannt werden. Bitte manuell auswählen.',timezone:'Zeitzone'},
  es:{checking:'Comprobando el estado de la cuenta…',legacy:'Tu cuenta ya está configurada. Redirigiendo a FlowPay…',legal:'Esta cuenta debe aceptar los documentos legales actuales antes de continuar.',eyebrow:'Configuración',title:'Configura FlowPay para tu empresa',sub:'Tres datos bastan para preparar divisas, informes y rutas de pago.',company:'Nombre de empresa',companyPh:'Tu empresa',country:'País',currency:'Moneda de informes',hint:'Podrás cambiarla después en Ajustes.',button:'Continuar a FlowPay',saving:'Guardando…',error:'No se pudo guardar la configuración.',timeout:'FlowPay está tardando demasiado en responder. Comprueba la conexión e inténtalo de nuevo.',statusError:'No se pudo comprobar el estado de la cuenta.',retry:'Reintentar',steps:['Empresa','Región','Informes'],safe:'Estos ajustes solo se aplican a tu cuenta.',detecting:'Detectando región…',detected:'Región detectada automáticamente',detectedSub:'FlowPay usó la región de conexión solo para la configuración inicial. Revisa los datos antes de continuar.',manual:'No pudimos detectar el país automáticamente. Selecciónalo manualmente.',timezone:'Zona horaria'},
} as const

type GeoResponse={country:string|null;currency:string|null;timezone:string|null;detected:boolean}

export default function OnboardingPage(){
  const {lang}=useLanguage()
  const c=copy[lang]
  const router=useRouter()
  const [name,setName]=useState('')
  const [country,setCountry]=useState('')
  const [currency,setCurrency]=useState('')
  const [timezone,setTimezone]=useState('')
  const countryTouched=useRef(false)
  const currencyTouched=useRef(false)
  const [geoState,setGeoState]=useState<'loading'|'detected'|'manual'>('loading')
  const [saving,setSaving]=useState(false)
  const [checkingAccount,setCheckingAccount]=useState(true)
  const [checkError,setCheckError]=useState('')
  const [error,setError]=useState('')

  const countries=useMemo(()=>countryOptions(lang).map(([code,label])=>({value:code,label,description:code,leading:<CountryFlag code={code}/>})),[lang])
  const currencies=useMemo(()=>currencyOptions(lang).map(item=>({value:item.code,label:item.code,description:item.name,leading:<span className="grid size-6 place-items-center rounded-[7px] bg-[#eef4ef] text-[12px] font-semibold text-[var(--fp-green-strong)]">{item.symbol}</span>})),[lang])

  const checkAccount=useCallback(async()=>{
    setCheckingAccount(true)
    setCheckError('')
    let redirecting=false
    try{
      const client=createClient()
      const {data}=await withClientTimeout(client.auth.getSession(),8_000,'SESSION_TIMEOUT')
      const token=data.session?.access_token
      if(!token){redirecting=true;router.replace('/login');return}
      const response=await fetchWithClientTimeout('/api/onboarding/status',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'},8_000)
      if(!response.ok){throw new Error('STATUS_FAILED')}
      const status=await response.json() as {completed:boolean}
      if(!status.completed)return
      const {data:aal,error:aalError}=await withClientTimeout(client.auth.mfa.getAuthenticatorAssuranceLevel(),8_000,'MFA_STATUS_TIMEOUT')
      redirecting=true
      if(aalError||!aal)router.replace('/settings/security?required=1&next=%2Fdashboard')
      else if(aal.currentLevel==='aal2')router.replace('/dashboard')
      else if(aal.nextLevel==='aal2')router.replace('/mfa?next=%2Fdashboard')
      else router.replace('/settings/security?required=1&next=%2Fdashboard')
    }catch(err){
      setCheckError(err instanceof ClientTimeoutError?c.timeout:c.statusError)
    }finally{
      if(!redirecting)setCheckingAccount(false)
    }
  },[c.statusError,c.timeout,router])

  useEffect(()=>{void checkAccount()},[checkAccount])

  useEffect(()=>{
    let cancelled=false
    const browserTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone||''
    setTimezone(browserTimezone)
    fetchWithClientTimeout('/api/geo',{cache:'no-store'},7_000)
      .then(async response=>response.ok?await response.json() as GeoResponse:null)
      .then(geo=>{
        if(cancelled)return
        if(geo?.timezone)setTimezone(geo.timezone)
        if(geo?.detected&&geo.country){
          setGeoState('detected')
          if(!countryTouched.current)setCountry(geo.country)
          if(!currencyTouched.current){const mapped=geo.currency||defaultCurrencyForCountry(geo.country);if(mapped)setCurrency(mapped)}
        }else setGeoState('manual')
      })
      .catch(()=>{if(!cancelled)setGeoState('manual')})
    return()=>{cancelled=true}
  },[])

  function chooseCountry(value:string){countryTouched.current=true;setCountry(value);if(!currencyTouched.current){const mapped=defaultCurrencyForCountry(value);if(mapped)setCurrency(mapped)}}
  function chooseCurrency(value:string){currencyTouched.current=true;setCurrency(value)}

  async function submit(){
    if(saving||name.trim().length<2||!country||!currency)return
    setSaving(true);setError('')
    try{
      const client=createClient()
      const {data}=await withClientTimeout(client.auth.getSession(),8_000,'SESSION_TIMEOUT')
      const token=data.session?.access_token
      if(!token){router.replace('/login');return}
      const response=await fetchWithClientTimeout('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({name:name.trim(),country,currency,timezone})},12_000)
      const payload=await response.json().catch(()=>({})) as {error?:string;alreadyCompleted?:boolean}
      if(!response.ok){if(payload.error==='LEGAL_ACCEPTANCE_REQUIRED'){setError(c.legal);return}throw new Error('SAVE_FAILED')}
      router.replace('/settings/security?required=1&next=%2Fdashboard');router.refresh()
    }catch(err){
      setError(err instanceof ClientTimeoutError?c.timeout:c.error)
    }finally{setSaving(false)}
  }

  const detectedCountry=country?countryName(country,lang):''
  if(checkingAccount)return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] px-5"><div className="w-full max-w-[440px] rounded-[20px] border border-[var(--fp-border)] bg-white p-7 text-center shadow-[0_24px_70px_rgba(31,52,38,.07)]"><div className="flex justify-center"><FlowPayLogo/></div><div className="mt-7 inline-flex items-center gap-2 text-[13px] text-[var(--fp-muted)]"><Loader2 size={15} className="animate-spin"/>{c.checking}</div><p className="mt-3 text-[11px] leading-5 text-[var(--fp-subtle)]">{c.safe}</p></div></main>

  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-5 sm:px-6 sm:py-8 lg:py-10"><div className="mx-auto max-w-[1120px]"><FlowPayLogo/>
    {checkError&&<div className="mt-6 flex flex-col gap-3 rounded-[14px] border border-[#eadab9] bg-[#fffaf0] px-4 py-3.5 text-[13px] text-[#825f20] sm:flex-row sm:items-center sm:justify-between"><span>{checkError}</span><Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={()=>void checkAccount()}><RotateCcw size={14}/>{c.retry}</Button></div>}
    <div className="mt-7 grid overflow-hidden rounded-[24px] border border-[var(--fp-border)] bg-white shadow-[0_30px_90px_rgba(31,52,38,.08)] lg:min-h-[720px] lg:grid-cols-[420px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-[var(--fp-border)] bg-[#eef4ef] p-7 sm:p-9 lg:border-b-0 lg:border-r lg:p-10"><div><span className="text-[12px] font-semibold uppercase tracking-[.13em] text-[var(--fp-green)]">{c.eyebrow}</span><h1 className="mt-4 max-w-[320px] text-[36px] font-semibold leading-[1.04] tracking-[-.055em] sm:text-[42px]">{c.title}</h1><p className="mt-5 max-w-[320px] text-[15px] leading-6 text-[var(--fp-muted)]">{c.sub}</p></div><div className="mt-9 space-y-3">{c.steps.map((step,i)=><div key={step} className="flex h-[64px] items-center gap-3 rounded-[13px] border border-white/90 bg-white/75 px-3.5 shadow-[0_1px_2px_rgba(31,52,38,.02)]"><span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-white text-[var(--fp-green)] shadow-sm">{i===0?<Building2 size={16}/>:i===1?<Globe2 size={16}/>:<WalletCards size={16}/>}</span><strong className="text-[14px]">{step}</strong><CheckCircle2 size={15} className="ml-auto shrink-0 text-[#9bbca4]"/></div>)}</div><div className="mt-auto hidden pt-8 text-[12px] leading-5 text-[var(--fp-subtle)] lg:block">{c.safe}</div></aside>
      <section className="flex items-start p-6 sm:p-9 lg:p-10 xl:p-12"><div className="mx-auto w-full max-w-[560px]"><h2 className="text-[24px] font-semibold tracking-[-.035em]">{c.eyebrow}</h2>
        <div className="mt-5 min-h-[118px] rounded-[14px] border border-[#dce8de] bg-[#f5f9f5] p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white text-[var(--fp-green)] shadow-sm">{geoState==='loading'?<Loader2 size={16} className="animate-spin"/>:<LocateFixed size={16}/>}</span><div className="min-w-0 pt-0.5"><strong className="block text-[14px]">{geoState==='loading'?c.detecting:geoState==='detected'?c.detected:c.manual}</strong>{geoState==='detected'&&<p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{detectedCountry}{currency?` · ${currency}`:''}{timezone?` · ${timezone}`:''}</p>}<p className="mt-1 text-[12px] leading-5 text-[var(--fp-subtle)]">{geoState==='detected'?c.detectedSub:geoState==='manual'?'':c.safe}</p></div></div></div>
        <div className="mt-6 space-y-5"><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.company}</span><Input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder={c.companyPh} className="h-[48px]"/></label><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.country}</span><SearchSelect value={country} onChange={chooseCountry} options={countries}/></label><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.currency}</span><SearchSelect value={currency} onChange={chooseCurrency} options={currencies} variant="currency"/><small className="block text-[13px] font-normal text-[var(--fp-subtle)]">{c.hint}</small></label>{timezone&&<div className="flex min-h-[48px] items-center justify-between gap-4 rounded-[11px] border border-[var(--fp-border)] bg-[#fafbf8] px-3.5 py-3 text-[13px]"><span className="text-[var(--fp-muted)]">{c.timezone}</span><strong className="truncate font-medium">{timezone}</strong></div>}</div>
        {error&&<div className="mt-5 flex items-start justify-between gap-3 rounded-[12px] border border-[#f0cfd2] bg-[var(--fp-red-soft)] p-3.5 text-[13px] leading-5 text-[var(--fp-red)]"><span>{error}</span><button type="button" onClick={()=>setError('')} className="shrink-0 font-semibold underline underline-offset-2">OK</button></div>}
        <Button size="lg" className="mt-7 h-[50px] w-full" disabled={saving||name.trim().length<2||!country||!currency} onClick={submit}>{saving?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>} {saving?c.saving:c.button}</Button><p className="mt-4 text-center text-[12px] text-[var(--fp-subtle)]">{c.safe}</p>
      </div></section>
    </div></div></main>
}
