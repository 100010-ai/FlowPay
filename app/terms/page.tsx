import { LegalPage } from '@/components/LegalPage'
const title={ru:'Условия использования',en:'Terms of Service'}
const updated={ru:'Обновлено 16 августа 2026',en:'Updated 16 August 2026'}
const sections={
 ru:[
  {title:'Назначение FlowPay',body:['FlowPay предоставляет инструменты для организации международных платёжных операций, хранения рабочих данных, управления контрагентами и сравнения доступных вариантов оплаты. Если отдельно не согласовано иное, FlowPay не является банком и не хранит средства клиентов.']},
  {title:'Расчёты и доступные варианты',body:['Комиссии, сроки, валютные референсы и расчёты в интерфейсе носят информационный характер до подтверждения соответствующим платёжным провайдером. Перед исполнением платежа пользователь должен проверить реквизиты получателя и окончательные условия.']},
  {title:'Аккаунт и безопасность',body:['Пользователь отвечает за сохранность данных для входа, действия внутри своего аккаунта и достоверность внесённой информации. При подозрении на несанкционированный доступ необходимо сменить пароль и связаться с FlowPay.']},
  {title:'Допустимое использование',body:['FlowPay нельзя использовать для незаконных операций, мошенничества, обхода санкционных или иных обязательных ограничений, вмешательства в работу сервиса либо злоупотребления API. Мы можем ограничить доступ при выявлении угрозы безопасности или нарушения этих условий.']},
  {title:'Доступность сервиса',body:['Мы развиваем FlowPay и можем изменять функции, интерфейс и технические ограничения. Плановые работы и внешние сбои платёжной или интернет-инфраструктуры могут временно влиять на доступность отдельных функций.']},
 ],
 en:[
  {title:'What FlowPay provides',body:['FlowPay provides tools to organise international payment operations, store operational records, manage counterparties and compare available payment options. Unless separately agreed, FlowPay is not a bank and does not custody customer funds.']},
  {title:'Estimates and available options',body:['Fees, timings, FX references and calculations shown in the interface are informational until confirmed by the relevant payment provider. Users must verify beneficiary details and final terms before executing a payment.']},
  {title:'Account and security',body:['Users are responsible for protecting sign-in credentials, actions performed through their account and the accuracy of submitted information. If unauthorised access is suspected, the password should be changed and FlowPay contacted promptly.']},
  {title:'Acceptable use',body:['FlowPay must not be used for unlawful transactions, fraud, sanctions or regulatory evasion, interference with the service, or API abuse. Access may be restricted where a security threat or violation of these terms is identified.']},
  {title:'Service availability',body:['FlowPay is continuously developed and features, interfaces and technical limits may change. Scheduled maintenance and failures in external payment or internet infrastructure can temporarily affect individual features.']},
 ]
}
export default function Terms(){return <LegalPage title={title} updated={updated} sections={sections}/>} 
