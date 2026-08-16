import { LegalPage } from '@/components/LegalPage'
const title={ru:'Безопасность FlowPay',en:'FlowPay Security'}
const updated={ru:'Практики продукта · версия 1.3',en:'Product practices · version 1.3'}
const sections={
 ru:[
  {title:'Изоляция данных',body:['Данные аккаунтов ограничиваются политиками доступа на уровне базы данных. Серверные административные ключи не передаются в браузер и используются только серверными обработчиками.']},
  {title:'API и ключи',body:['API-ключ FlowPay показывается один раз. В базе хранится его SHA-256 хэш, а ключ можно отозвать из кабинета. Для публичных и API-запросов применяются серверные ограничения частоты запросов.']},
  {title:'Журналы и операции',body:['Изменения основных финансовых сущностей фиксируются в журнале действий без копирования чувствительного содержимого строк. Ошибки серверных процессов могут записываться в отдельный технический журнал для диагностики.']},
  {title:'Ответственное раскрытие',body:['Если вы обнаружили потенциальную уязвимость, сообщите о ней через официальный контакт FlowPay, опубликованный на сайте или в договоре. Не отправляйте пароли, секретные ключи или полные банковские реквизиты в первоначальном сообщении.']},
 ],
 en:[
  {title:'Data isolation',body:['Account data is protected with database-level access policies. Server administrative credentials are never sent to the browser and are used only by server handlers.']},
  {title:'API and keys',body:['FlowPay API secrets are shown once. Only a SHA-256 hash is stored, and keys can be revoked. Public and API endpoints use distributed request-rate controls.']},
  {title:'Audit and operations',body:['Changes to core financial entities are recorded as metadata-only audit events without copying sensitive row contents. Server process failures can be written to a separate operational event log for diagnosis.']},
  {title:'Responsible disclosure',body:['If you identify a potential vulnerability, report it through the official FlowPay contact published on the website or in your service agreement. Do not include passwords, secret keys or full banking credentials in the initial report.']},
 ]
}
export default function Security(){return <LegalPage title={title} updated={updated} sections={sections}/>} 
