import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { getTodayDateKey } from "@/lib/booking-dates";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { BookingInvoiceAnomalyError, ensureBookingInvoice } from "@/lib/booking-invoices";
import { prisma } from "@/lib/db/prisma";
import { sendBookingBalanceAlertAdminEmail, sendBookingBalanceEmail } from "@/lib/email";
import { BOOKING_INVOICE_VERSION } from "@/lib/legal";
import { reverseBookingLoyalty } from "@/lib/loyalty-ledger";
import {
  BALANCE_REMINDER_DAYS_BEFORE,
  PAYMENT_PLAN_ENABLED,
  getBalanceAmountDue,
  getBalancePaymentStateFor,
  getBalanceSchedule,
  type BalancePaymentState,
  type BalanceSchedule,
} from "@/lib/payment-plan";
import { stripe } from "@/lib/stripe/config";

// Lot 5 de la spec 07 : prélèvement hors session du solde à J-7, reprise par
// Checkout après un échec, relances J-5 / J-3 et annulation pour défaut de
// paiement à J-2 12:00 (heure de Paris), acompte conservé.
//
// Garanties :
// - un seul débit par tentative : verrou en base (statut PROCESSING posé par
//   updateMany conditionnel) + clé d'idempotence Stripe booking:{id}:balance:{n} ;
// - un échec n'écrase jamais un succès (toutes les écritures d'échec exigent
//   le statut PROCESSING) ;
// - prélèvement automatique et session Checkout de reprise s'excluent (la
//   colonne stripeCheckoutSessionId bloque le prélèvement tant qu'une session
//   peut encore être payée) ;
// - le succès du solde ne touche ni la confirmation, ni la fidélité, ni
//   l'e-mail d'acompte : seule l'échéance passe SUCCEEDED, puis la facture finale.

export const isBalanceCollectionEnabled = () => PAYMENT_PLAN_ENABLED;

export const BALANCE_PAYMENT_INTENT_TYPE = "booking_balance";
export const BALANCE_COLLECTION_BATCH_SIZE = 20;
// Fenêtre de lecture : rappels J-14 compris.
const BALANCE_SCAN_LIMIT = 100;
// Une tentative restée PROCESSING au-delà est réconciliée avec Stripe.
export const BALANCE_PROCESSING_STALE_MINUTES = 30;
// Nouvelle tentative automatique au passage quotidien suivant (cron ±59 min).
export const BALANCE_RETRY_DELAY_HOURS = 20;
// Durée de vie de la session Checkout de reprise (minimum Stripe : 30 min).
export const BALANCE_CHECKOUT_MINUTES = 60;
// Session en cours de création (verrou posé avant l'appel Stripe).
const CHECKOUT_PENDING_PREFIX = "pending:";
const CHECKOUT_PENDING_STALE_MINUTES = 10;
const TIME_BUDGET_MS = 45_000;

export const BALANCE_DEFAULT_CANCELLATION_REASON =
  "Solde impayé à la date limite : annulation automatique, acompte conservé";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// Refus définitifs : une nouvelle tentative hors session est inutile, seul le
// client peut régler (authentification 3DS, nouvelle carte).
const NON_RETRYABLE_CODES = new Set([
  "authentication_required",
  "expired_card",
  "incorrect_number",
  "invalid_number",
  "invalid_expiry_month",
  "invalid_expiry_year",
  "lost_card",
  "stolen_card",
  "pickup_card",
  "fraudulent",
  "restricted_card",
  "missing_payment_method",
  "payment_method_not_available",
]);

export const isRetryableBalanceFailure = (code: string | null | undefined) => !NON_RETRYABLE_CODES.has(code || "");

export const getBalanceAttemptKey = (bookingId: string, attempt: number) => `booking:${bookingId}:balance:${attempt}`;

export const isBalancePaymentIntentMetadata = (metadata: Stripe.Metadata | null | undefined) =>
  metadata?.type === BALANCE_PAYMENT_INTENT_TYPE || metadata?.kind === BALANCE_PAYMENT_INTENT_TYPE;

// ---------------------------------------------------------------------------
// Date de référence injectable (tests en préproduction, jamais en production)
// ---------------------------------------------------------------------------

export function isReferenceDateInjectionAllowed(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV === "production") return false;
  // Sur Vercel, NODE_ENV vaut production y compris en préproduction : on s'y
  // fie seulement hors Vercel (développement local, Vitest).
  return Boolean(env.VERCEL_ENV) || env.NODE_ENV !== "production";
}

export function resolveReferenceDate(raw: string | null, env: Record<string, string | undefined> = process.env) {
  if (!raw) return { now: new Date() } as const;
  if (!isReferenceDateInjectionAllowed(env)) return { error: "Date de référence interdite en production" } as const;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { error: "Date de référence invalide" } as const;
  return { now: parsed } as const;
}

