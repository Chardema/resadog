import { formatPlanDate, type BalanceMandateTerms } from "./payment-plan";

// Textes du plan acompte + solde, rédigés directement en FR/EN/ES : ils portent
// des montants et une date (consentement MIT) qui ne doivent pas passer par la
// traduction automatique du DOM. Toujours « acompte », jamais « arrhes ».

export type PaymentPlanLocale = "fr" | "en" | "es";

export function toPaymentPlanLocale(locale: string | null | undefined): PaymentPlanLocale {
  return locale === "en" || locale === "es" ? locale : "fr";
}

const NUMBER_LOCALES: Record<PaymentPlanLocale, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES" };

export function formatPlanAmount(amount: number, locale: PaymentPlanLocale) {
  return new Intl.NumberFormat(NUMBER_LOCALES[locale], { style: "currency", currency: "EUR" }).format(amount);
}

type Values = { deposit: string; balance: string; total: string; date: string };

const values = (terms: BalanceMandateTerms, locale: PaymentPlanLocale): Values => ({
  deposit: formatPlanAmount(terms.depositAmount, locale),
  balance: formatPlanAmount(terms.balanceAmount, locale),
  total: formatPlanAmount(terms.depositAmount + terms.balanceAmount, locale),
  date: formatPlanDate(terms.balanceDueDate),
});

const MANDATE_LABEL: Record<PaymentPlanLocale, (v: Values) => string> = {
  fr: (v) => `J'autorise La Patte Dorée (MM Services) à prélever le solde de ${v.balance} le ${v.date} sur la carte enregistrée lors de ce paiement, sans autre action de ma part. Je peux annuler gratuitement jusqu'à 7 jours avant le début de la garde : le solde n'est alors pas prélevé.`,
  en: (v) => `I authorise La Patte Dorée (MM Services) to charge the balance of ${v.balance} on ${v.date} to the card saved during this payment, with no further action on my part. I can cancel free of charge up to 7 days before the start of the pet sitting, in which case the balance is not charged.`,
  es: (v) => `Autorizo a La Patte Dorée (MM Services) a cobrar el saldo de ${v.balance} el ${v.date} en la tarjeta registrada durante este pago, sin ninguna otra acción por mi parte. Puedo cancelar gratuitamente hasta 7 días antes del inicio del cuidado: en ese caso, el saldo no se cobra.`,
};

const SUMMARY: Record<PaymentPlanLocale, (v: Values) => string[]> = {
  fr: (v) => [
    `Acompte de ${v.deposit} (30 %) autorisé aujourd'hui, débité seulement si la réservation est acceptée.`,
    `Solde de ${v.balance} prélevé automatiquement le ${v.date}, 7 jours avant le début.`,
    "Annulation gratuite jusqu'à 7 jours avant le début ; ensuite l'acompte est conservé ; à moins de 48 h, 50 % du total est retenu, sous réserve des droits légaux.",
  ],
  en: (v) => [
    `Deposit of ${v.deposit} (30%) authorised today, charged only if the booking is accepted.`,
    `Balance of ${v.balance} charged automatically on ${v.date}, 7 days before the start.`,
    "Free cancellation up to 7 days before the start; after that the deposit is kept; less than 48 hours before, 50% of the total is retained, subject to statutory rights.",
  ],
  es: (v) => [
    `Anticipo de ${v.deposit} (30 %) autorizado hoy, cobrado solo si se acepta la reserva.`,
    `Saldo de ${v.balance} cobrado automáticamente el ${v.date}, 7 días antes del inicio.`,
    "Cancelación gratuita hasta 7 días antes del inicio; después se conserva el anticipo; con menos de 48 h, se retiene el 50 % del total, sin perjuicio de los derechos legales.",
  ],
};

const SUMMARY_TITLE: Record<PaymentPlanLocale, (v: Values) => string> = {
  fr: (v) => `Paiement en deux fois : ${v.deposit} + ${v.balance}`,
  en: (v) => `Payment in two instalments: ${v.deposit} + ${v.balance}`,
  es: (v) => `Pago en dos plazos: ${v.deposit} + ${v.balance}`,
};

const CHECKOUT_SUBMIT_MESSAGE: Record<PaymentPlanLocale, (v: Values) => string> = {
  fr: (v) => `Aujourd'hui : autorisation de l'acompte de ${v.deposit}, débité seulement après acceptation de votre demande. Le solde de ${v.balance} sera prélevé automatiquement le ${v.date} sur cette carte, conformément à l'autorisation que vous avez donnée.`,
  en: (v) => `Today: authorisation of the ${v.deposit} deposit, charged only once your request is accepted. The balance of ${v.balance} will be charged automatically to this card on ${v.date}, as you have authorised.`,
  es: (v) => `Hoy: autorización del anticipo de ${v.deposit}, cobrado solo después de aceptar su solicitud. El saldo de ${v.balance} se cobrará automáticamente en esta tarjeta el ${v.date}, según la autorización que ha dado.`,
};

const LINE_ITEM_DETAIL: Record<PaymentPlanLocale, (v: Values) => string> = {
  fr: (v) => `Acompte de ${v.deposit} sur un total de ${v.total} · Solde de ${v.balance} prélevé le ${v.date}`,
  en: (v) => `Deposit of ${v.deposit} out of a total of ${v.total} · Balance of ${v.balance} charged on ${v.date}`,
  es: (v) => `Anticipo de ${v.deposit} de un total de ${v.total} · Saldo de ${v.balance} cobrado el ${v.date}`,
};

const MANDATE_REQUIRED_ERROR: Record<PaymentPlanLocale, string> = {
  fr: "Vérifiez le montant et la date du solde, puis cochez l'autorisation de prélèvement pour continuer.",
  en: "Please check the balance amount and date, then tick the payment authorisation to continue.",
  es: "Compruebe el importe y la fecha del saldo y marque la autorización de cobro para continuar.",
};

export const getBalanceMandateLabel = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) =>
  MANDATE_LABEL[locale](values(terms, locale));

export const getPaymentPlanSummary = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) => ({
  title: SUMMARY_TITLE[locale](values(terms, locale)),
  lines: SUMMARY[locale](values(terms, locale)),
});

export const getCheckoutSubmitMessage = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) =>
  CHECKOUT_SUBMIT_MESSAGE[locale](values(terms, locale));

export const getDepositLineItemDetail = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) =>
  LINE_ITEM_DETAIL[locale](values(terms, locale));

export const getBalanceMandateRequiredError = (locale: PaymentPlanLocale) => MANDATE_REQUIRED_ERROR[locale];
