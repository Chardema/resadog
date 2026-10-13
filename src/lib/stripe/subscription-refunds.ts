import Stripe from "stripe";
import { stripe } from "@/lib/stripe/config";

type RefundStatus = NonNullable<Stripe.Refund["status"]>;

const ACTIVE_REFUND_STATUSES = new Set<RefundStatus>([
  "pending",
  "requires_action",
  "succeeded",
]);

type RefundablePayment = {
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceCreatedAt: Date;
  currency: string;
  amountPaidCents: number;
  alreadyRefundedCents: number;
  refundableAmountCents: number;
  paymentIntentId: string | null;
  chargeId: string;
  latestRefundId: string | null;
  latestRefundStatus: RefundStatus | null;
  failedRefundCount: number;
};

export type SubscriptionRefundPreview = Omit<
  RefundablePayment,
  "paymentIntentId" | "chargeId" | "failedRefundCount"
>;

function objectId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function resolveCharge(invoicePayment: Stripe.InvoicePayment) {
  const directChargeId = objectId(invoicePayment.payment.charge);
  if (directChargeId) {
    return {
      charge: await stripe.charges.retrieve(directChargeId),
      paymentIntentId: null,
    };
  }

  const paymentIntentId = objectId(invoicePayment.payment.payment_intent);
  if (!paymentIntentId) return null;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge) return null;

  return {
    charge: typeof latestCharge === "string"
      ? await stripe.charges.retrieve(latestCharge)
      : latestCharge,
    paymentIntentId,
  };
}

async function getLatestPaidSubscriptionPayment(
  stripeSubscriptionId: string
): Promise<RefundablePayment | null> {
  const invoices = await stripe.invoices.list({
    subscription: stripeSubscriptionId,
    status: "paid",
    limit: 10,
  });
  const invoice = invoices.data.find((candidate) => candidate.amount_paid > 0);
  if (!invoice) return null;

  const invoicePayments = await stripe.invoicePayments.list({
    invoice: invoice.id,
    status: "paid",
    limit: 10,
  });
  const invoicePayment = invoicePayments.data.find((candidate) => candidate.amount_paid !== 0);
  if (!invoicePayment) return null;

  const resolved = await resolveCharge(invoicePayment);
  if (!resolved) return null;

  const refunds = await stripe.refunds.list({
    charge: resolved.charge.id,
    limit: 100,
  });
  const activeRefundCents = refunds.data
    .filter((refund) => refund.status && ACTIVE_REFUND_STATUSES.has(refund.status))
    .reduce((total, refund) => total + refund.amount, 0);
  const refundableBaseCents = Math.min(
    invoicePayment.amount_paid ?? invoice.amount_paid,
    resolved.charge.amount
  );
  const alreadyRefundedCents = Math.min(
    refundableBaseCents,
    Math.max(resolved.charge.amount_refunded, activeRefundCents)
  );

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    invoiceCreatedAt: new Date(invoice.created * 1000),
    currency: invoice.currency,
    amountPaidCents: refundableBaseCents,
    alreadyRefundedCents,
    refundableAmountCents: Math.max(0, refundableBaseCents - alreadyRefundedCents),
    paymentIntentId: resolved.paymentIntentId,
    chargeId: resolved.charge.id,
    latestRefundId: refunds.data[0]?.id ?? null,
    latestRefundStatus: refunds.data[0]?.status ?? null,
    failedRefundCount: refunds.data.filter((refund) =>
      refund.status === "failed" || refund.status === "canceled"
    ).length,
  };
}

export async function getSubscriptionRefundPreview(
  stripeSubscriptionId: string
): Promise<SubscriptionRefundPreview | null> {
  const payment = await getLatestPaidSubscriptionPayment(stripeSubscriptionId);
  if (!payment) return null;

  return {
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoiceNumber,
    invoiceCreatedAt: payment.invoiceCreatedAt,
    currency: payment.currency,
    amountPaidCents: payment.amountPaidCents,
    alreadyRefundedCents: payment.alreadyRefundedCents,
    refundableAmountCents: payment.refundableAmountCents,
    latestRefundId: payment.latestRefundId,
    latestRefundStatus: payment.latestRefundStatus,
  };
}

export async function refundLatestSubscriptionPayment(input: {
  stripeSubscriptionId: string;
  userId: string;
  adminUserId: string;
}) {
  const payment = await getLatestPaidSubscriptionPayment(input.stripeSubscriptionId);
  if (!payment) {
    throw new Error("Aucune échéance Premium payée et remboursable n'a été trouvée.");
  }

  let refund: Stripe.Refund | null = null;

  if (payment.refundableAmountCents > 0) {
    const idempotencyKey = [
      "subscription-refund-v1",
      input.stripeSubscriptionId,
      payment.invoiceId,
      payment.refundableAmountCents,
      payment.failedRefundCount,
    ].join("-");

    refund = await stripe.refunds.create(
      {
        amount: payment.refundableAmountCents,
        ...(payment.paymentIntentId
          ? { payment_intent: payment.paymentIntentId }
          : { charge: payment.chargeId }),
        reason: "requested_by_customer",
        metadata: {
          type: "subscription_refund",
          userId: input.userId,
          adminUserId: input.adminUserId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          invoiceId: payment.invoiceId,
        },
      },
      { idempotencyKey }
    );

    if (refund.status === "failed" || refund.status === "canceled") {
      throw new Error(
        refund.failure_reason || "Stripe a refusé le remboursement de l'abonnement."
      );
    }
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  if (stripeSubscription.status !== "canceled") {
    await stripe.subscriptions.cancel(input.stripeSubscriptionId, {
      invoice_now: false,
      prorate: false,
      cancellation_details: {
        comment: "Dernière échéance remboursée par l'administrateur La Patte Dorée",
      },
    });
  }

  return {
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoiceNumber,
    currency: payment.currency,
    refundId: refund?.id ?? payment.latestRefundId,
    refundStatus: refund?.status ?? payment.latestRefundStatus,
    refundedAmountCents: refund?.amount ?? 0,
    alreadyRefundedCents: payment.alreadyRefundedCents,
    subscriptionCanceled: true,
  };
}