// ---------------------------------------------------------------------------
// Planification (pure)
// ---------------------------------------------------------------------------

const installmentInclude = {
  booking: { include: { client: true, pets: true, pet: true, payment: true } },
} as const;

export type BalanceInstallment = Prisma.BookingInstallmentGetPayload<{ include: typeof installmentInclude }>;

type PlanInput = Pick<
  BalanceInstallment,
  "status" | "dueAt" | "nextAttemptAt" | "lastAttemptAt" | "reminderSentAt" | "createdAt"
> & { booking: { startDate: Date } };

export type BalanceAction = "NOTICE" | "CHARGE" | "RECONCILE" | "REMIND" | "CANCEL";

const latestReminderAt = (schedule: BalanceSchedule, now: Date) =>
  schedule.reminderAts.filter((at) => at.getTime() <= now.getTime()).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

const reminderStageLabel = (schedule: BalanceSchedule, at: Date) => {
  const index = schedule.reminderAts.findIndex((candidate) => candidate.getTime() === at.getTime());
  return `J-${BALANCE_REMINDER_DAYS_BEFORE[index] ?? "?"}`;
};

export function planBalanceActions(installment: PlanInput, now: Date): BalanceAction[] {
  const schedule = getBalanceSchedule(installment.booking.startDate);
  const time = now.getTime();
  const { status } = installment;

  if (status === "PROCESSING") {
    const stale = !installment.lastAttemptAt
      || time - installment.lastAttemptAt.getTime() >= BALANCE_PROCESSING_STALE_MINUTES * MINUTE_MS;
    return stale ? ["RECONCILE"] : [];
  }
  if (status !== "SCHEDULED" && status !== "FAILED") return [];
  if (time >= schedule.finalDeadlineAt.getTime()) return ["CANCEL"];

  const actions: BalanceAction[] = [];
  const due = time >= installment.dueAt.getTime();
  if (status === "SCHEDULED") {
    if (due) return ["CHARGE"];
    const noticeDue = time >= schedule.noticeAt.getTime()
      && !installment.reminderSentAt
      && installment.createdAt.getTime() < schedule.noticeAt.getTime();
    return noticeDue ? ["NOTICE"] : [];
  }

  if (installment.nextAttemptAt && installment.nextAttemptAt.getTime() <= time) actions.push("CHARGE");
  const reminderAt = latestReminderAt(schedule, now);
  if (reminderAt && (!installment.reminderSentAt || installment.reminderSentAt.getTime() < reminderAt.getTime())) {
    actions.push("REMIND");
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Montant et métadonnées du PaymentIntent du solde
// ---------------------------------------------------------------------------

export function getInstallmentAmountDue(installment: Pick<BalanceInstallment, "amount" | "booking">) {
  const booking = installment.booking;
  return getBalanceAmountDue({
    balanceAmount: installment.amount,
    depositAmount: booking.payment?.capturedAmount || booking.depositAmount || 0,
    depositPaidAt: booking.payment?.paidAt ?? null,
    startDate: booking.startDate,
  });
}

export function getBalancePaymentMetadata(
  installment: Pick<BalanceInstallment, "id" | "bookingId" | "booking">,
  interest: number,
  origin: "off_session" | "checkout",
  attempt?: number
): Stripe.MetadataParam {
  return {
    type: BALANCE_PAYMENT_INTENT_TYPE,
    kind: BALANCE_PAYMENT_INTENT_TYPE,
    bookingId: installment.bookingId,
    installmentId: installment.id,
    userId: installment.booking.clientId,
    bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
    balanceInterest: interest.toFixed(2),
    origin,
    ...(attempt ? { attempt: String(attempt) } : {}),
    ...(installment.booking.mandateLegalVersion ? { mandateLegalVersion: installment.booking.mandateLegalVersion } : {}),
  };
}

const toCents = (amount: number) => Math.round(amount * 100);
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const bookingReference = (bookingId: string) => `#${bookingId.slice(-8).toUpperCase()}`;

function getEmailInput(installment: BalanceInstallment) {
  const booking = installment.booking;
  const schedule = getBalanceSchedule(booking.startDate);
  return {
    bookingId: booking.id,
    petName: getBookingEmailDetails(booking).petName,
    amount: getInstallmentAmountDue(installment).amountDue,
    dueDate: getTodayDateKey(installment.dueAt),
    deadlineDate: getTodayDateKey(schedule.finalDeadlineAt),
    startDate: booking.startDate.toISOString().slice(0, 10),
    depositAmount: booking.payment?.capturedAmount || booking.depositAmount || 0,
  };
}

function getAlertDetails(installment: BalanceInstallment, note?: string) {
  const booking = installment.booking;
  const details = getBookingEmailDetails(booking);
  const deadline = getBalanceSchedule(booking.startDate).finalDeadlineAt;
  return {
    bookingId: booking.id,
    petName: details.petName,
    userName: booking.client.name || "Client",
    userEmail: booking.client.email,
    startDate: details.startDate,
    amount: getInstallmentAmountDue(installment).amountDue,
    attempts: installment.attempts,
    lastErrorCode: installment.lastErrorCode,
    deadline: deadline.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }),
    note,
  };
}

