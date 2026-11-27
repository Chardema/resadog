import type Stripe from "stripe";
import type { BookingInstallment, InstallmentStatus, Payment, Prisma, RefundStatus } from "@prisma/client";
import { releaseCheckoutLock } from "@/lib/balance-collection";
import { prisma } from "@/lib/db/prisma";
import {
  getBookingStartsAt,
  getDepositCancellationOutcome,
  type DepositCancellationActor,
  type DepositCancellationOutcome,
  type DepositCancellationTier,
} from "@/lib/payment-plan";
import { stripe } from "@/lib/stripe/config";

// Lot 6 de la spec 07 : annulation d'une réservation DEPOSIT_BALANCE.
// Deux PaymentIntents peuvent porter de l'argent : l'acompte (Payment de la
// réservation, autorisé puis capturé à l'acceptation) et le solde (échéance
// BookingInstallment BALANCE, prélevé à J-7). Le barème §5.6 est calculé par
// getDepositCancellationOutcome ; ce module l'exécute sur le bon PaymentIntent.
//
// Garanties :
// - l'échéance du solde est fermée (CANCELED) avant tout appel Stripe : ni le
//   cron ni la reprise Checkout ne peuvent plus débiter pendant l'annulation ;
// - un prélèvement en cours (PROCESSING) ou une session de reprise déjà payée
//   bloque l'annulation (409) : on ne rembourse jamais un montant inconnu ;
// - chaque capture, libération ou remboursement porte une clé d'idempotence
//   propre au PaymentIntent visé : un rejeu ne rembourse jamais deux fois ;
// - la retenue est toujours bornée aux sommes réellement encaissées.
// Le plan FULL ne passe jamais par ce module.

export class DepositCancellationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 409 | 502 = 409,
    // Solde en cours de prélèvement ou de reprise : réessayer suffit.
    public readonly balanceBusy = false
  ) {
    super(message);
    this.name = "DepositCancellationError";
  }
}

export const BALANCE_REFUND_TYPE = "booking_balance_refund";

const toCents = (amount: number) => Math.round(amount * 100);

// Acompte jamais autorisé ou encore en cours : l'équipe l'annule sans frais.
const TEAM_RELEASABLE_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_capture",
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

type StripeRefundStatus = NonNullable<Stripe.Refund["status"]>;
const ACTIVE_REFUND_STATUSES = new Set<StripeRefundStatus>(["pending", "requires_action", "succeeded"]);

export function toRefundStatus(status: Stripe.Refund["status"]): RefundStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "requires_action":
      return "REQUIRES_ACTION";
    case "succeeded":
      return "SUCCEEDED";
    case "failed":
      return "FAILED";
    case "canceled":
    default:
      return "CANCELED";
  }
}

// Statut agrégé de plusieurs remboursements : réussi seulement si tous le sont.
export function combineRefundStatuses(statuses: (RefundStatus | null)[]): RefundStatus | null {
  const present = statuses.filter((status): status is RefundStatus => Boolean(status));
  if (present.length === 0) return null;
  if (present.includes("REQUIRES_ACTION")) return "REQUIRES_ACTION";
  if (present.some((status) => status !== "SUCCEEDED")) return "PENDING";
  return "SUCCEEDED";
}

// ---------------------------------------------------------------------------
// Échéance du solde : fermeture avant annulation, restauration en cas d'échec
// ---------------------------------------------------------------------------

export type BalanceInstallmentSnapshot = Pick<
  BookingInstallment,
  "id" | "status" | "amount" | "stripePaymentIntentId" | "stripeCheckoutSessionId" | "refundedAmount" | "nextAttemptAt"
>;

export type BalanceCancellationClaim = {
  installment: BalanceInstallmentSnapshot | null;
  // Statut avant fermeture, pour restaurer l'échéance si l'annulation échoue.
  closedFrom: { status: InstallmentStatus; nextAttemptAt: Date | null } | null;
};

/**
 * Ferme l'échéance du solde (SCHEDULED / FAILED → CANCELED) avant de toucher
 * à Stripe. Une session de reprise encore ouverte est expirée d'abord.
 */
