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

// ---------------------------------------------------------------------------
// E-mail de confirmation avec calendrier (lot 3) et demande expirée (lot 4)
// ---------------------------------------------------------------------------

export const PAYMENT_PLAN_LOCALES: readonly PaymentPlanLocale[] = ["fr", "en", "es"];

export type DepositConfirmationSchedule = BalanceMandateTerms & {
  // Date calendaire (AAAA-MM-JJ, heure de Paris) de la capture de l'acompte.
  depositCapturedDate: string;
  cardLast4?: string | null;
};

export type PlanEmailRow = { label: string; value: string };

export type PlanEmailSection = {
  title: string;
  subtitle: string;
  paragraphs: string[];
  rows: PlanEmailRow[];
  buttonLabel: string;
};

const SAVED_CARD: Record<PaymentPlanLocale, (last4: string | null | undefined) => string> = {
  fr: (last4) => (last4 ? `la carte •••• ${last4}` : "la carte enregistrée"),
  en: (last4) => (last4 ? `the card ending ${last4}` : "the saved card"),
  es: (last4) => (last4 ? `la tarjeta •••• ${last4}` : "la tarjeta registrada"),
};

type ScheduleValues = Values & { captured: string; card: string };

const DEPOSIT_CONFIRMATION: Record<PaymentPlanLocale, (v: ScheduleValues) => PlanEmailSection> = {
  fr: (v) => ({
    title: "Réservation validée",
    subtitle: `Votre demande est acceptée. L'acompte de ${v.deposit} est débité ; le solde de ${v.balance} sera prélevé le ${v.date}.`,
    paragraphs: [
      `Le solde de ${v.balance} sera prélevé automatiquement le ${v.date} sur ${v.card}, comme vous l'avez autorisé. Les intérêts légaux éventuellement dus sur l'acompte sont déduits de ce montant.`,
      `Annulation gratuite jusqu'au ${v.date} (7 jours avant le début) : l'acompte est remboursé et le solde n'est pas prélevé. Ensuite, l'acompte est conservé ; à moins de 48 h du début, 50 % du total est retenu, sous réserve de vos droits légaux (dont la rétractation de 14 jours).`,
      "Si le prélèvement du solde échoue, nous vous écrirons avec un lien pour le régler en ligne.",
    ],
    rows: [
      { label: "Acompte (30 %)", value: `${v.deposit} débité le ${v.captured}` },
      { label: "Solde", value: `${v.balance} prélevé le ${v.date} sur ${v.card}` },
      { label: "Total", value: v.total },
      { label: "Annulation gratuite", value: `jusqu'au ${v.date}` },
    ],
    buttonLabel: "Voir ma réservation",
  }),
  en: (v) => ({
    title: "Booking confirmed",
    subtitle: `Your request is accepted. The ${v.deposit} deposit has been charged; the ${v.balance} balance will be charged on ${v.date}.`,
    paragraphs: [
      `The balance of ${v.balance} will be charged automatically on ${v.date} to ${v.card}, as you authorised. Any statutory interest due on the deposit is deducted from this amount.`,
      `Free cancellation until ${v.date} (7 days before the start): the deposit is refunded and the balance is not charged. After that, the deposit is kept; less than 48 hours before the start, 50% of the total is retained, subject to your statutory rights (including the 14-day withdrawal right).`,
      "If the balance payment fails, we will email you a link to pay it online.",
    ],
    rows: [
      { label: "Deposit (30%)", value: `${v.deposit} charged on ${v.captured}` },
      { label: "Balance", value: `${v.balance} charged on ${v.date} to ${v.card}` },
      { label: "Total", value: v.total },
      { label: "Free cancellation", value: `until ${v.date}` },
    ],
    buttonLabel: "View my booking",
  }),
  es: (v) => ({
    title: "Reserva confirmada",
    subtitle: `Su solicitud ha sido aceptada. Se ha cobrado el anticipo de ${v.deposit}; el saldo de ${v.balance} se cobrará el ${v.date}.`,
    paragraphs: [
      `El saldo de ${v.balance} se cobrará automáticamente el ${v.date} en ${v.card}, según lo autorizado. Los intereses legales que pudieran corresponder sobre el anticipo se deducen de este importe.`,
      `Cancelación gratuita hasta el ${v.date} (7 días antes del inicio): se reembolsa el anticipo y no se cobra el saldo. Después, se conserva el anticipo; con menos de 48 h antes del inicio, se retiene el 50 % del total, sin perjuicio de sus derechos legales (incluido el desistimiento de 14 días).`,
      "Si el cobro del saldo falla, le enviaremos un enlace para pagarlo en línea.",
    ],
    rows: [
      { label: "Anticipo (30 %)", value: `${v.deposit} cobrado el ${v.captured}` },
      { label: "Saldo", value: `${v.balance} cobrado el ${v.date} en ${v.card}` },
      { label: "Total", value: v.total },
      { label: "Cancelación gratuita", value: `hasta el ${v.date}` },
    ],
    buttonLabel: "Ver mi reserva",
  }),
};