async function loadInstallment(id: string) {
  return prisma.bookingInstallment.findUnique({ where: { id }, include: installmentInclude });
}

// ---------------------------------------------------------------------------
// Succès et échec (partagés par le cron et le webhook)
// ---------------------------------------------------------------------------

export type BalanceSettlement = "SUCCEEDED" | "ALREADY_SUCCEEDED" | "ANOMALY" | "IGNORED";

/**
 * Passe le solde SUCCEEDED. Idempotent ; ne touche ni la réservation, ni le
 * paiement de l'acompte, ni la fidélité. Avec invoice: true (webhook), émet la
 * facture finale : une erreur de facture remonte pour que Stripe rejoue.
 */
export async function settleBalanceSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  { now = new Date(), invoice = false }: { now?: Date; invoice?: boolean } = {}
): Promise<BalanceSettlement> {
  if (!isBalancePaymentIntentMetadata(paymentIntent.metadata) || paymentIntent.status !== "succeeded") return "IGNORED";
  const installmentId = paymentIntent.metadata.installmentId;
  if (!installmentId) throw new Error(`Échéance absente des métadonnées du solde ${paymentIntent.id}`);

  const installment = await loadInstallment(installmentId);
  if (!installment) throw new Error(`Échéance ${installmentId} introuvable pour ${paymentIntent.id}`);

  const updated = await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, status: { in: ["SCHEDULED", "PROCESSING", "FAILED"] } },
    data: {
      status: "SUCCEEDED",
      paidAt: now,
      stripePaymentIntentId: paymentIntent.id,
      lastErrorCode: null,
      nextAttemptAt: null,
    },
  });

  if (updated.count !== 1) {
    const current = (await loadInstallment(installment.id)) ?? installment;
    if (current.status === "SUCCEEDED" && current.stripePaymentIntentId === paymentIntent.id) {
      if (invoice) await issueFinalInvoice(paymentIntent, current);
      return "ALREADY_SUCCEEDED";
    }
    // Solde payé deux fois, ou payé après l'annulation : jamais de
    // remboursement automatique, l'équipe tranche.
    const note = current.status === "SUCCEEDED"
      ? `solde payé deux fois (${current.stripePaymentIntentId} puis ${paymentIntent.id})`
      : `solde payé (${paymentIntent.id}) alors que l'échéance est ${current.status}`;
    console.error(`Solde ${bookingReference(current.bookingId)} : ${note}`);
    await sendBookingBalanceAlertAdminEmail("ANOMALY", getAlertDetails(current, note), {
      idempotencyKey: `booking-balance-anomaly-${paymentIntent.id}`,
    });
    return "ANOMALY";
  }

  try {
    await sendBookingBalanceEmail(
      "PAID",
      installment.booking.client.email,
      installment.booking.client.name || "Client",
      { ...getEmailInput(installment), amount: paymentIntent.amount_received / 100 },
      { idempotencyKey: `booking-balance-paid-${installment.id}` }
    );
  } catch (error) {
    console.error(`E-mail « solde réglé » non envoyé pour ${installment.bookingId}:`, error);
  }

  if (invoice) await issueFinalInvoice(paymentIntent, installment);
  return "SUCCEEDED";
}

/**
 * Facture finale du solde. Une erreur transitoire (Stripe, réseau) remonte
 * pour que le webhook soit rejoué ; une incohérence durable de montants
 * n'interrompt jamais le webhook : l'équipe est alertée et facture à la main.
 */
async function issueFinalInvoice(paymentIntent: Stripe.PaymentIntent, installment: BalanceInstallment) {
  try {
    await ensureBookingInvoice(paymentIntent);
  } catch (error) {
    if (!(error instanceof BookingInvoiceAnomalyError)) throw error;
    console.error(`Facture finale ${bookingReference(installment.bookingId)} non émise :`, error.message);
    await sendBookingBalanceAlertAdminEmail(
      "ANOMALY",
      getAlertDetails(installment, `facture finale non émise (${error.message}) : à établir manuellement`),
      // Un échec d'envoi de l'alerte (transitoire) fait rejouer le webhook.
      { idempotencyKey: `booking-balance-invoice-anomaly-${paymentIntent.id}` }
    );
  }
}

export type BalanceFailureRecord = { recorded: boolean; retryAt: Date | null; notifyErrors: string[] };

