import { addCalendarDays, getCalendarDayDifference, getTodayDateKey, parisAppointment } from "@/lib/booking-dates";
import { isProductionDeployment } from "@/lib/runtime-env";

// Acompte à la réservation et solde prélevé avant la garde (spec 07).
// Tout ce module est pur : aucun accès base, Stripe ou horloge implicite.
// Les montants sont calculés en centimes entiers pour garantir
// acompte + solde = total exact, quel que soit le prix décimal.

// Drapeaux de code (pas des variables Vercel). Le plan est actif sur les
// aperçus Vercel, en local et en test, et en production.
export const PAYMENT_PLAN_PREVIEW_ENABLED = true;
// Activé en production avec l'accord du propriétaire (PR d'activation,
// docs/GO_LIVE_PAYMENT_PLAN.md). Repasser à false referme le plan : toutes les
// nouvelles réservations reviennent en paiement intégral.
export const PAYMENT_PLAN_ENABLED_IN_PRODUCTION = true;

// Évaluée à chaque appel (jamais au chargement du module) : serveur selon
// VERCEL_ENV, navigateur selon NEXT_PUBLIC_VERCEL_ENV. Le serveur fait foi.
export function isPaymentPlanEnabled(): boolean {
  return isProductionDeployment() ? PAYMENT_PLAN_ENABLED_IN_PRODUCTION : PAYMENT_PLAN_PREVIEW_ENABLED;
}

export const DEPOSIT_RATE = 0.3;
export const DEPOSIT_MIN_TOTAL = 100;
export const DEPOSIT_MIN_LEAD_DAYS = 14;
export const BALANCE_DAYS_BEFORE = 7;
export const BALANCE_FINAL_DEADLINE_DAYS_BEFORE = 2;
// Heure de Paris de la limite J-2 (annulation pour défaut de paiement).
export const BALANCE_FINAL_DEADLINE_TIME = "12:00";
// Rappel préventif avant le prélèvement, puis relances après un échec.
export const BALANCE_NOTICE_DAYS_BEFORE = 14;
export const BALANCE_REMINDER_DAYS_BEFORE = [5, 3] as const;

// Barème d'annulation client du plan DEPOSIT_BALANCE (§5.6, option D3-1).
export const DEPOSIT_FREE_CANCELLATION_HOURS = BALANCE_DAYS_BEFORE * 24;
export const DEPOSIT_LATE_CANCELLATION_HOURS = 48;
export const DEPOSIT_LATE_CANCELLATION_RETAINED_RATE = 0.5;

// Garde longue durée : hébergement, garde à domicile et séries de visites.
// Le seuil de 100 € écarte de lui-même les visites ou promenades isolées.
export const DEPOSIT_ELIGIBLE_SERVICES = ["BOARDING", "HOUSE_SITTING", "DROP_IN", "DAY_CARE"] as const;

export type PaymentPlanKind = "FULL" | "DEPOSIT_BALANCE";

const toCents = (amount: number) => Math.round(amount * 100);
const toEuros = (cents: number) => cents / 100;

const toDateKey = (date: Date | string) =>
  typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);

const parisWallTime = (dateKey: string, time: string) => {
  const instant = parisAppointment(dateKey, time);
  if (!instant) throw new Error(`Heure de Paris invalide : ${dateKey} ${time}`);
  return instant;
};

// Début de la prestation (date calendaire + heure de Paris, minuit à défaut).
export function getBookingStartsAt(startDate: Date | string, startTime?: string | null) {
  const key = toDateKey(startDate);
  return parisAppointment(key, startTime) ?? parisWallTime(key, "00:00");
}

// Nombre de jours calendaires (heure de Paris) entre la demande et le début.
export function getLeadDays(startDate: Date | string, requestedAt: Date) {
  return getCalendarDayDifference(getTodayDateKey(requestedAt), toDateKey(startDate));
}

export type PaymentPlanInput = {
  totalPrice: number;
  serviceType: string;
  startDate: Date | string;
  requestedAt: Date;
  enabled?: boolean;
};

export type PaymentPlanSplit = {
  plan: PaymentPlanKind;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
};

