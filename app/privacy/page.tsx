import { LegalPage } from '@/components/LegalPage'
const title={ru:'Политика конфиденциальности',en:'Privacy Policy'}
const updated={ru:'Обновлено 16 августа 2026',en:'Updated 16 August 2026'}
const sections={
 ru:[
  {title:'Какие данные обрабатывает FlowPay',body:['Мы обрабатываем данные аккаунта и компании, сведения о контрагентах, счетах, подготовленных платежах и действиях в сервисе. Также могут обрабатываться технические данные, необходимые для безопасности, диагностики и предотвращения злоупотреблений.','FlowPay не запрашивает пароль от вашего интернет-банка. Платёжные реквизиты используются только для функций, которые вы запускаете в сервисе.']},
  {title:'Для чего используются данные',body:['Данные нужны для входа в аккаунт, сохранения операций, расчёта доступных вариантов оплаты, подготовки аналитики и отчётов, поддержки пользователей, защиты аккаунта и обеспечения стабильной работы сервиса.']},
  {title:'Хранение и поставщики инфраструктуры',body:['Для работы FlowPay используются специализированные инфраструктурные поставщики. Они получают только тот объём данных, который необходим для предоставления соответствующей услуги. Доступ к данным ограничивается техническими и организационными мерами безопасности.']},
  {title:'Контроль над данными',body:['Вы можете изменять данные компании и контрагентов в кабинете, а также удалить аккаунт в настройках. В отдельных случаях часть информации может сохраняться дольше, если это необходимо для безопасности, разрешения споров или выполнения обязательных требований законодательства.']},
  {title:'Связь по вопросам конфиденциальности',body:['По вопросам обработки или удаления данных используйте официальный контакт FlowPay, опубликованный на сайте или в вашем договоре на обслуживание.']},
 ],
 en:[
  {title:'Data FlowPay processes',body:['We process account and company information, counterparties, invoices, prepared payments and actions performed in the service. Technical information may also be processed when required for security, diagnostics and abuse prevention.','FlowPay does not ask for your online-banking password. Payment details are used only for features you initiate in the service.']},
  {title:'How data is used',body:['Data is used to authenticate users, store operations, calculate available payment options, produce analytics and reports, support users, protect accounts and keep the service reliable.']},
  {title:'Storage and infrastructure providers',body:['FlowPay uses specialist infrastructure providers to operate the service. They receive only the information required for the relevant service, and access is restricted through technical and organisational controls.']},
  {title:'Control over your data',body:['You can update company and counterparty information from your account and delete your account from Settings. Certain records may be retained where required for security, dispute handling or mandatory legal obligations.']},
  {title:'Privacy contact',body:['For questions about processing or deletion of data, use the official FlowPay contact published on the website or in your service agreement.']},
 ]
}
export default function Privacy(){return <LegalPage title={title} updated={updated} sections={sections}/>} 