export async function claimBalanceForCancellation(bookingId: string, now = new Date()): Promise<BalanceCancellationClaim> {
  const installment = await prisma.bookingInstallment.findFirst({
    where: { bookingId, kind: "BALANCE" },
    select: {
      id: true,
      status: true,
      amount: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
      refundedAmount: true,
      nextAttemptAt: true,
    },
  });
  if (!installment) return { installment: null, closedFrom: null };

  if (installment.status === "PROCESSING") {
    throw new DepositCancellationError("Le prélèvement du solde est en cours : réessayez dans quelques minutes.", 409, true);
  }
  if (installment.status !== "SCHEDULED" && installment.status !== "FAILED") {
    return { installment, closedFrom: null };
  }

  const lock = await releaseCheckoutLock(installment, now, { expireOpen: true });
  if (lock === "COMPLETE") {
    throw new DepositCancellationError("Le solde vient d'être réglé : rechargez la page avant d'annuler.", 409, true);
  }
  if (lock !== "FREE") {
    throw new DepositCancellationError("Un paiement du solde est en cours : réessayez dans quelques minutes.", 409, true);
  }

  const closedFrom = { status: installment.status, nextAttemptAt: installment.nextAttemptAt };
  const closed = await prisma.bookingInstallment.updateMany({
    where: { id: installment.id, status: closedFrom.status, stripeCheckoutSessionId: null },
    data: { status: "CANCELED", nextAttemptAt: null },
  });
  if (closed.count !== 1) {
    throw new DepositCancellationError("Le solde de la réservation vient d'être modifié. Rechargez la page.", 409, true);
  }
  return {
    installment: { ...installment, status: "CANCELED", stripeCheckoutSessionId: null, nextAttemptAt: null },
    closedFrom,
  };
}

// Ne lève jamais : appelée depuis les chemins d'erreur des routes.
export async function restoreBalanceAfterFailedCancellation(claim: BalanceCancellationClaim | null) {
  if (!claim?.installment || !claim.closedFrom) return;
  await prisma.bookingInstallment.updateMany({
    where: { id: claim.installment.id, status: "CANCELED" },
    data: { status: claim.closedFrom.status, nextAttemptAt: claim.closedFrom.nextAttemptAt },
  }).catch((error) => console.error(`Échéance du solde ${claim.installment?.id} non restaurée :`, error));
}

/**
 * Non-présentation d'une réservation DEPOSIT_BALANCE : ferme l'échéance si le
 * solde n'est pas encaissé (aucun prélèvement ultérieur) et renvoie le
 * montant du solde réellement encaissé, seul retenable avec l'acompte.
 */
export async function getNoShowBalance(bookingId: string, now = new Date()) {
  const claim = await claimBalanceForCancellation(bookingId, now);
  const installment = claim.installment;
  if (!installment || installment.status === "CANCELED") return { ...claim, collectedCents: 0 };

  try {
    if (installment.status !== "SUCCEEDED" || installment.refundedAmount || !installment.stripePaymentIntentId) {
      throw new DepositCancellationError("Solde remboursé ou à vérifier : traiter cette situation individuellement.");
    }
    const [intent, refunds] = await Promise.all([
      stripe.paymentIntents.retrieve(installment.stripePaymentIntentId),
      stripe.refunds.list({ payment_intent: installment.stripePaymentIntentId, limit: 1 }),
    ]);
    if (intent.status !== "succeeded" || intent.currency !== "eur"
      || refunds.data.some((refund) => !["failed", "canceled"].includes(refund.status || ""))) {
      throw new DepositCancellationError("Le paiement du solde nécessite une vérification ; aucune annulation effectuée.");
    }
    return { ...claim, collectedCents: intent.amount_received };
  } catch (error) {
    await restoreBalanceAfterFailedCancellation(claim);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Remboursement borné au reste encaissé (rejeu sûr)
// ---------------------------------------------------------------------------

type RefundResult = { refund: Stripe.Refund | null; refundedCents: number; refundStatus: RefundStatus | null };

/**
 * Rembourse `targetCents` au plus sur le PaymentIntent, déduction faite des
 * remboursements déjà actifs (Dashboard, rejeu après coupure). La clé
 * d'idempotence est propre au PaymentIntent et à l'origine de l'annulation.
 */
async function refundUpTo(
  paymentIntent: Stripe.PaymentIntent,
  targetCents: number,
  { idempotencyKey, metadata }: { idempotencyKey: string; metadata: Stripe.MetadataParam }
): Promise<RefundResult> {
  if (targetCents <= 0) return { refund: null, refundedCents: 0, refundStatus: null };
  const existing = await stripe.refunds.list({ payment_intent: paymentIntent.id, limit: 100 });
  const active = existing.data.filter((refund) => refund.status && ACTIVE_REFUND_STATUSES.has(refund.status));
  const alreadyCents = active.reduce((total, refund) => total + refund.amount, 0);
  const missingCents = Math.min(targetCents, paymentIntent.amount_received) - alreadyCents;

  if (missingCents <= 0) {
    const tracked = active[0] ?? null;
    return {
      refund: tracked,
      refundedCents: Math.min(alreadyCents, paymentIntent.amount_received),
      refundStatus: combineRefundStatuses(active.map((refund) => toRefundStatus(refund.status))),
    };
  }

  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntent.id, amount: missingCents, metadata },
    { idempotencyKey }
  );
  if (!refund.status || !ACTIVE_REFUND_STATUSES.has(refund.status)) {
    throw new DepositCancellationError(`Le remboursement Stripe a échoué (statut : ${refund.status || "inconnu"}).`, 502);
  }
  return {
    refund,
    refundedCents: Math.min(alreadyCents + refund.amount, paymentIntent.amount_received),
    refundStatus: combineRefundStatuses([...active.map((item) => toRefundStatus(item.status)), toRefundStatus(refund.status)]),
  };
}

