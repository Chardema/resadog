import type { Payment, Prisma, RefundStatus } from "@prisma/client";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/config";

export type TeamCancellationPaymentAction =
  | "NO_PAYMENT"
  | "AUTHORIZATION_RELEASED"
  | "REFUND_SUCCEEDED"
  | "REFUND_PENDING";

export type TeamCancellationPaymentResult = {
  action: TeamCancellationPaymentAction;
  amountRefunded: number;
  refundId: string | null;
  refundStatus: RefundStatus | null;
  paymentUpdate: Prisma.PaymentUpdateInput | null;
};

export class TeamCancellationPaymentError extends Error {
  constructor(message: string, public readonly statusCode: 409 | 502 = 502) {
    super(message);
    this.name = "TeamCancellationPaymentError";
  }
}

type StripeRefundStatus = NonNullable<Stripe.Refund["status"]>;

const ACTIVE_REFUND_STATUSES = new Set<StripeRefundStatus>([
  "pending",
  "requires_action",
  "succeeded",
]);

function toRefundStatus(status: Stripe.Refund["status"]): RefundStatus {
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

function releasedAuthorizationUpdate(): Prisma.PaymentUpdateInput {
  return {
    status: "REFUNDED",
    capturedAmount: 0,
    refundedAt: new Date(),
    refundAmount: 0,
    stripeRefundId: null,
    refundStatus: null,
    refundFailureReason: null,
  };
}

async function cancelPaymentIntent(bookingId: string, paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.status === "canceled") return paymentIntent;

  return stripe.paymentIntents.cancel(
    paymentIntent.id,
    { cancellation_reason: "abandoned" },
    { idempotencyKey: `booking:${bookingId}:team-release-authorization` }
  );
}

async function processTeamCancellationPaymentInternal(
  bookingId: string,
  payment: Payment | null
): Promise<TeamCancellationPaymentResult> {
  if (!payment) {
    return {
      action: "NO_PAYMENT",
      amountRefunded: 0,
      refundId: null,
      refundStatus: null,
      paymentUpdate: null,
    };
  }

  if (!payment.stripePaymentId) {
    if (payment.status === "SUCCEEDED" || payment.capturedAmount > 0) {
      throw new TeamCancellationPaymentError(
        "Paiement encaissé sans identifiant Stripe : remboursement manuel requis avant l'annulation.",
        409
      );
    }

    return {
      action: "AUTHORIZATION_RELEASED",
      amountRefunded: 0,
      refundId: null,
      refundStatus: null,
      paymentUpdate: releasedAuthorizationUpdate(),
    };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);

  if (
    paymentIntent.status === "requires_capture" ||
    paymentIntent.status === "requires_payment_method" ||
    paymentIntent.status === "requires_confirmation" ||
    paymentIntent.status === "requires_action" ||
    paymentIntent.status === "processing" ||
    paymentIntent.status === "canceled"
  ) {
    await cancelPaymentIntent(bookingId, paymentIntent);
    return {
      action: "AUTHORIZATION_RELEASED",
      amountRefunded: 0,
      refundId: null,
      refundStatus: null,
      paymentUpdate: releasedAuthorizationUpdate(),
    };
  }

  if (paymentIntent.status !== "succeeded") {
    throw new TeamCancellationPaymentError(
      `Le paiement Stripe ne peut pas être annulé maintenant (statut : ${paymentIntent.status}).`
    );
  }

  const existingRefunds = await stripe.refunds.list({
    payment_intent: paymentIntent.id,
    limit: 100,
  });
  const activeExistingRefunds = existingRefunds.data.filter(
    (refund) => refund.status && ACTIVE_REFUND_STATUSES.has(refund.status)
  );
  const alreadyRefundedCents = activeExistingRefunds.reduce(
    (total, refund) => total + refund.amount,
    0
  );

  let trackedRefund = activeExistingRefunds[0] || null;
  let totalRefundedCents = alreadyRefundedCents;

  if (alreadyRefundedCents < paymentIntent.amount_received) {
    trackedRefund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent.id,
        metadata: {
          bookingId,
          cancellationOrigin: "TEAM",
        },
      },
      { idempotencyKey: `booking:${bookingId}:team-cancellation-refund` }
    );

    if (!trackedRefund.status || !ACTIVE_REFUND_STATUSES.has(trackedRefund.status)) {
      throw new TeamCancellationPaymentError(
        `Le remboursement Stripe a échoué (statut : ${trackedRefund.status || "inconnu"}).`
      );
    }

    totalRefundedCents += trackedRefund.amount;
  }

  if (!trackedRefund?.status) {
    throw new TeamCancellationPaymentError("Stripe n'a renvoyé aucun remboursement exploitable.");
  }

  const refundStatus = toRefundStatus(trackedRefund.status);
  const amountRefunded = Math.min(totalRefundedCents, paymentIntent.amount_received) / 100;
  const refundSucceeded = refundStatus === "SUCCEEDED";

  return {
    action: refundSucceeded ? "REFUND_SUCCEEDED" : "REFUND_PENDING",
    amountRefunded,
    refundId: trackedRefund.id,
    refundStatus,
    paymentUpdate: {
      status: amountRefunded >= paymentIntent.amount_received / 100
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED",
      capturedAmount: paymentIntent.amount_received / 100,
      refundedAt: refundSucceeded ? new Date() : null,
      refundAmount: amountRefunded,
      stripeRefundId: trackedRefund.id,
      refundStatus,
      refundFailureReason: null,
    },
  };
}

export async function processTeamCancellationPayment(
  bookingId: string,
  payment: Payment | null
): Promise<TeamCancellationPaymentResult> {
  try {
    return await processTeamCancellationPaymentInternal(bookingId, payment);
  } catch (error) {
    if (error instanceof TeamCancellationPaymentError) throw error;
    console.error("Erreur Stripe pendant l'annulation par l'équipe:", error);
    throw new TeamCancellationPaymentError(
      "Impossible de libérer ou rembourser le paiement Stripe. Réessayez dans quelques instants."
    );
  }
}