export const DEPOSIT_CONFIRMATION_SUBJECT =
  "Réservation validée : acompte et calendrier / Booking confirmed / Reserva confirmada - La Patte Dorée";

export function getDepositConfirmationSection(schedule: DepositConfirmationSchedule, locale: PaymentPlanLocale) {
  return DEPOSIT_CONFIRMATION[locale]({
    ...values(schedule, locale),
    captured: formatPlanDate(schedule.depositCapturedDate),
    card: SAVED_CARD[locale](schedule.cardLast4),
  });
}

const AUTHORIZATION_EXPIRED: Record<PaymentPlanLocale, (petName: string) => PlanEmailSection> = {
  fr: (petName) => ({
    title: "Demande expirée",
    subtitle: `Votre demande de réservation pour ${petName} n'a pas pu être validée à temps.`,
    paragraphs: [
      "L'autorisation bancaire posée lors de votre demande a expiré avant que notre équipe ne puisse l'accepter. Aucune somme n'a été débitée et l'autorisation est libérée par votre banque.",
      "Si vous souhaitez toujours confier votre animal à La Patte Dorée, vous pouvez refaire une demande en ligne. Nous vous prions de nous excuser pour ce contretemps.",
    ],
    rows: [],
    buttonLabel: "Refaire une demande",
  }),
  en: (petName) => ({
    title: "Request expired",
    subtitle: `Your booking request for ${petName} could not be confirmed in time.`,
    paragraphs: [
      "The card authorisation placed with your request expired before our team could accept it. Nothing has been charged and your bank releases the authorisation.",
      "If you would still like to entrust your pet to La Patte Dorée, you can submit a new request online. We apologise for the inconvenience.",
    ],
    rows: [],
    buttonLabel: "Submit a new request",
  }),
  es: (petName) => ({
    title: "Solicitud caducada",
    subtitle: `Su solicitud de reserva para ${petName} no pudo validarse a tiempo.`,
    paragraphs: [
      "La autorización bancaria realizada con su solicitud caducó antes de que nuestro equipo pudiera aceptarla. No se ha cobrado ningún importe y su banco libera la autorización.",
      "Si todavía desea confiar su animal a La Patte Dorée, puede enviar una nueva solicitud en línea. Le pedimos disculpas por las molestias.",
    ],
    rows: [],
    buttonLabel: "Enviar una nueva solicitud",
  }),
};

export const AUTHORIZATION_EXPIRED_SUBJECT = "Demande expirée / Request expired / Solicitud caducada - La Patte Dorée";

export const getAuthorizationExpiredSection = (petName: string, locale: PaymentPlanLocale) =>
  AUTHORIZATION_EXPIRED[locale](petName);