// ---------------------------------------------------------------------------
// Exécution du barème (client, rétractation, équipe)
// ---------------------------------------------------------------------------

export type DepositPlanCancellationBooking = {
  id: string;
  totalPrice: number;
  startDate: Date;
  startTime: string | null;
  payment: Payment | null;
};

export type DepositPlanCancellationResult = {
  tier: DepositCancellationTier;
  outcome: DepositCancellationOutcome;
  // Sommes remboursées (PaymentIntents déjà capturés), acompte + solde.
  amountRefunded: number;
  // Autorisation de l'acompte libérée sans capture.
  amountReleased: number;
  // Sommes conservées (acompte capturé, solde encaissé).
  amountRetained: number;
  refundId: string | null;
  refundStatus: RefundStatus | null;
  paymentUpdate: Prisma.PaymentUpdateInput | null;
  installmentUpdate: { id: string; data: Prisma.BookingInstallmentUpdateInput } | null;
};

const ORIGIN_KEYS: Record<DepositCancellationActor, string> = {
  CLIENT: "client",
  WITHDRAWAL: "withdrawal",
  TEAM: "team",
  PAYMENT_DEFAULT: "payment-default",
};

export const getDepositCancellationKey = (
  bookingId: string,
  actor: DepositCancellationActor,
  target: "deposit-release" | "deposit-capture" | "deposit-refund" | "balance-refund"
) => `booking:${bookingId}:${ORIGIN_KEYS[actor]}-cancellation:${target}`;

const metadataOrigin = (actor: DepositCancellationActor) => (actor === "TEAM" ? "TEAM" : "CLIENT");

/**
 * Applique le barème §5.6 : relit les deux PaymentIntents, calcule la retenue
 * bornée aux sommes encaissées, puis libère / capture / rembourse l'acompte et
 * rembourse le solde. L'échéance doit avoir été fermée par claimBalanceForCancellation.
 */