/**
 * Enregistre l'échec d'une tentative hors session. N'agit que sur une échéance
 * PROCESSING : un succès (ou une annulation) n'est jamais écrasé.
 */
export async function recordBalanceFailure(
  installment: BalanceInstallment,
  { code, paymentIntentId, now }: { code: string; paymentIntentId?: string | null; now: Date }
): Promise<BalanceFailureRecord> {
  const deadline = getBalanceSchedule(installment.booking.startDate).finalDeadlineAt;
  const nextAttempt = new Date(now.getTime() + BALANCE_RETRY_DELAY_HOURS * HOUR_MS);
  const retryAt = isRetryableBalanceFailure(code) && nextAttempt.getTime() < deadline.getTime() ? nextAttempt : null;

  const updated = await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, status: "PROCESSING" },
    data: {
      status: "FAILED",
      lastErrorCode: code.slice(0, 100),
      nextAttemptAt: retryAt,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });
  if (updated.count !== 1) return { recorded: false, retryAt: null, notifyErrors: [] };

  // Premier échec : e-mail immédiat avec le lien de reprise. Les échecs
  // suivants passent par les relances J-5 / J-3.
  const notifyErrors: string[] = [];
  if (!installment.lastErrorCode) {
    try {
      await sendBookingBalanceEmail(
        "FAILED",
        installment.booking.client.email,
        installment.booking.client.name || "Client",
        getEmailInput(installment),
        { idempotencyKey: `booking-balance-failed-${installment.id}` }
      );
    } catch (error) {
      notifyErrors.push(`client: ${errorMessage(error)}`);
    }
  }
  return { recorded: true, retryAt, notifyErrors };
}

/**
 * Webhook payment_intent.payment_failed d'un solde. Lève une erreur si
 * l'e-mail d'échec n'a pas pu partir, pour que Stripe rejoue l'événement.
 */
export async function handleBalancePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  { now = new Date() } = {}
): Promise<BalanceFailureRecord> {
  const ignored: BalanceFailureRecord = { recorded: false, retryAt: null, notifyErrors: [] };
  if (!isBalancePaymentIntentMetadata(paymentIntent.metadata)) return ignored;
  // Sur Checkout, le client est encore sur la page de paiement et peut
  // réessayer : rien à enregistrer.
  if (paymentIntent.metadata.origin === "checkout") return ignored;
  const installment = paymentIntent.metadata.installmentId ? await loadInstallment(paymentIntent.metadata.installmentId) : null;
  if (!installment) return ignored;
  const error = paymentIntent.last_payment_error;
  const record = await recordBalanceFailure(installment, {
    code: error?.decline_code || error?.code || "payment_failed",
    paymentIntentId: paymentIntent.id,
    now,
  });

  // Rejeu après un premier échec déjà enregistré (par le cron ou par un
  // passage précédent du webhook) : l'e-mail d'échec est renvoyé avec la même
  // clé d'idempotence, Resend ne le délivre qu'une fois.
  if (!record.recorded && installment.status === "FAILED" && installment.attempts === 1
    && installment.stripePaymentIntentId === paymentIntent.id) {
    try {
      await sendBookingBalanceEmail(
        "FAILED",
        installment.booking.client.email,
        installment.booking.client.name || "Client",
        getEmailInput(installment),
        { idempotencyKey: `booking-balance-failed-${installment.id}` }
      );
    } catch (sendError) {
      record.notifyErrors.push(`client: ${errorMessage(sendError)}`);
    }
  }

  if (record.notifyErrors.length > 0) {
    throw new Error(`Solde ${paymentIntent.id} : échec enregistré, e-mail à renvoyer (${record.notifyErrors.join(" ; ")})`);
  }
  return record;
}

// ---------------------------------------------------------------------------
// Session Checkout de reprise (exclusion mutuelle avec le prélèvement)
// ---------------------------------------------------------------------------

const isPendingCheckout = (value: string | null) => Boolean(value?.startsWith(CHECKOUT_PENDING_PREFIX));

const isStalePendingCheckout = (value: string, now: Date) => {
  const startedAt = new Date(value.slice(CHECKOUT_PENDING_PREFIX.length)).getTime();
  return !Number.isFinite(startedAt) || now.getTime() - startedAt >= CHECKOUT_PENDING_STALE_MINUTES * MINUTE_MS;
};

export type CheckoutLock = "FREE" | "OPEN" | "COMPLETE";

/**
 * Libère la session de reprise si elle ne peut plus être payée. Avec
 * expireOpen (annulation J-2, annulation client ou équipe, non-présentation),
 * une session encore ouverte est expirée d'abord.
 */
