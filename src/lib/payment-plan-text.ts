import { formatPlanDate, type BalanceMandateTerms } from "@/lib/payment-plan";

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

// E-mail « demande reçue » (lot 7) : ligne de paiement et rappel du calendrier.
const REQUEST_PAYMENT_ROW: Record<PaymentPlanLocale, (v: Values) => string> = {
  fr: (v) => `Acompte de ${v.deposit} autorisé, en attente de validation · solde de ${v.balance} le ${v.date}`,
  en: (v) => `Deposit of ${v.deposit} authorised, awaiting confirmation · balance of ${v.balance} on ${v.date}`,
  es: (v) => `Anticipo de ${v.deposit} autorizado, pendiente de validación · saldo de ${v.balance} el ${v.date}`,
};

const REQUEST_SCHEDULE: Record<PaymentPlanLocale, (v: Values) => string> = {
  fr: (v) => `Paiement en deux fois : l'acompte de ${v.deposit} n'est débité qu'après acceptation de votre demande. Le solde de ${v.balance} sera prélevé automatiquement le ${v.date} sur la carte enregistrée, comme vous l'avez autorisé. Annulation gratuite jusqu'au ${v.date}.`,
  en: (v) => `Payment in two instalments: the ${v.deposit} deposit is only charged once your request is accepted. The balance of ${v.balance} will be charged automatically on ${v.date} to the saved card, as you authorised. Free cancellation until ${v.date}.`,
  es: (v) => `Pago en dos plazos: el anticipo de ${v.deposit} solo se cobra después de aceptar su solicitud. El saldo de ${v.balance} se cobrará automáticamente el ${v.date} en la tarjeta registrada, según lo autorizado. Cancelación gratuita hasta el ${v.date}.`,
};

export const getDepositRequestPaymentRow = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) =>
  REQUEST_PAYMENT_ROW[locale](values(terms, locale));

export const getDepositRequestSchedule = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) =>
  REQUEST_SCHEDULE[locale](values(terms, locale));

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

// ---------------------------------------------------------------------------
// Solde (lot 5) : rappel J-14, échec + lien de reprise, relances, solde réglé,
// annulation pour défaut de paiement
// ---------------------------------------------------------------------------

export type BalanceEmailInput = {
  petName: string;
  // Montant prélevé ou à régler (intérêts L214-2 déjà déduits).
  amount: number;
  // Dates calendaires (AAAA-MM-JJ, heure de Paris) : prélèvement prévu,
  // limite de paiement (J-2) et début de la garde.
  dueDate: string;
  deadlineDate: string;
  startDate: string;
  cardLast4?: string | null;
  depositAmount?: number;
};

type BalanceValues = { pet: string; amount: string; due: string; deadline: string; start: string; card: string; deposit: string };

const balanceValues = (input: BalanceEmailInput, locale: PaymentPlanLocale): BalanceValues => ({
  pet: input.petName,
  amount: formatPlanAmount(input.amount, locale),
  due: formatPlanDate(input.dueDate),
  deadline: formatPlanDate(input.deadlineDate),
  start: formatPlanDate(input.startDate),
  card: SAVED_CARD[locale](input.cardLast4),
  deposit: formatPlanAmount(input.depositAmount ?? 0, locale),
});

const BALANCE_NOTICE: Record<PaymentPlanLocale, (v: BalanceValues) => PlanEmailSection> = {
  fr: (v) => ({
    title: "Prélèvement du solde à venir",
    subtitle: `Le solde de ${v.amount} pour la garde de ${v.pet} sera prélevé le ${v.due}.`,
    paragraphs: [
      `Comme vous l'avez autorisé lors de la réservation, le solde sera prélevé automatiquement sur ${v.card}. Vous n'avez rien à faire.`,
      `Annulation gratuite jusqu'au ${v.due} : l'acompte est alors remboursé et le solde n'est pas prélevé.`,
    ],
    rows: [
      { label: "Solde", value: v.amount },
      { label: "Date du prélèvement", value: v.due },
      { label: "Début de la garde", value: v.start },
    ],
    buttonLabel: "Voir ma réservation",
  }),
  en: (v) => ({
    title: "Upcoming balance payment",
    subtitle: `The balance of ${v.amount} for ${v.pet}'s stay will be charged on ${v.due}.`,
    paragraphs: [
      `As you authorised when booking, the balance will be charged automatically to ${v.card}. You do not need to do anything.`,
      `Free cancellation until ${v.due}: the deposit is then refunded and the balance is not charged.`,
    ],
    rows: [
      { label: "Balance", value: v.amount },
      { label: "Payment date", value: v.due },
      { label: "Start of the stay", value: v.start },
    ],
    buttonLabel: "View my booking",
  }),
  es: (v) => ({
    title: "Próximo cobro del saldo",
    subtitle: `El saldo de ${v.amount} para el cuidado de ${v.pet} se cobrará el ${v.due}.`,
    paragraphs: [
      `Tal como autorizó al reservar, el saldo se cobrará automáticamente en ${v.card}. No tiene que hacer nada.`,
      `Cancelación gratuita hasta el ${v.due}: en ese caso se reembolsa el anticipo y no se cobra el saldo.`,
    ],
    rows: [
      { label: "Saldo", value: v.amount },
      { label: "Fecha del cobro", value: v.due },
      { label: "Inicio del cuidado", value: v.start },
    ],
    buttonLabel: "Ver mi reserva",
  }),
};