export async function processDepositPlanCancellation(input: {
  booking: DepositPlanCancellationBooking;
  balance: BalanceCancellationClaim | null;
  actor: DepositCancellationActor;
  now?: Date;
}): Promise<DepositPlanCancellationResult> {
  const { booking, actor } = input;
  const now = input.now ?? new Date();
  const payment = booking.payment;
  const installment = input.balance?.installment ?? null;

  if (payment && !payment.stripePaymentId && (payment.status === "SUCCEEDED" || payment.capturedAmount > 0)) {
    throw new DepositCancellationError("Acompte encaissé sans identifiant Stripe : remboursement manuel requis.");
  }
  if (installment && (installment.status === "SUCCEEDED" || installment.status === "REFUNDED") && !installment.stripePaymentIntentId) {
    throw new DepositCancellationError("Solde encaissé sans identifiant Stripe : remboursement manuel requis.");
  }

  const depositIntent = payment?.stripePaymentId ? await stripe.paymentIntents.retrieve(payment.stripePaymentId) : null;
  const balanceIntent = installment && (installment.status === "SUCCEEDED" || installment.status === "REFUNDED") && installment.stripePaymentIntentId
    ? await stripe.paymentIntents.retrieve(installment.stripePaymentIntentId)
    : null;

  // Acompte : montant autorisé tant qu'il n'est pas capturé, encaissé ensuite.
  let depositCents = 0;
  // L'équipe libère aussi un acompte jamais autorisé (comme pour le plan FULL).
  const releasableByTeam = actor === "TEAM" && Boolean(depositIntent && TEAM_RELEASABLE_STATUSES.has(depositIntent.status));
  if (depositIntent && !releasableByTeam) {
    if (depositIntent.status === "requires_capture") depositCents = depositIntent.amount_capturable || depositIntent.amount;
    else if (depositIntent.status === "succeeded") depositCents = depositIntent.amount_received;
    else if (depositIntent.status !== "canceled") {
      throw new DepositCancellationError(`L'acompte ne peut pas être annulé maintenant (statut Stripe : ${depositIntent.status}).`, 502);
    }
  }
  if (balanceIntent && balanceIntent.status !== "succeeded") {
    throw new DepositCancellationError(`Le solde ne peut pas être remboursé maintenant (statut Stripe : ${balanceIntent.status}).`, 502);
  }
  const balanceCents = balanceIntent?.amount_received ?? 0;

  const outcome = getDepositCancellationOutcome({
    actor,
    totalPrice: booking.totalPrice,
    depositAmount: depositCents / 100,
    balanceCollectedAmount: balanceCents / 100,
    startsAt: getBookingStartsAt(booking.startDate, booking.startTime),
    cancelledAt: now,
  });

  const metadata = { bookingId: booking.id, cancellationOrigin: metadataOrigin(actor), cancellationTier: outcome.tier };
  let amountReleased = 0;
  let depositCapturedCents = depositIntent?.status === "succeeded" ? depositIntent.amount_received : 0;
  let depositRefund: RefundResult = { refund: null, refundedCents: 0, refundStatus: null };

  if (depositIntent && releasableByTeam) {
    await stripe.paymentIntents.cancel(
      depositIntent.id,
      { cancellation_reason: "abandoned" },
      { idempotencyKey: getDepositCancellationKey(booking.id, actor, "deposit-release") }
    );
    amountReleased = depositIntent.amount / 100;
  } else if (depositIntent?.status === "requires_capture") {
    const retainedCents = toCents(outcome.deposit.retained);
    if (retainedCents > 0) {
      const captured = await stripe.paymentIntents.capture(
        depositIntent.id,
        { amount_to_capture: retainedCents },
        { idempotencyKey: getDepositCancellationKey(booking.id, actor, "deposit-capture") }
      );
      depositCapturedCents = captured.amount_received;
    } else {
      await stripe.paymentIntents.cancel(
        depositIntent.id,
        actor === "TEAM" ? { cancellation_reason: "abandoned" } : {},
        { idempotencyKey: getDepositCancellationKey(booking.id, actor, "deposit-release") }
      );
    }
    amountReleased = (depositCents - retainedCents) / 100;
  } else if (depositIntent?.status === "succeeded") {
    depositRefund = await refundUpTo(depositIntent, toCents(outcome.deposit.returned), {
      idempotencyKey: getDepositCancellationKey(booking.id, actor, "deposit-refund"),
      metadata,
    });
  }

  let balanceRefund: RefundResult = { refund: null, refundedCents: 0, refundStatus: null };
  if (balanceIntent && installment) {
    balanceRefund = await refundUpTo(balanceIntent, toCents(outcome.balance.returned), {
      idempotencyKey: getDepositCancellationKey(booking.id, actor, "balance-refund"),
      metadata: { ...metadata, type: BALANCE_REFUND_TYPE, installmentId: installment.id },
    });
  }

  const depositRefunded = depositRefund.refundedCents / 100;
  const depositCaptured = depositCapturedCents / 100;
  const paymentUpdate: Prisma.PaymentUpdateInput | null = payment
    ? {
        status: depositCaptured > 0 && depositRefunded >= depositCaptured
          ? "REFUNDED"
          : depositRefunded > 0
            ? "PARTIALLY_REFUNDED"
            : depositCaptured > 0
              ? "SUCCEEDED"
              : amountReleased > 0
                ? "REFUNDED"
                : payment.status,
        capturedAmount: depositCaptured,
        ...(depositCaptured > 0 && !payment.paidAt ? { paidAt: now } : {}),
        refundAmount: depositRefunded,
        refundedAt: depositRefund.refundStatus === "SUCCEEDED" || amountReleased > 0
          ? now
          : payment.refundedAt,
        stripeRefundId: depositRefund.refund?.id ?? null,
        refundStatus: depositRefund.refundStatus,
        refundFailureReason: null,
      }
    : null;

  const balanceRefunded = balanceRefund.refundedCents / 100;
  const installmentUpdate = installment && balanceIntent
    ? {
        id: installment.id,
        data: {
          refundedAmount: balanceRefunded,
          status: (balanceCents > 0 && balanceRefund.refundedCents >= balanceCents ? "REFUNDED" : "SUCCEEDED") as InstallmentStatus,
        },
      }
    : null;

  return {
    tier: outcome.tier,
    outcome,
    amountRefunded: (depositRefund.refundedCents + balanceRefund.refundedCents) / 100,
    amountReleased,
    amountRetained: (depositCapturedCents - depositRefund.refundedCents + balanceCents - balanceRefund.refundedCents) / 100,
    refundId: depositRefund.refund?.id ?? balanceRefund.refund?.id ?? null,
    refundStatus: combineRefundStatuses([depositRefund.refundStatus, balanceRefund.refundStatus]),
    paymentUpdate,
    installmentUpdate,
  };
}