// Acompte de 30 % arrondi à l'euro supérieur ; le solde absorbe les centimes.
export function splitDepositBalance(totalPrice: number) {
  const totalCents = toCents(totalPrice);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    throw new Error(`Total invalide pour un acompte : ${totalPrice}`);
  }
  const rateBasisPoints = Math.round(DEPOSIT_RATE * 10_000);
  const depositCents = Math.min(totalCents, Math.ceil((totalCents * rateBasisPoints) / 1_000_000) * 100);
  return {
    totalAmount: toEuros(totalCents),
    depositAmount: toEuros(depositCents),
    balanceAmount: toEuros(totalCents - depositCents),
  };
}

export function isDepositEligibleService(serviceType: string) {
  return (DEPOSIT_ELIGIBLE_SERVICES as readonly string[]).includes(serviceType);
}

export function choosePaymentPlan(input: PaymentPlanInput): PaymentPlanKind {
  const enabled = input.enabled ?? isPaymentPlanEnabled();
  if (!enabled) return "FULL";
  if (!isDepositEligibleService(input.serviceType)) return "FULL";
  if (toCents(input.totalPrice) < toCents(DEPOSIT_MIN_TOTAL)) return "FULL";
  if (getLeadDays(input.startDate, input.requestedAt) < DEPOSIT_MIN_LEAD_DAYS) return "FULL";
  return "DEPOSIT_BALANCE";
}

export function getPaymentPlanSplit(input: PaymentPlanInput): PaymentPlanSplit {
  const plan = choosePaymentPlan(input);
  if (plan === "FULL") {
    const totalAmount = toEuros(toCents(input.totalPrice));
    return { plan, totalAmount, depositAmount: totalAmount, balanceAmount: 0 };
  }
  return { plan, ...splitDepositBalance(input.totalPrice) };
}

export type BalanceSchedule = {
  // Prélèvement hors session : J-7 à 00:00 (heure de Paris), le cron du jour le traite.
  dueAt: Date;
  // Rappel « votre solde sera prélevé le … » (J-14).
  noticeAt: Date;
  // Relances client + alerte équipe en cas d'échec (J-5, J-3).
  reminderAts: Date[];
  // Annulation pour défaut de paiement : J-2 12:00 (heure de Paris).
  finalDeadlineAt: Date;
};

export function getBalanceSchedule(startDate: Date | string): BalanceSchedule {
  const key = toDateKey(startDate);
  const dayBefore = (days: number, time = "00:00") => parisWallTime(addCalendarDays(key, -days), time);
  return {
    dueAt: dayBefore(BALANCE_DAYS_BEFORE),
    noticeAt: dayBefore(BALANCE_NOTICE_DAYS_BEFORE),
    reminderAts: BALANCE_REMINDER_DAYS_BEFORE.map((days) => dayBefore(days)),
    finalDeadlineAt: dayBefore(BALANCE_FINAL_DEADLINE_DAYS_BEFORE, BALANCE_FINAL_DEADLINE_TIME),
  };
}

// État du solde vu par le client : PAYABLE seulement après un échec du
// prélèvement, tant que la limite J-2 12:00 n'est pas atteinte.
export type BalancePaymentState = "PAYABLE" | "PAID" | "SCHEDULED" | "IN_PROGRESS" | "CLOSED";

export function getBalancePaymentStateFor(
  input: { installmentStatus: string; bookingStatus: string; startDate: Date | string },
  now: Date
): BalancePaymentState {
  if (input.installmentStatus === "SUCCEEDED") return "PAID";
  if (input.bookingStatus !== "CONFIRMED") return "CLOSED";
  if (input.installmentStatus === "SCHEDULED") return "SCHEDULED";
  if (input.installmentStatus === "PROCESSING") return "IN_PROGRESS";
  if (input.installmentStatus !== "FAILED") return "CLOSED";
  return now.getTime() < getBalanceSchedule(input.startDate).finalDeadlineAt.getTime() ? "PAYABLE" : "CLOSED";
}

// ---------------------------------------------------------------------------
// Annulation (plan DEPOSIT_BALANCE uniquement ; FULL garde le barème 48 h / 50 %)
// ---------------------------------------------------------------------------

export type DepositCancellationActor =
  | "CLIENT"
  // Rétractation légale de 14 jours (contrat à distance) : remboursement intégral.
  | "WITHDRAWAL"
  | "TEAM"
  // Solde impayé à la limite J-2 : acompte conservé.
  | "PAYMENT_DEFAULT";