const BALANCE_FAILED: Record<PaymentPlanLocale, (v: BalanceValues) => PlanEmailSection> = {
  fr: (v) => ({
    title: "Le solde n'a pas pu être prélevé",
    subtitle: `Le prélèvement du solde de ${v.amount} pour la garde de ${v.pet} a échoué.`,
    paragraphs: [
      "Votre banque a refusé le paiement ou demande une confirmation de votre part. Vous pouvez régler le solde en ligne en quelques instants, par carte, avec le bouton ci-dessous (connexion à votre compte requise).",
      `Sans paiement avant le ${v.deadline} à 12 h (heure de Paris), la réservation sera annulée et l'acompte conservé, conformément aux conditions générales de vente.`,
    ],
    rows: [
      { label: "Solde à régler", value: v.amount },
      { label: "Date limite", value: `${v.deadline} à 12 h` },
      { label: "Début de la garde", value: v.start },
    ],
    buttonLabel: "Régler le solde",
  }),
  en: (v) => ({
    title: "The balance could not be charged",
    subtitle: `The ${v.amount} balance payment for ${v.pet}'s stay failed.`,
    paragraphs: [
      "Your bank declined the payment or needs you to confirm it. You can pay the balance online in a few moments by card using the button below (you will need to sign in to your account).",
      `Without payment before ${v.deadline} at 12:00 (Paris time), the booking will be cancelled and the deposit kept, in accordance with the terms and conditions of sale.`,
    ],
    rows: [
      { label: "Balance due", value: v.amount },
      { label: "Deadline", value: `${v.deadline} at 12:00` },
      { label: "Start of the stay", value: v.start },
    ],
    buttonLabel: "Pay the balance",
  }),
  es: (v) => ({
    title: "No se ha podido cobrar el saldo",
    subtitle: `El cobro del saldo de ${v.amount} para el cuidado de ${v.pet} ha fallado.`,
    paragraphs: [
      "Su banco ha rechazado el pago o necesita que lo confirme. Puede pagar el saldo en línea en unos instantes, con tarjeta, mediante el botón de abajo (debe iniciar sesión en su cuenta).",
      `Si no se paga antes del ${v.deadline} a las 12:00 (hora de París), la reserva se cancelará y se conservará el anticipo, de acuerdo con las condiciones generales de venta.`,
    ],
    rows: [
      { label: "Saldo pendiente", value: v.amount },
      { label: "Fecha límite", value: `${v.deadline} a las 12:00` },
      { label: "Inicio del cuidado", value: v.start },
    ],
    buttonLabel: "Pagar el saldo",
  }),
};

const BALANCE_REMINDER: Record<PaymentPlanLocale, (v: BalanceValues) => PlanEmailSection> = {
  fr: (v) => ({
    ...BALANCE_FAILED.fr(v),
    title: "Rappel : solde de votre réservation à régler",
    subtitle: `Le solde de ${v.amount} pour la garde de ${v.pet} n'est toujours pas réglé.`,
  }),
  en: (v) => ({
    ...BALANCE_FAILED.en(v),
    title: "Reminder: your booking balance is still due",
    subtitle: `The ${v.amount} balance for ${v.pet}'s stay has still not been paid.`,
  }),
  es: (v) => ({
    ...BALANCE_FAILED.es(v),
    title: "Recordatorio: saldo de su reserva pendiente",
    subtitle: `El saldo de ${v.amount} para el cuidado de ${v.pet} sigue sin pagarse.`,
  }),
};