// ---------------------------------------------------------------------------
// Webhook refund.* sur le PaymentIntent du solde
// ---------------------------------------------------------------------------

export type BalanceRefundSync = {
  bookingId: string;
  refundedAmount: number;
  failed: boolean;
};

/**
 * Remboursement du solde mis à jour par Stripe : recalcule le cumul actif sur
 * l'échéance. Renvoie null si le PaymentIntent n'est pas un solde connu.
 */
export async function syncBalanceRefund(refund: Stripe.Refund): Promise<BalanceRefundSync | null> {
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!paymentIntentId || !refund.status) return null;
  const installment = await prisma.bookingInstallment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, bookingId: true, status: true },
  });
  if (!installment) return null;

  const [paymentIntent, refunds] = await Promise.all([
    stripe.paymentIntents.retrieve(paymentIntentId),
    stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 }),
  ]);
  const activeCents = refunds.data
    .filter((item) => item.status && ACTIVE_REFUND_STATUSES.has(item.status))
    .reduce((total, item) => total + item.amount, 0);
  const refundedCents = Math.min(activeCents, paymentIntent.amount_received);

  if (installment.status === "SUCCEEDED" || installment.status === "REFUNDED") {
    await prisma.bookingInstallment.updateMany({
      where: { id: installment.id, status: { in: ["SUCCEEDED", "REFUNDED"] } },
      data: {
        refundedAmount: refundedCents / 100,
        status: paymentIntent.amount_received > 0 && refundedCents >= paymentIntent.amount_received ? "REFUNDED" : "SUCCEEDED",
      },
    });
  }
  return {
    bookingId: installment.bookingId,
    refundedAmount: refundedCents / 100,
    failed: refund.status === "failed" || refund.status === "canceled",
  };
}

/**
 * Annulation par l'équipe d'une réservation DEPOSIT_BALANCE : le
 * remboursement est terminé quand l'acompte et le solde encaissés sont
 * intégralement remboursés, tous remboursements réussis.
 */
export async function getDepositPlanTeamRefundState(bookingId: string) {
  const [payment, installment] = await Promise.all([
    prisma.payment.findUnique({ where: { bookingId } }),
    prisma.bookingInstallment.findFirst({
      where: { bookingId, kind: "BALANCE" },
      select: { status: true, stripePaymentIntentId: true },
    }),
  ]);

  let amountCents = 0;
  const intents = [payment?.stripePaymentId, installment && (installment.status === "SUCCEEDED" || installment.status === "REFUNDED")
    ? installment.stripePaymentIntentId
    : null].filter((id): id is string => Boolean(id));
  for (const paymentIntentId of intents) {
    const [paymentIntent, refunds] = await Promise.all([
      stripe.paymentIntents.retrieve(paymentIntentId),
      stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 }),
    ]);
    const active = refunds.data.filter((item) => item.status && ACTIVE_REFUND_STATUSES.has(item.status));
    const refundedCents = active.reduce((total, item) => total + item.amount, 0);
    if (paymentIntent.amount_received === 0) continue;
    if (refundedCents < paymentIntent.amount_received || active.some((item) => item.status !== "succeeded")) {
      return { complete: false, amount: 0 };
    }
    amountCents += Math.min(refundedCents, paymentIntent.amount_received);
  }
  return { complete: amountCents > 0, amount: amountCents / 100 };
}
