'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, CheckCircle2, Globe2, LocateFixed, Loader2, WalletCards } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { useLanguage } from '@/components/LanguageContext'
import { countryName, countryOptions, currencyOptions, defaultCurrencyForCountry } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'

const copy={
  ru:{eyebrow:'Настройка аккаунта',title:'Подготовим FlowPay к работе',sub:'Три базовых параметра нужны для корректных валют, отчётности и платёжных направлений.',company:'Название компании',companyPh:'ООО / компания',country:'Страна компании',currency:'Базовая валюта',hint:'Её можно изменить позже в настройках.',button:'Продолжить в FlowPay',saving:'Сохраняем…',error:'Не удалось сохранить настройки. Попробуйте ещё раз.',steps:['Компания','Регион','Отчётность'],safe:'Настройки применяются только к вашему аккаунту.',detecting:'Определяем регион…',detected:'Регион определён автоматически',detectedSub:'FlowPay использовал регион подключения только для начальной настройки. Проверьте данные перед продолжением.',manual:'Страну не удалось определить автоматически. Выберите её вручную.',timezone:'Часовой пояс'},
  en:{eyebrow:'Account setup',title:'Set up FlowPay for your business',sub:'Three details let us configure reporting, currencies and relevant payment corridors.',company:'Company name',companyPh:'Your company',country:'Company country',currency:'Reporting currency',hint:'You can change this later in Settings.',button:'Continue to FlowPay',saving:'Saving…',error:'We could not save your settings. Please try again.',steps:['Company','Region','Reporting'],safe:'These settings apply only to your account.',detecting:'Detecting region…',detected:'Region detected automatically',detectedSub:'FlowPay used the connection region only for initial setup. Review it before continuing.',manual:'We could not detect your country automatically. Choose it manually.',timezone:'Time zone'},
  fr:{eyebrow:'Configuration',title:'Configurez FlowPay pour votre entreprise',sub:'Trois informations suffisent pour préparer les devises, rapports et corridors.',company:'Nom de l’entreprise',companyPh:'Votre entreprise',country:'Pays',currency:'Devise de reporting',hint:'Modifiable plus tard dans les paramètres.',button:'Continuer vers FlowPay',saving:'Enregistrement…',error:'Impossible d’enregistrer. Réessayez.',steps:['Entreprise','Région','Reporting'],safe:'Ces paramètres ne concernent que votre compte.',detecting:'Détection de la région…',detected:'Région détectée automatiquement',detectedSub:'FlowPay a utilisé la région de connexion uniquement pour la configuration initiale. Vérifiez les données.',manual:'Impossible de détecter automatiquement le pays. Sélectionnez-le manuellement.',timezone:'Fuseau horaire'},
  de:{eyebrow:'Einrichtung',title:'FlowPay für Ihr Unternehmen einrichten',sub:'Drei Angaben konfigurieren Reporting, Währungen und relevante Zahlungswege.',company:'Unternehmensname',companyPh:'Ihr Unternehmen',country:'Land',currency:'Berichtswährung',hint:'Später in den Einstellungen änderbar.',button:'Weiter zu FlowPay',saving:'Speichern…',error:'Einstellungen konnten nicht gespeichert werden.',steps:['Unternehmen','Region','Reporting'],safe:'Diese Einstellungen gelten nur für Ihr Konto.',detecting:'Region wird erkannt…',detected:'Region automatisch erkannt',detectedSub:'FlowPay hat die Verbindungsregion nur für die Ersteinrichtung verwendet. Bitte prüfen Sie die Angaben.',manual:'Das Land konnte nicht automatisch erkannt werden. Bitte manuell auswählen.',timezone:'Zeitzone'},
  es:{eyebrow:'Configuración',title:'Configura FlowPay para tu empresa',sub:'Tres datos bastan para preparar divisas, informes y rutas de pago.',company:'Nombre de empresa',companyPh:'Tu empresa',country:'País',currency:'Moneda de informes',hint:'Podrás cambiarla después en Ajustes.',button:'Continuar a FlowPay',saving:'Guardando…',error:'No se pudo guardar la configuración.',steps:['Empresa','Región','Informes'],safe:'Estos ajustes solo se aplican a tu cuenta.',detecting:'Detectando región…',detected:'Región detectada automáticamente',detectedSub:'FlowPay usó la región de conexión solo para la configuración inicial. Revisa los datos antes de continuar.',manual:'No pudimos detectar el país automáticamente. Selecciónalo manualmente.',timezone:'Zona horaria'},
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
  const [error,setError]=useState('')

  const countries=useMemo(()=>countryOptions(lang).map(([code,label])=>({value:code,label,description:code,leading:<CountryFlag code={code}/>})),[lang])
  const currencies=useMemo(()=>currencyOptions(lang).map(item=>({value:item.code,label:item.code,description:item.name,leading:<span className="grid size-6 place-items-center rounded-[7px] bg-[#eef4ef] text-[12px] font-semibold text-[var(--fp-green-strong)]">{item.symbol}</span>})),[lang])

  useEffect(()=>{
    let cancelled=false
    const browserTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone||''
    setTimezone(browserTimezone)
    fetch('/api/geo',{cache:'no-store'})
      .then(async response=>response.ok?await response.json() as GeoResponse:null)
      .then(geo=>{
        if(cancelled)return
        if(geo?.timezone)setTimezone(geo.timezone)
        if(geo?.detected&&geo.country){
          setGeoState('detected')
          if(!countryTouched.current)setCountry(geo.country)
          if(!currencyTouched.current){
            const mapped=geo.currency||defaultCurrencyForCountry(geo.country)
            if(mapped)setCurrency(mapped)
          }
        }else setGeoState('manual')
      })
      .catch(()=>{if(!cancelled)setGeoState('manual')})
    return()=>{cancelled=true}
  },[])

  function chooseCountry(value:string){
    countryTouched.current=true
    setCountry(value)
    if(!currencyTouched.current){const mapped=defaultCurrencyForCountry(value);if(mapped)setCurrency(mapped)}
  }

  function chooseCurrency(value:string){currencyTouched.current=true;setCurrency(value)}

  async function submit(){
    if(name.trim().length<2||!country||!currency)return
    setSaving(true);setError('')
    try{
      const client=createClient()
      const {data}=await client.auth.getSession()
      const token=data.session?.access_token
      if(!token){router.replace('/login');return}
      const response=await fetch('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({name:name.trim(),country,currency,timezone})})
      if(!response.ok)throw new Error('SAVE_FAILED')
      router.replace('/settings/security?required=1&next=%2Fdashboard');router.refresh()
    }catch{setError(c.error)}finally{setSaving(false)}
  }

  const detectedCountry=country?countryName(country,lang):''
  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-[1060px]"><FlowPayLogo/><div className="mt-8 grid overflow-hidden rounded-[24px] border border-[var(--fp-border)] bg-white shadow-[0_30px_90px_rgba(31,52,38,.08)] lg:grid-cols-[.78fr_1.22fr]"><aside className="border-b border-[var(--fp-border)] bg-[#eef4ef] p-7 sm:p-9 lg:border-b-0 lg:border-r"><span className="text-[12px] font-semibold uppercase tracking-[.13em] text-[var(--fp-green)]">{c.eyebrow}</span><h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-[-.055em] sm:text-[42px]">{c.title}</h1><p className="mt-5 max-w-md text-[15px] leading-6 text-[var(--fp-muted)]">{c.sub}</p><div className="mt-9 space-y-3">{c.steps.map((step,i)=><div key={step} className="flex items-center gap-3 rounded-[13px] border border-white/80 bg-white/70 p-3.5"><span className="grid size-8 place-items-center rounded-[9px] bg-white text-[var(--fp-green)] shadow-sm">{i===0?<Building2 size={16}/>:i===1?<Globe2 size={16}/>:<WalletCards size={16}/>}</span><strong className="text-[14px]">{step}</strong><CheckCircle2 size={15} className="ml-auto text-[#9bbca4]"/></div>)}</div></aside><section className="p-6 sm:p-9 lg:p-12"><div className="mx-auto max-w-[540px]"><h2 className="text-[23px] font-semibold tracking-[-.035em]">{c.eyebrow}</h2>

    <div className="mt-5 rounded-[13px] border border-[#dce8de] bg-[#f5f9f5] p-4">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-[var(--fp-green)] shadow-sm">{geoState==='loading'?<Loader2 size={16} className="animate-spin"/>:<LocateFixed size={16}/>}</span><div className="min-w-0"><strong className="block text-[14px]">{geoState==='loading'?c.detecting:geoState==='detected'?c.detected:c.manual}</strong>{geoState==='detected'&&<p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{detectedCountry}{currency?` · ${currency}`:''}{timezone?` · ${timezone}`:''}</p>}<p className="mt-1 text-[12px] leading-5 text-[var(--fp-subtle)]">{geoState==='detected'?c.detectedSub:geoState==='manual'?'':c.safe}</p></div></div>
    </div>

    <div className="mt-6 space-y-5"><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.company}</span><Input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder={c.companyPh}/></label><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.country}</span><SearchSelect value={country} onChange={chooseCountry} options={countries}/></label><label className="block space-y-2 text-[14px] font-medium text-[var(--fp-muted)]"><span>{c.currency}</span><SearchSelect value={currency} onChange={chooseCurrency} options={currencies} variant="currency"/><small className="block text-[13px] font-normal text-[var(--fp-subtle)]">{c.hint}</small></label>{timezone&&<div className="flex items-center justify-between rounded-[11px] border border-[var(--fp-border)] bg-[#fafbf8] px-3.5 py-3 text-[13px]"><span className="text-[var(--fp-muted)]">{c.timezone}</span><strong className="font-medium">{timezone}</strong></div>}</div>{error&&<div className="mt-5 rounded-[12px] bg-[var(--fp-red-soft)] p-3 text-[14px] text-[var(--fp-red)]">{error}</div>}<Button size="lg" className="mt-7 w-full" disabled={saving||name.trim().length<2||!country||!currency} onClick={submit}>{saving?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>} {saving?c.saving:c.button}</Button><p className="mt-4 text-center text-[12px] text-[var(--fp-subtle)]">{c.safe}</p></div></section></div></div></main>
}