export async function releaseCheckoutLock(
  installment: Pick<BalanceInstallment, "id" | "stripeCheckoutSessionId">,
  now: Date,
  { expireOpen = false } = {}
): Promise<CheckoutLock> {
  const sessionId = installment.stripeCheckoutSessionId;
  if (!sessionId) return "FREE";

  if (isPendingCheckout(sessionId)) {
    if (!isStalePendingCheckout(sessionId, now)) return "OPEN";
  } else {
    let session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open" && expireOpen) {
      session = await stripe.checkout.sessions.expire(sessionId).catch(() => stripe.checkout.sessions.retrieve(sessionId));
    }
    if (session.status === "complete") return "COMPLETE";
    if (session.status === "open") return "OPEN";
  }

  const released = await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, stripeCheckoutSessionId: sessionId },
    data: { stripeCheckoutSessionId: null },
  });
  return released.count === 1 ? "FREE" : "OPEN";
}

export type BalanceCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "NOT_FOUND" | "NOT_PAYABLE" | "ALREADY_PAID" | "IN_PROGRESS" | "DEADLINE_PASSED" | "BUSY" };

export async function findClientBalanceInstallment(bookingId: string, userId: string) {
  return prisma.bookingInstallment.findFirst({
    where: { bookingId, kind: "BALANCE", booking: { clientId: userId, paymentPlan: "DEPOSIT_BALANCE" } },
    include: installmentInclude,
  });
}

export type { BalancePaymentState };

export function getBalancePaymentState(installment: Pick<BalanceInstallment, "status" | "booking">, now: Date): BalancePaymentState {
  return getBalancePaymentStateFor({
    installmentStatus: installment.status,
    bookingStatus: installment.booking.status,
    startDate: installment.booking.startDate,
  }, now);
}

/**
 * Crée une session Checkout fraîche pour régler le solde après un échec.
 * Une éventuelle session précédente encore ouverte est expirée : une seule
 * session payable à la fois, et aucun prélèvement automatique pendant ce temps.
 */
export async function createBalanceCheckoutSession(input: {
  bookingId: string;
  userId: string;
  returnBaseUrl: string;
  locale: Stripe.Checkout.SessionCreateParams.Locale;
  now?: Date;
}): Promise<BalanceCheckoutResult> {
  const now = input.now ?? new Date();
  const installment = await findClientBalanceInstallment(input.bookingId, input.userId);
  if (!installment) return { ok: false, reason: "NOT_FOUND" };

  const state = getBalancePaymentState(installment, now);
  if (state === "PAID") return { ok: false, reason: "ALREADY_PAID" };
  if (state === "IN_PROGRESS") return { ok: false, reason: "IN_PROGRESS" };
  if (state !== "PAYABLE") {
    return { ok: false, reason: installment.booking.status === "CONFIRMED" && installment.status === "FAILED" ? "DEADLINE_PASSED" : "NOT_PAYABLE" };
  }

  const previous = installment.stripeCheckoutSessionId;
  if (previous) {
    if (isPendingCheckout(previous) && !isStalePendingCheckout(previous, now)) return { ok: false, reason: "BUSY" };
    if (!isPendingCheckout(previous)) {
      let session = await stripe.checkout.sessions.retrieve(previous);
      if (session.status === "open") {
        session = await stripe.checkout.sessions.expire(previous).catch(() => stripe.checkout.sessions.retrieve(previous));
      }
      if (session.status === "complete") return { ok: false, reason: "IN_PROGRESS" };
      if (session.status === "open") return { ok: false, reason: "BUSY" };
    }
  }

  const pendingMarker = `${CHECKOUT_PENDING_PREFIX}${now.toISOString()}`;
  const claimed = await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, status: "FAILED", stripeCheckoutSessionId: previous },
    data: { stripeCheckoutSessionId: pendingMarker },
  });
  if (claimed.count !== 1) return { ok: false, reason: "BUSY" };

  const booking = installment.booking;
  const customerId = booking.payment?.stripeCustomerId;
  const { amountDue, interest } = getInstallmentAmountDue(installment);
  try {
    if (!customerId) throw new Error(`Client Stripe absent pour la réservation ${booking.id}`);
    const details = getBookingEmailDetails(booking);
    const metadata = getBalancePaymentMetadata(installment, interest, "checkout");
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        payment_method_types: ["card"],
        locale: input.locale,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: toCents(amountDue),
              product_data: {
                name: `Solde de la réservation ${bookingReference(booking.id)}`,
                description: `${details.serviceLabel} – ${details.petName} · ${details.startDate}`,
              },
            },
          },
        ],
        payment_intent_data: {
          description: `Solde de la réservation ${bookingReference(booking.id)}`,
          metadata,
        },
        metadata,
        success_url: `${input.returnBaseUrl}/dashboard/bookings/${booking.id}/pay?paid=1`,
        cancel_url: `${input.returnBaseUrl}/dashboard/bookings/${booking.id}/pay`,
        expires_at: Math.floor(now.getTime() / 1000) + BALANCE_CHECKOUT_MINUTES * 60,
      },
      { idempotencyKey: `booking:${booking.id}:balance-checkout:${now.getTime()}` }
    );
    if (!session.url) throw new Error(`URL Checkout absente pour ${session.id}`);

    await prisma.bookingInstallment.updateMany({
      where: { id: installment.id, stripeCheckoutSessionId: pendingMarker },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { ok: true, url: session.url };
  } catch (error) {
    await prisma.bookingInstallment.updateMany({
      where: { id: installment.id, stripeCheckoutSessionId: pendingMarker },
      data: { stripeCheckoutSessionId: null },
    }).catch(() => undefined);
    throw error;
  }
}

