import type { Language } from './types'

type Context='save'|'delete'|'payment'|'route'|'api'|'invite'|'load'

const messages:Record<Language,Record<Context,string>>={
  ru:{save:'Не удалось сохранить изменения. Повторите попытку.',delete:'Не удалось удалить запись. Повторите попытку.',payment:'Не удалось обновить платёж. Повторите попытку.',route:'Не удалось рассчитать маршрут. Проверьте параметры и повторите попытку.',api:'Не удалось выполнить операцию с API. Повторите попытку.',invite:'Не удалось отправить приглашение. Повторите попытку позже.',load:'Не удалось загрузить данные аккаунта.'},
  en:{save:'Could not save your changes. Please try again.',delete:'Could not delete this item. Please try again.',payment:'Could not update the payment. Please try again.',route:'Could not calculate this route. Check the details and try again.',api:'Could not complete the API operation. Please try again.',invite:'Could not send the invitation. Please try again later.',load:'Could not load your account data.'},
  fr:{save:'Impossible d’enregistrer les modifications. Réessayez.',delete:'Impossible de supprimer cet élément. Réessayez.',payment:'Impossible de mettre à jour le paiement. Réessayez.',route:'Impossible de calculer cette route. Vérifiez les données et réessayez.',api:'Impossible d’effectuer l’opération API. Réessayez.',invite:'Impossible d’envoyer l’invitation. Réessayez plus tard.',load:'Impossible de charger les données du compte.'},
  de:{save:'Änderungen konnten nicht gespeichert werden. Bitte erneut versuchen.',delete:'Eintrag konnte nicht gelöscht werden. Bitte erneut versuchen.',payment:'Zahlung konnte nicht aktualisiert werden. Bitte erneut versuchen.',route:'Route konnte nicht berechnet werden. Angaben prüfen und erneut versuchen.',api:'API-Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen.',invite:'Einladung konnte nicht gesendet werden. Bitte später erneut versuchen.',load:'Kontodaten konnten nicht geladen werden.'},
  es:{save:'No se pudieron guardar los cambios. Inténtalo de nuevo.',delete:'No se pudo eliminar el elemento. Inténtalo de nuevo.',payment:'No se pudo actualizar el pago. Inténtalo de nuevo.',route:'No se pudo calcular la ruta. Revisa los datos e inténtalo de nuevo.',api:'No se pudo completar la operación de API. Inténtalo de nuevo.',invite:'No se pudo enviar la invitación. Inténtalo más tarde.',load:'No se pudieron cargar los datos de la cuenta.'},
}

export function userError(lang:Language,context:Context){return messages[lang][context]}

const noProductionRouteMessages:Record<Language,string>={
  ru:'Для этих параметров нет активного проверенного production route. FlowPay не подставляет fallback — проверьте направление, валюты, сумму или дождитесь подтверждённого правила.',
  en:'No active verified production route matches these parameters. FlowPay does not inject a fallback; review the corridor, currencies or amount.',
  fr:'Aucune route de production active et vérifiée ne correspond à ces paramètres. FlowPay n’injecte aucun fallback ; vérifiez le corridor, les devises ou le montant.',
  de:'Für diese Parameter gibt es keine aktive verifizierte Production-Route. FlowPay setzt keinen Fallback ein; prüfen Sie Korridor, Währungen oder Betrag.',
  es:'No hay una ruta de producción activa y verificada para estos parámetros. FlowPay no inserta un fallback; revisa el corredor, las divisas o el importe.',
}

export function noProductionRouteError(lang:Language){return noProductionRouteMessages[lang]}