export type DepositCancellationTier =
  | "FREE"
  | "DEPOSIT_RETAINED"
  | "HALF_RETAINED"
  | "TEAM_FULL_REFUND"
  | "WITHDRAWAL_FULL_REFUND"
  | "PAYMENT_DEFAULT";

export type InstallmentOutcome = {
  // Somme gardée : capturée si le PaymentIntent n'est qu'autorisé, conservée sinon.
  retained: number;
  // Somme rendue : autorisation libérée ou remboursement du montant encaissé.
  returned: number;
};

export type DepositCancellationOutcome = {
  tier: DepositCancellationTier;
  retainedTotal: number;
  returnedTotal: number;
  deposit: InstallmentOutcome;
  balance: InstallmentOutcome;
};

export type DepositCancellationInput = {
  actor: DepositCancellationActor;
  totalPrice: number;
  // Montant autorisé ou capturé de l'acompte (PaymentIntent de la réservation).
  depositAmount: number;
  // Montant du solde effectivement encaissé (0 tant qu'il n'est pas prélevé).
  balanceCollectedAmount: number;
  startsAt: Date;
  cancelledAt: Date;
};

export function getDepositCancellationTier(input: Pick<DepositCancellationInput, "actor" | "startsAt" | "cancelledAt">): DepositCancellationTier {
  if (input.actor === "TEAM") return "TEAM_FULL_REFUND";
  if (input.actor === "WITHDRAWAL") return "WITHDRAWAL_FULL_REFUND";
  if (input.actor === "PAYMENT_DEFAULT") return "PAYMENT_DEFAULT";
  const hoursBeforeStart = (input.startsAt.getTime() - input.cancelledAt.getTime()) / 3_600_000;
  if (hoursBeforeStart >= DEPOSIT_FREE_CANCELLATION_HOURS) return "FREE";
  if (hoursBeforeStart >= DEPOSIT_LATE_CANCELLATION_HOURS) return "DEPOSIT_RETAINED";
  return "HALF_RETAINED";
}

// Retenue toujours bornée aux sommes réellement détenues : l'acompte d'abord,
// puis le solde encaissé. Aucun nouveau prélèvement n'est jamais déduit d'ici.
export function getDepositCancellationOutcome(input: DepositCancellationInput): DepositCancellationOutcome {
  const tier = getDepositCancellationTier(input);
  const depositCents = Math.max(0, toCents(input.depositAmount));
  const balanceCents = Math.max(0, toCents(input.balanceCollectedAmount));
  const totalCents = toCents(input.totalPrice);

  let targetRetainedCents = 0;
  if (tier === "DEPOSIT_RETAINED" || tier === "PAYMENT_DEFAULT") targetRetainedCents = depositCents;
  if (tier === "HALF_RETAINED") targetRetainedCents = Math.round(totalCents * DEPOSIT_LATE_CANCELLATION_RETAINED_RATE);

  const depositRetainedCents = Math.min(depositCents, targetRetainedCents);
  const balanceRetainedCents = Math.min(balanceCents, targetRetainedCents - depositRetainedCents);

  return {
    tier,
    retainedTotal: toEuros(depositRetainedCents + balanceRetainedCents),
    returnedTotal: toEuros(depositCents - depositRetainedCents + balanceCents - balanceRetainedCents),
    deposit: { retained: toEuros(depositRetainedCents), returned: toEuros(depositCents - depositRetainedCents) },
    balance: { retained: toEuros(balanceRetainedCents), returned: toEuros(balanceCents - balanceRetainedCents) },
  };
}