/** Webhook checkout.session.expired d'une session de reprise : libère le verrou. */
export async function releaseExpiredBalanceCheckout(session: Pick<Stripe.Checkout.Session, "id" | "metadata">) {
  const installmentId = session.metadata?.installmentId;
  if (!installmentId) return;
  await prisma.bookingInstallment.updateMany({
    where: { id: installmentId, stripeCheckoutSessionId: session.id },
    data: { stripeCheckoutSessionId: null },
  });
}

// ---------------------------------------------------------------------------
// Actions du cron
// ---------------------------------------------------------------------------

type ChargeOutcome = "SUCCEEDED" | "FAILED" | "PENDING" | "SKIPPED" | "UNKNOWN";

type StripeLikeError = {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
  payment_intent?: { id: string; status?: string } | null;
};

async function chargeBalance(
  installment: BalanceInstallment,
  now: Date,
  { reuseAttempt = false } = {}
): Promise<{ outcome: ChargeOutcome; firstFailure?: boolean; errors: string[] }> {
  const errors: string[] = [];
  const lock = await releaseCheckoutLock(installment, now);
  if (lock !== "FREE") return { outcome: "SKIPPED", errors };

  // Verrou : un seul passage peut poser PROCESSING pour cette tentative.
  const attempt = reuseAttempt ? installment.attempts : installment.attempts + 1;
  const claimed = reuseAttempt
    ? await prisma.bookingInstallment.updateMany({
        where: { id: installment.id, status: "PROCESSING", lastAttemptAt: installment.lastAttemptAt, stripeCheckoutSessionId: null },
        data: { lastAttemptAt: now },
      })
    : await prisma.bookingInstallment.updateMany({
        where: { id: installment.id, status: installment.status, attempts: installment.attempts, stripeCheckoutSessionId: null },
        data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: now, nextAttemptAt: null },
      });
  if (claimed.count !== 1) return { outcome: "SKIPPED", errors };

  const claimedInstallment = { ...installment, status: "PROCESSING" as const, attempts: attempt };
  const firstFailure = !installment.lastErrorCode;
  const fail = async (code: string, paymentIntentId?: string | null) => {
    const record = await recordBalanceFailure(claimedInstallment, { code, paymentIntentId, now });
    errors.push(...record.notifyErrors.map((message) => `${installment.bookingId}: ${message}`));
    return { outcome: "FAILED" as const, firstFailure: record.recorded && firstFailure, errors };
  };

  const booking = installment.booking;
  const customerId = booking.payment?.stripeCustomerId;
  const paymentMethodId = booking.payment?.stripePaymentMethodId;
  if (!customerId || !paymentMethodId) return fail("missing_payment_method");

  const { amountDue, interest } = getInstallmentAmountDue(installment);
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: toCents(amountDue),
        currency: "eur",
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Solde de la réservation ${bookingReference(booking.id)}`,
        metadata: getBalancePaymentMetadata(installment, interest, "off_session", attempt),
      },
      { idempotencyKey: getBalanceAttemptKey(booking.id, attempt) }
    );
  } catch (error) {
    const stripeError = error as StripeLikeError;
    if (stripeError?.type === "StripeCardError") {
      return fail(stripeError.decline_code || stripeError.code || "card_declined", stripeError.payment_intent?.id);
    }
    // Issue inconnue (réseau, API) : l'échéance reste PROCESSING et sera
    // réconciliée avec Stripe au prochain passage, jamais redébitée à l'aveugle.
    errors.push(`${booking.id}: ${errorMessage(error)}`);
    return { outcome: "UNKNOWN", errors };
  }

  if (paymentIntent.status === "succeeded") {
    await settleBalanceSucceeded(paymentIntent, { now });
    return { outcome: "SUCCEEDED", errors };
  }
  if (paymentIntent.status === "processing") {
    await prisma.bookingInstallment.updateMany({
      where: { id: installment.id, status: "PROCESSING" },
      data: { stripePaymentIntentId: paymentIntent.id },
    });
    return { outcome: "PENDING", errors };
  }
  const code = paymentIntent.status === "requires_action"
    ? "authentication_required"
    : paymentIntent.last_payment_error?.decline_code || paymentIntent.last_payment_error?.code || paymentIntent.status;
  return fail(code, paymentIntent.id);
}

/**
 * Tentative restée PROCESSING (passage interrompu) : on relit Stripe avant
 * toute nouvelle tentative pour ne jamais débiter deux fois.
 */
async function reconcileBalance(installment: BalanceInstallment, now: Date) {
  const result = await stripe.paymentIntents.search({
    query: `metadata['installmentId']:'${installment.id}'`,
    limit: 20,
  });
  const intents = result.data;
  const succeeded = intents.find((intent) => intent.status === "succeeded");
  if (succeeded) {
    await settleBalanceSucceeded(succeeded, { now });
    return { outcome: "SUCCEEDED" as ChargeOutcome, errors: [] as string[] };
  }
  if (intents.some((intent) => intent.status === "processing")) return { outcome: "PENDING" as ChargeOutcome, errors: [] };

  const current = intents.find((intent) => intent.metadata?.attempt === String(installment.attempts));
  if (current && current.status !== "canceled") {
    const record = await recordBalanceFailure(installment, {
      code: current.status === "requires_action"
        ? "authentication_required"
        : current.last_payment_error?.decline_code || current.last_payment_error?.code || current.status,
      paymentIntentId: current.id,
      now,
    });
    return { outcome: "FAILED" as ChargeOutcome, errors: record.notifyErrors };
  }
  // Aucun débit créé pour cette tentative : on la rejoue avec la même clé.
  return chargeBalance(installment, now, { reuseAttempt: true });
}

async function sendNotice(installment: BalanceInstallment, now: Date) {
  const cardLast4 = installment.booking.payment?.stripePaymentMethodId
    ? (await stripe.paymentMethods.retrieve(installment.booking.payment.stripePaymentMethodId).catch(() => null))?.card?.last4
    : null;
  await sendBookingBalanceEmail(
    "NOTICE",
    installment.booking.client.email,
    installment.booking.client.name || "Client",
    { ...getEmailInput(installment), cardLast4 },
    { idempotencyKey: `booking-balance-notice-${installment.id}` }
  );
  await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, reminderSentAt: null },
    data: { reminderSentAt: now },
  });
}

async function sendReminder(installment: BalanceInstallment, now: Date, { skipClient = false } = {}) {
  const schedule = getBalanceSchedule(installment.booking.startDate);
  const reminderAt = latestReminderAt(schedule, now);
  if (!reminderAt) return;
  const stage = reminderStageLabel(schedule, reminderAt);
  const errors: string[] = [];

  if (!skipClient) {
    await sendBookingBalanceEmail(
      "REMINDER",
      installment.booking.client.email,
      installment.booking.client.name || "Client",
      getEmailInput(installment),
      { idempotencyKey: `booking-balance-reminder-${installment.id}-${stage}` }
    ).catch((error) => errors.push(`client: ${errorMessage(error)}`));
  }
  await sendBookingBalanceAlertAdminEmail("REMINDER", getAlertDetails(installment, stage), {
    idempotencyKey: `booking-balance-reminder-admin-${installment.id}-${stage}`,
  }).catch((error) => errors.push(`admin: ${errorMessage(error)}`));

  if (errors.length > 0) throw new Error(errors.join(" ; "));
  await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, reminderSentAt: installment.reminderSentAt },
    data: { reminderSentAt: now },
  });
}

/**
 * Limite J-2 12:00 dépassée sans paiement : la réservation est annulée
 * (créneau libéré), l'acompte conservé, aucun remboursement ni prélèvement.
 */
async function cancelForPaymentDefault(installment: BalanceInstallment, now: Date) {
  const lock = await releaseCheckoutLock(installment, now, { expireOpen: true });
  if (lock !== "FREE") return false;

  const cancelled = await prisma.$transaction(async (tx) => {
    const closed = await tx.bookingInstallment.updateMany({
      where: { id: installment.id, status: { in: ["SCHEDULED", "FAILED"] }, stripeCheckoutSessionId: null },
      data: { status: "CANCELED", nextAttemptAt: null },
    });
    if (closed.count !== 1) return false;
    const booking = await tx.booking.updateMany({
      where: { id: installment.bookingId, status: "CONFIRMED" },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationOrigin: "PAYMENT_DEFAULT",
        cancellationReason: BALANCE_DEFAULT_CANCELLATION_REASON,
      },
    });
    if (booking.count !== 1) throw new Error(`Réservation ${installment.bookingId} plus confirmée : annulation abandonnée`);
    await reverseBookingLoyalty(installment.bookingId, "Réservation annulée : solde impayé", tx);
    return true;
  });
  if (!cancelled) return false;

  const errors: string[] = [];
  await sendBookingBalanceEmail(
    "DEFAULT_CANCELLED",
    installment.booking.client.email,
    installment.booking.client.name || "Client",
    getEmailInput(installment),
    { idempotencyKey: `booking-balance-default-${installment.id}` }
  ).catch((error) => errors.push(`client: ${errorMessage(error)}`));
  await sendBookingBalanceAlertAdminEmail("DEFAULT_CANCELLED", getAlertDetails(installment), {
    idempotencyKey: `booking-balance-default-admin-${installment.id}`,
  }).catch((error) => errors.push(`admin: ${errorMessage(error)}`));
  if (errors.length > 0) throw new Error(`annulée, e-mails non envoyés : ${errors.join(" ; ")}`);
  return true;
}

// ---------------------------------------------------------------------------
// Passage quotidien
// ---------------------------------------------------------------------------

export type BalanceCollectionReport = {
  dryRun: boolean;
  now: string;
  planned: { installmentId: string; bookingId: string; actions: BalanceAction[] }[];
  charged: number;
  succeeded: number;
  failed: number;
  pending: number;
  skipped: number;
  notices: number;
  reminders: number;
  cancelled: number;
  deferred: number;
  errors: string[];
};

export async function collectBalances({
  now = new Date(),
  dryRun = false,
  clock = () => Date.now(),
}: { now?: Date; dryRun?: boolean; clock?: () => number } = {}): Promise<BalanceCollectionReport> {
  const startedAt = clock();
  const report: BalanceCollectionReport = {
    dryRun,
    now: now.toISOString(),
    planned: [],
    charged: 0,
    succeeded: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    notices: 0,
    reminders: 0,
    cancelled: 0,
    deferred: 0,
    errors: [],
  };

  // Fenêtre : rappels J-14 inclus (échéance J-7 dans moins de 8 jours).
  const horizon = new Date(now.getTime() + 8 * 24 * HOUR_MS);
  const installments = await prisma.bookingInstallment.findMany({
    where: {
      kind: "BALANCE",
      status: { in: ["SCHEDULED", "FAILED", "PROCESSING"] },
      dueAt: { lte: horizon },
      booking: { status: "CONFIRMED", paymentPlan: "DEPOSIT_BALANCE" },
    },
    include: installmentInclude,
    orderBy: { dueAt: "asc" },
    take: BALANCE_SCAN_LIMIT,
  });

  for (const installment of installments) {
    const actions = planBalanceActions(installment, now);
    if (actions.length === 0) continue;
    report.planned.push({ installmentId: installment.id, bookingId: installment.bookingId, actions });
  }
  // dryRun : aucun appel Stripe, aucune écriture, aucun e-mail.
  if (dryRun) return report;

  const byId = new Map(installments.map((installment) => [installment.id, installment]));
  let stripeCalls = 0;
  for (const { installmentId, bookingId, actions } of report.planned) {
    const installment = byId.get(installmentId)!;
    const touchesStripe = actions.some((action) => action === "CHARGE" || action === "RECONCILE" || action === "CANCEL");
    if (clock() - startedAt > TIME_BUDGET_MS || (touchesStripe && stripeCalls >= BALANCE_COLLECTION_BATCH_SIZE)) {
      report.deferred += 1;
      continue;
    }
    if (touchesStripe) stripeCalls += 1;

    try {
      let charge: Awaited<ReturnType<typeof chargeBalance>> | null = null;
      if (actions.includes("CHARGE") || actions.includes("RECONCILE")) {
        charge = actions.includes("RECONCILE") ? await reconcileBalance(installment, now) : await chargeBalance(installment, now);
        report.errors.push(...charge.errors);
        if (actions.includes("CHARGE")) report.charged += 1;
        if (charge.outcome === "SUCCEEDED") report.succeeded += 1;
        else if (charge.outcome === "FAILED") report.failed += 1;
        else if (charge.outcome === "PENDING" || charge.outcome === "UNKNOWN") report.pending += 1;
        else report.skipped += 1;
      }
      if (actions.includes("NOTICE")) {
        await sendNotice(installment, now);
        report.notices += 1;
      }
      if (actions.includes("REMIND") && charge?.outcome !== "SUCCEEDED" && charge?.outcome !== "PENDING") {
        // Échec tout juste notifié : le client a déjà son e-mail, l'équipe est alertée.
        await sendReminder(installment, now, { skipClient: Boolean(charge?.firstFailure) });
        report.reminders += 1;
      }
      if (actions.includes("CANCEL")) {
        if (await cancelForPaymentDefault(installment, now)) report.cancelled += 1;
        else report.skipped += 1;
      }
    } catch (error) {
      report.errors.push(`${bookingId}: ${errorMessage(error)}`);
    }
  }
  return report;
}