const BALANCE_PAID: Record<PaymentPlanLocale, (v: BalanceValues) => PlanEmailSection> = {
  fr: (v) => ({
    title: "Solde réglé",
    subtitle: `Le solde de ${v.amount} pour la garde de ${v.pet} est réglé. Votre réservation est entièrement payée.`,
    paragraphs: ["La facture finale (acompte déduit) vous est envoyée dans un e-mail séparé. À très bientôt !"],
    rows: [
      { label: "Solde réglé", value: v.amount },
      { label: "Début de la garde", value: v.start },
    ],
    buttonLabel: "Voir ma réservation",
  }),
  en: (v) => ({
    title: "Balance paid",
    subtitle: `The ${v.amount} balance for ${v.pet}'s stay has been paid. Your booking is now fully paid.`,
    paragraphs: ["The final invoice (deposit deducted) is sent to you in a separate email. See you soon!"],
    rows: [
      { label: "Balance paid", value: v.amount },
      { label: "Start of the stay", value: v.start },
    ],
    buttonLabel: "View my booking",
  }),
  es: (v) => ({
    title: "Saldo pagado",
    subtitle: `El saldo de ${v.amount} para el cuidado de ${v.pet} está pagado. Su reserva está totalmente pagada.`,
    paragraphs: ["La factura final (anticipo deducido) se le envía en un correo aparte. ¡Hasta pronto!"],
    rows: [
      { label: "Saldo pagado", value: v.amount },
      { label: "Inicio del cuidado", value: v.start },
    ],
    buttonLabel: "Ver mi reserva",
  }),
};

const BALANCE_DEFAULT_CANCELLED: Record<PaymentPlanLocale, (v: BalanceValues) => PlanEmailSection> = {
  fr: (v) => ({
    title: "Réservation annulée : solde impayé",
    subtitle: `Le solde de ${v.amount} pour la garde de ${v.pet} n'a pas été réglé avant la date limite du ${v.deadline} à 12 h.`,
    paragraphs: [
      `Conformément aux conditions générales de vente, la réservation est annulée et l'acompte de ${v.deposit} est conservé. Aucune autre somme ne sera prélevée.`,
      "Si vous pensez qu'il s'agit d'une erreur, répondez à cet e-mail : nous reviendrons vers vous rapidement.",
    ],
    rows: [
      { label: "Acompte conservé", value: v.deposit },
      { label: "Solde non prélevé", value: v.amount },
    ],
    buttonLabel: "Voir mes réservations",
  }),
  en: (v) => ({
    title: "Booking cancelled: balance unpaid",
    subtitle: `The ${v.amount} balance for ${v.pet}'s stay was not paid before the deadline of ${v.deadline} at 12:00.`,
    paragraphs: [
      `In accordance with the terms and conditions of sale, the booking is cancelled and the ${v.deposit} deposit is kept. No other amount will be charged.`,
      "If you think this is a mistake, reply to this email and we will get back to you quickly.",
    ],
    rows: [
      { label: "Deposit kept", value: v.deposit },
      { label: "Balance not charged", value: v.amount },
    ],
    buttonLabel: "View my bookings",
  }),
  es: (v) => ({
    title: "Reserva cancelada: saldo impagado",
    subtitle: `El saldo de ${v.amount} para el cuidado de ${v.pet} no se pagó antes de la fecha límite del ${v.deadline} a las 12:00.`,
    paragraphs: [
      `De acuerdo con las condiciones generales de venta, la reserva se cancela y se conserva el anticipo de ${v.deposit}. No se cobrará ningún otro importe.`,
      "Si cree que se trata de un error, responda a este correo y le contestaremos rápidamente.",
    ],
    rows: [
      { label: "Anticipo conservado", value: v.deposit },
      { label: "Saldo no cobrado", value: v.amount },
    ],
    buttonLabel: "Ver mis reservas",
  }),
};

export type BalanceEmailKind = "NOTICE" | "FAILED" | "REMINDER" | "PAID" | "DEFAULT_CANCELLED";

const BALANCE_SECTIONS: Record<BalanceEmailKind, Record<PaymentPlanLocale, (v: BalanceValues) => PlanEmailSection>> = {
  NOTICE: BALANCE_NOTICE,
  FAILED: BALANCE_FAILED,
  REMINDER: BALANCE_REMINDER,
  PAID: BALANCE_PAID,
  DEFAULT_CANCELLED: BALANCE_DEFAULT_CANCELLED,
};

export const BALANCE_EMAIL_SUBJECTS: Record<BalanceEmailKind, string> = {
  NOTICE: "Prélèvement du solde à venir / Upcoming balance payment / Próximo cobro del saldo - La Patte Dorée",
  FAILED: "Solde non prélevé : action requise / Balance payment failed / Cobro del saldo fallido - La Patte Dorée",
  REMINDER: "Rappel : solde à régler / Reminder: balance due / Recordatorio: saldo pendiente - La Patte Dorée",
  PAID: "Solde réglé / Balance paid / Saldo pagado - La Patte Dorée",
  DEFAULT_CANCELLED: "Réservation annulée : solde impayé / Booking cancelled / Reserva cancelada - La Patte Dorée",
};

export const getBalanceEmailSection = (kind: BalanceEmailKind, input: BalanceEmailInput, locale: PaymentPlanLocale) =>
  BALANCE_SECTIONS[kind][locale](balanceValues(input, locale));