// ---------------------------------------------------------------------------
// Intérêts sur les sommes versées d'avance (art. L214-2 du Code de la consommation)
// ---------------------------------------------------------------------------
// Les sommes versées d'avance portent intérêt au taux légal à l'expiration
// d'un délai de 3 mois à compter du versement, jusqu'à l'exécution de la
// prestation. Les intérêts sont déduits du solde.
//
// Taux légal applicable aux créances des personnes physiques n'agissant pas
// pour des besoins professionnels (arrêtés semestriels publiés au Journal
// officiel). À METTRE À JOUR chaque semestre : faute de taux publié pour un
// semestre, le dernier taux connu s'applique. Valeurs à confirmer sur
// Légifrance / Banque de France avant la mise en production.
export const LEGAL_INTEREST_RATES: ReadonlyArray<{ from: string; rate: number }> = [
  { from: "2024-01-01", rate: 0.0801 },
  { from: "2024-07-01", rate: 0.0816 },
  { from: "2025-01-01", rate: 0.0721 },
  { from: "2025-07-01", rate: 0.0665 },
];
export const LEGAL_INTEREST_GRACE_MONTHS = 3;

export function getLegalInterestRate(dateKey: string) {
  let rate = LEGAL_INTEREST_RATES[0].rate;
  for (const entry of LEGAL_INTEREST_RATES) {
    if (entry.from <= dateKey) rate = entry.rate;
  }
  return rate;
}

const addMonthsToDateKey = (dateKey: string, months: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
};

const nextSemesterStart = (dateKey: string) => {
  const year = Number(dateKey.slice(0, 4));
  return dateKey < `${year}-07-01` ? `${year}-07-01` : `${year + 1}-01-01`;
};

// Intérêts simples (jours exacts / 365), par segment semestriel, arrondis au centime.
export function calculateAdvanceInterest(input: { amount: number; paidAt: Date; until: Date | string }) {
  const principalCents = Math.max(0, toCents(input.amount));
  const accrualStart = addMonthsToDateKey(getTodayDateKey(input.paidAt), LEGAL_INTEREST_GRACE_MONTHS);
  const accrualEnd = typeof input.until === "string" ? input.until.slice(0, 10) : getTodayDateKey(input.until);
  if (principalCents === 0 || accrualEnd <= accrualStart) return 0;

  let interestCents = 0;
  let cursor = accrualStart;
  while (cursor < accrualEnd) {
    const boundary = nextSemesterStart(cursor);
    const segmentEnd = boundary < accrualEnd ? boundary : accrualEnd;
    const days = getCalendarDayDifference(cursor, segmentEnd);
    interestCents += (principalCents * getLegalInterestRate(cursor) * days) / 365;
    cursor = segmentEnd;
  }
  return toEuros(Math.round(interestCents));
}

// Solde à prélever, intérêts L214-2 déduits (jamais négatif).
export function getBalanceAmountDue(input: { balanceAmount: number; depositAmount: number; depositPaidAt: Date | null; startDate: Date | string }) {
  const balanceCents = toCents(input.balanceAmount);
  if (!input.depositPaidAt) return { interest: 0, amountDue: toEuros(balanceCents) };
  const interest = calculateAdvanceInterest({ amount: input.depositAmount, paidAt: input.depositPaidAt, until: toDateKey(input.startDate) });
  const interestCents = Math.min(balanceCents, toCents(interest));
  return { interest: toEuros(interestCents), amountDue: toEuros(balanceCents - interestCents) };
}

// ---------------------------------------------------------------------------
// Consentement au prélèvement du solde (transaction initiée par le marchand)
// ---------------------------------------------------------------------------

export type BalanceMandateTerms = {
  depositAmount: number;
  balanceAmount: number;
  // Date calendaire (AAAA-MM-JJ, heure de Paris) du prélèvement prévu.
  balanceDueDate: string;
};

export function getBalanceMandateTerms(split: PaymentPlanSplit, startDate: Date | string): BalanceMandateTerms | null {
  if (split.plan !== "DEPOSIT_BALANCE") return null;
  return {
    depositAmount: split.depositAmount,
    balanceAmount: split.balanceAmount,
    balanceDueDate: getTodayDateKey(getBalanceSchedule(startDate).dueAt),
  };
}

// Le navigateur renvoie les conditions affichées au client : elles doivent
// correspondre exactement à celles recalculées par le serveur.
export function isBalanceMandateConsentValid(consent: unknown, terms: BalanceMandateTerms) {
  if (!consent || typeof consent !== "object") return false;
  const value = consent as Record<string, unknown>;
  return value.accepted === true
    && typeof value.balanceAmount === "number"
    && toCents(value.balanceAmount) === toCents(terms.balanceAmount)
    && value.balanceDueDate === terms.balanceDueDate;
}

export function formatPlanDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}
