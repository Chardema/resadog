import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import {
  sendBookingConfirmationEmail,
  sendBookingRefundCompletedEmail,
  sendBookingRefundFailedAdminEmail,
  sendBookingTeamCancellationEmail,
  sendBookingRequestEmail,
  sendNewBookingAdminEmail,
  sendPaymentFailedEmail,
  sendSubscriptionPaymentFailedAdminEmail,
  sendSubscriptionRefundCompletedEmail,
} from "@/lib/email";
import { ensureBookingInvoice } from "@/lib/booking-invoices";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { awardBookingLoyalty } from "@/lib/loyalty-ledger";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { readCheckoutDepositRecord } from "@/lib/checkout-payment-plan";
import {
  ensureBalanceInstallment,
  isDepositBalanceBooking,
  sendDepositConfirmationEmail,
} from "@/lib/booking-balance";
import {
  assertExpiryNotified,
  expireAuthorizationFromCharge,
  expireBookingAuthorization,
} from "@/lib/authorization-expiry";
import {
  handleBalancePaymentFailed,
  isBalancePaymentIntentMetadata,
  releaseExpiredBalanceCheckout,
  settleBalanceSucceeded,
} from "@/lib/balance-collection";
import { getDepositPlanTeamRefundState, syncBalanceRefund } from "@/lib/deposit-cancellation";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  let claimedEvent: { id: string; attemptToken: string } | null = null;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Signature invalide" },
        { status: 400 }
      );
    }

    const claim = await claimWebhookEvent(event);
    if (claim === "PROCESSED") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claim === "PROCESSING") {
      return NextResponse.json({ error: "Événement déjà en cours de traitement" }, { status: 409 });
    }
    claimedEvent = { id: event.id, attemptToken: claim };

    // Gérer les événements Stripe
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      // Expiration d'une autorisation non capturée (spec 07, lot 4).
      case "payment_intent.canceled":
        assertExpiryNotified(await expireBookingAuthorization(event.data.object as Stripe.PaymentIntent));
        break;

      case "charge.expired":
        assertExpiryNotified(await expireAuthorizationFromCharge(event.data.object as Stripe.Charge));
        break;

      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        await handleRefundChanged(event.data.object as Stripe.Refund);
        break;

      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }

    const completed = await prisma.stripeWebhookEvent.updateMany({
      where: { id: event.id, attemptToken: claim, status: "PROCESSING" },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    if (completed.count !== 1) throw new Error(`Verrou webhook perdu pour ${event.id}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    if (claimedEvent) {
      await prisma.stripeWebhookEvent.deleteMany({
        where: claimedEvent,
      }).catch((cleanupError) => console.error("Nettoyage du verrou webhook impossible:", cleanupError));
    }
    console.error("Erreur dans le webhook Stripe:", error);
    return NextResponse.json(
      { error: "Erreur du webhook" },
      { status: 500 }
    );
  }
}

async function claimWebhookEvent(event: Stripe.Event): Promise<string | "PROCESSED" | "PROCESSING"> {
  const attemptToken = randomUUID();

  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        status: "PROCESSING",
        attemptToken,
      },
    });
    return attemptToken;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
  if (!existing) throw new Error(`Événement webhook ${event.id} introuvable après conflit`);
  if (existing.status === "PROCESSED") return "PROCESSED";

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const reclaimed = await prisma.stripeWebhookEvent.updateMany({
    where: {
      id: event.id,
      status: "PROCESSING",
      attemptToken: existing.attemptToken,
      updatedAt: { lte: staleBefore },
    },
    data: { attemptToken },
  });

  return reclaimed.count === 1 ? attemptToken : "PROCESSING";
}

// ... (existing helper functions) ...

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await prisma.userSubscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "CANCELED" }
    });

    const localSubscription = await prisma.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      select: {
        user: { select: { email: true, name: true } },
      },
    });
    if (!localSubscription) return;

    const invoices = await stripe.invoices.list({
      subscription: subscription.id,
      status: "paid",
      limit: 10,
    });
    const latestPaidInvoice = invoices.data.find((invoice) => invoice.amount_paid > 0);
    if (!latestPaidInvoice) return;

    const invoicePayments = await stripe.invoicePayments.list({
      invoice: latestPaidInvoice.id,
      status: "paid",
      limit: 10,
    });
    const paymentIntentId = invoicePayments.data
      .map((invoicePayment) => invoicePayment.payment.payment_intent)
      .map((paymentIntent) => typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id)
      .find((value): value is string => Boolean(value));
    if (!paymentIntentId) return;

    const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
    const refund = refunds.data.find((candidate) =>
      candidate.status === "succeeded" &&
      candidate.metadata?.type === "subscription_refund" &&
      candidate.metadata?.stripeSubscriptionId === subscription.id
    );
    if (!refund) return;

    await sendSubscriptionRefundCompletedEmail(
      localSubscription.user.email,
      localSubscription.user.name || "Client",
      { amount: refund.amount / 100, refundId: refund.id },
      { idempotencyKey: `subscription-refund-completed-${refund.id}` }
    );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    // Si l'abonnement est annulé à la fin de la période, le statut Stripe reste 'active' mais 'cancel_at_period_end' est true.
    // On peut stocker ça si on veut afficher "Fin le..."
    await prisma.userSubscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { 
            status: subscription.status === 'active' ? 'ACTIVE' : subscription.status.toUpperCase() 
        }
    });
}

// Extraire le subscription ID depuis une Invoice (Stripe SDK v20+)
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const sub = invoice.parent?.subscription_details?.subscription;
    if (!sub) return null;
    return typeof sub === 'string' ? sub : sub.id;
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    if (invoice.billing_reason !== "subscription_cycle") return;

    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;

    await prisma.userSubscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: "ACTIVE" }
    });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice);

    if (!subscriptionId) return;

    const subscription = await prisma.userSubscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        include: { user: true }
    });

    if (!subscription) return;

    // Marquer l'abonnement comme impayé
    await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' }
    });

    // Notifier le client par email
    if (subscription.user.email) {
        try {
            await sendPaymentFailedEmail(
                subscription.user.email,
                subscription.user.name || 'Client'
            );
        } catch (emailError) {
            console.error("Email d'échec de paiement non envoyé:", emailError);
        }
    }

    // Notifier l'admin
    try {
        await sendSubscriptionPaymentFailedAdminEmail(
            subscription.user.name || 'Client',
            subscriptionId,
            subscription.price
        );
    } catch (emailError) {
        console.error("Notification admin d'échec non envoyée:", emailError);
    }
}

// Helper to extract booking IDs
function getBookingIds(metadata: Stripe.Metadata | null | undefined): string[] {
    if (!metadata) return [];
    if (metadata.bookingIds) return metadata.bookingIds.split(",");
    if (metadata.bookingId) return [metadata.bookingId];
    return [];
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata.type === "additional_charge") {
    const idempotencyKey = paymentIntent.metadata.idempotencyKey;
    await prisma.additionalCharge.updateMany({
      where: idempotencyKey
        ? { OR: [{ stripePaymentId: paymentIntent.id }, { idempotencyKey }] }
        : { stripePaymentId: paymentIntent.id },
      data: {
        stripePaymentId: paymentIntent.id,
        status: "SUCCEEDED",
        chargedAt: new Date(),
      },
    });
    return;
  }

  // Solde du plan acompte (spec 07, lot 5) : seule l'échéance passe SUCCEEDED,
  // puis la facture finale. Ni confirmation, ni fidélité, ni e-mail d'acompte.
  if (isBalancePaymentIntentMetadata(paymentIntent.metadata)) {
    await settleBalanceSucceeded(paymentIntent, { invoice: true });
    return;
  }

  const bookingIds = getBookingIds(paymentIntent.metadata);

  if (bookingIds.length === 0) {
    // Les PaymentIntents d'abonnement n'ont pas de réservation associée.
    return;
  }

  // Récupérer le Payment Method attaché
  const paymentMethodId = paymentIntent.payment_method as string;
  let paymentMethod: Stripe.PaymentMethod | null = null;
  
  if (paymentMethodId) {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  }

  // Mettre à jour le Payment dans la BDD
  await prisma.payment.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: {
      status: "SUCCEEDED",
      paidAt: new Date(),
      capturedAmount: paymentIntent.amount_received / 100,
      paymentMethod: paymentMethodId,
    },
  });

  // 🔑 CLEF : Sauvegarder le Payment Method sur l'utilisateur
  const userId = paymentIntent.metadata.userId;
  if (userId && paymentMethod?.card) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        paymentMethodId: paymentMethodId,
        cardLast4: paymentMethod.card.last4,
        cardBrand: paymentMethod.card.brand,
      },
    });
  }

  // Le webhook répare une validation interrompue après la capture Stripe.
  await prisma.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: {
      depositPaid: true,
    },
  });

  for (const bookingId of bookingIds) {
    const repaired = await prisma.booking.updateMany({
      where: { id: bookingId, status: "ACCEPTING" },
      data: { status: "CONFIRMED" },
    });

    if (repaired.count === 1) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { client: true, pets: true, pet: true, payment: true },
      });
      // Plan acompte : la validation interrompue n'a peut-être pas créé l'échéance du solde.
      if (booking && isDepositBalanceBooking(booking)) {
        await ensureBalanceInstallment(prisma, booking);
      }
      if (booking) {
        try {
          if (isDepositBalanceBooking(booking)) {
            await sendDepositConfirmationEmail(booking);
          } else {
            await sendBookingConfirmationEmail(
              booking.client.email,
              booking.client.name || "Client",
              getBookingEmailDetails(booking),
              { idempotencyKey: `booking-confirmation-${booking.id}` }
            );
          }
        } catch (emailError) {
          console.error(`Email de confirmation non envoyé pour ${booking.id}:`, emailError);
        }
      }
    }
    await awardBookingLoyalty(bookingId);
  }

  await ensureBookingInvoice(paymentIntent);

}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata.type === "additional_charge") {
    const idempotencyKey = paymentIntent.metadata.idempotencyKey;
    await prisma.additionalCharge.updateMany({
      where: idempotencyKey
        ? { OR: [{ stripePaymentId: paymentIntent.id }, { idempotencyKey }] }
        : { stripePaymentId: paymentIntent.id },
      data: { stripePaymentId: paymentIntent.id, status: "FAILED" },
    });
    return;
  }

  // Échec du solde : le paiement de l'acompte et la réservation ne bougent pas.
  if (isBalancePaymentIntentMetadata(paymentIntent.metadata)) {
    // Lève une erreur si l'e-mail d'échec n'est pas parti : Stripe rejoue.
    await handleBalancePaymentFailed(paymentIntent);
    return;
  }

  await prisma.payment.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: {
      status: "FAILED",
    },
  });

  const bookingIds = getBookingIds(paymentIntent.metadata);
  if (bookingIds.length > 0) {
    await prisma.booking.updateMany({
      where: { id: { in: bookingIds }, status: "ACCEPTING" },
      data: { status: "PENDING" },
    });
  }

}

async function handleRefundChanged(refund: Stripe.Refund) {
  if (refund.metadata?.type === "subscription_refund") {
    if (refund.status !== "succeeded") return;

    const stripeSubscriptionId = refund.metadata.stripeSubscriptionId;
    if (!stripeSubscriptionId) return;

    const [stripeSubscription, localSubscription] = await Promise.all([
      stripe.subscriptions.retrieve(stripeSubscriptionId),
      prisma.userSubscription.findUnique({
        where: { stripeSubscriptionId },
        select: { user: { select: { email: true, name: true } } },
      }),
    ]);
    if (stripeSubscription.status !== "canceled" || !localSubscription) return;

    await sendSubscriptionRefundCompletedEmail(
      localSubscription.user.email,
      localSubscription.user.name || "Client",
      { amount: refund.amount / 100, refundId: refund.id },
      { idempotencyKey: `subscription-refund-completed-${refund.id}` }
    );
    return;
  }

  const paymentIntentId = typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id;
  if (!paymentIntentId || !refund.status) return;

  const bookingId = refund.metadata?.bookingId;
  const payments = await prisma.payment.findMany({
    where: bookingId
      ? { bookingId, stripePaymentId: paymentIntentId }
      : { stripePaymentId: paymentIntentId },
    include: {
      booking: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          totalPrice: true,
          serviceType: true,
          status: true,
          cancellationOrigin: true,
          cancellationReason: true,
          paymentPlan: true,
          client: { select: { name: true, email: true } },
          pets: { select: { name: true } },
          pet: { select: { name: true } },
        },
      },
    },
  });
  // Plan acompte : le remboursement du solde porte sur le PaymentIntent de
  // l'échéance, jamais sur celui de l'acompte (Payment).
  if (payments.length === 0) {
    await handleBalanceRefundChanged(refund);
    return;
  }
  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  const activeRefunds = refunds.data.filter((item) =>
    item.status === "pending" || item.status === "requires_action" || item.status === "succeeded"
  );
  const activeRefundCents = activeRefunds.reduce((total, item) => total + item.amount, 0);

  for (const payment of payments) {
    const cumulativeRefundCents = Math.min(
      Math.round(payment.capturedAmount * 100),
      activeRefundCents
    );
    const refundAmount = cumulativeRefundCents / 100;

    if (refund.status === "failed" || refund.status === "canceled") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: refundAmount >= payment.capturedAmount && payment.capturedAmount > 0
            ? "REFUNDED"
            : refundAmount > 0
              ? "PARTIALLY_REFUNDED"
              : payment.capturedAmount > 0
                ? "SUCCEEDED"
                : "FAILED",
          refundedAt: activeRefunds.some((item) => item.status === "succeeded")
            ? payment.refundedAt || new Date()
            : null,
          refundAmount,
          stripeRefundId: refund.id,
          refundStatus: refund.status === "failed" ? "FAILED" : "CANCELED",
          refundFailureReason: refund.failure_reason || "Remboursement refusé par Stripe",
        },
      });
      await sendBookingRefundFailedAdminEmail(
        {
          bookingId: payment.bookingId,
          clientName: payment.booking.client.name || "Client",
          clientEmail: payment.booking.client.email,
          refundId: refund.id,
          amount: refund.amount / 100,
          failureReason: refund.failure_reason || "Remboursement refusé par Stripe",
        },
        { idempotencyKey: `refund-failed-${refund.id}` }
      );
      continue;
    }

    const refundStatus = refund.status === "succeeded"
      ? "SUCCEEDED"
      : refund.status === "requires_action"
        ? "REQUIRES_ACTION"
        : "PENDING";
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: refundAmount >= payment.capturedAmount ? "REFUNDED" : "PARTIALLY_REFUNDED",
        refundedAt: refund.status === "succeeded" ? new Date() : payment.refundedAt,
        refundAmount,
        stripeRefundId: refund.id,
        refundStatus,
        refundFailureReason: null,
      },
    });

    const refundFullySucceeded =
      refundStatus === "SUCCEEDED" &&
      refundAmount >= payment.capturedAmount &&
      activeRefunds.every((item) => item.status === "succeeded");
    if (refundFullySucceeded && payment.booking.cancellationOrigin === "TEAM") {
      if (payment.booking.status === "CANCELLING") {
        throw new Error(`Annulation ${payment.bookingId} encore en cours pendant la confirmation du remboursement`);
      }
      if (payment.booking.status !== "CANCELLED") continue;

      if (payment.booking.paymentPlan === "DEPOSIT_BALANCE") {
        // Acompte et solde remboursés tous deux : e-mails avec le cumul.
        await sendDepositPlanTeamRefundEmails(payment.bookingId, refund.id);
        continue;
      }

      const bookingDetails = getBookingEmailDetails(payment.booking);
      if (!payment.refundStartedEmailSentAt) {
        await sendBookingTeamCancellationEmail(
          payment.booking.client.email,
          payment.booking.client.name || "Client",
          payment.booking.cancellationReason || "Annulation par La Patte Dorée",
          bookingDetails,
          {
            idempotencyKey: `booking-team-cancellation-${payment.bookingId}`,
            paymentAction: "REFUND_PENDING",
            amountRefunded: refundAmount,
          }
        );
        await prisma.payment.update({
          where: { id: payment.id },
          data: { refundStartedEmailSentAt: new Date() },
        });
      }

      if (payment.refundCompletedEmailSentAt) continue;
      await sendBookingRefundCompletedEmail(
        payment.booking.client.email,
        payment.booking.client.name || "Client",
        bookingDetails,
        { amount: refundAmount, refundId: refund.id },
        { idempotencyKey: `booking-refund-completed-${payment.bookingId}` }
      );
      await prisma.payment.update({
        where: { id: payment.id },
        data: { refundCompletedEmailSentAt: new Date() },
      });
    }
  }
}

// Remboursement du solde (plan acompte) : cumul sur l'échéance, alerte en cas
// d'échec, e-mails de fin de remboursement d'une annulation par l'équipe.
async function handleBalanceRefundChanged(refund: Stripe.Refund) {
  const sync = await syncBalanceRefund(refund);
  if (!sync) return;

  const booking = await prisma.booking.findUnique({
    where: { id: sync.bookingId },
    select: { status: true, cancellationOrigin: true, client: { select: { name: true, email: true } } },
  });
  if (!booking) return;

  if (sync.failed) {
    await sendBookingRefundFailedAdminEmail(
      {
        bookingId: sync.bookingId,
        clientName: booking.client.name || "Client",
        clientEmail: booking.client.email,
        refundId: refund.id,
        amount: refund.amount / 100,
        failureReason: refund.failure_reason || "Remboursement refusé par Stripe",
      },
      { idempotencyKey: `refund-failed-${refund.id}` }
    );
    return;
  }

  if (booking.cancellationOrigin !== "TEAM") return;
  if (booking.status === "CANCELLING") {
    throw new Error(`Annulation ${sync.bookingId} encore en cours pendant la confirmation du remboursement du solde`);
  }
  if (booking.status === "CANCELLED") await sendDepositPlanTeamRefundEmails(sync.bookingId, refund.id);
}

async function sendDepositPlanTeamRefundEmails(bookingId: string, refundId: string) {
  const state = await getDepositPlanTeamRefundState(bookingId);
  if (!state.complete) return;
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: { include: { client: true, pets: true, pet: true } } },
  });
  if (!payment) return;
  const bookingDetails = getBookingEmailDetails(payment.booking);

  if (!payment.refundStartedEmailSentAt) {
    await sendBookingTeamCancellationEmail(
      payment.booking.client.email,
      payment.booking.client.name || "Client",
      payment.booking.cancellationReason || "Annulation par La Patte Dorée",
      bookingDetails,
      {
        idempotencyKey: `booking-team-cancellation-${bookingId}`,
        paymentAction: "REFUND_PENDING",
        amountRefunded: state.amount,
      }
    );
    await prisma.payment.update({ where: { id: payment.id }, data: { refundStartedEmailSentAt: new Date() } });
  }
  if (payment.refundCompletedEmailSentAt) return;
  await sendBookingRefundCompletedEmail(
    payment.booking.client.email,
    payment.booking.client.name || "Client",
    bookingDetails,
    { amount: state.amount, refundId },
    { idempotencyKey: `booking-refund-completed-${bookingId}` }
  );
  await prisma.payment.update({ where: { id: payment.id }, data: { refundCompletedEmailSentAt: new Date() } });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Gestion ABONNEMENT
  if (session.mode === "subscription") {
      const subscriptionId = session.subscription as string;
      const metadata = session.metadata;
      
      if (!metadata || !metadata.userId) {
          console.error("❌ Metadata manquantes pour l'abonnement");
          return;
      }

      // Créer ou synchroniser l'abonnement Premium en base. Aucun crédit n'est attribué.
      await prisma.userSubscription.upsert({
          where: { userId: metadata.userId },
          update: {
              stripeSubscriptionId: subscriptionId,
              status: "ACTIVE",
              createdAt: new Date(),
              price: session.amount_total ? session.amount_total / 100 : 0,
          },
          create: {
              userId: metadata.userId,
              stripeSubscriptionId: subscriptionId,
              status: "ACTIVE",
              price: session.amount_total ? session.amount_total / 100 : 0,
          }
      });

      return;
  }

  // Session de reprise du solde (lot 5) : payment_intent.succeeded fait le
  // reste. Elle ne doit jamais toucher le paiement de l'acompte.
  if (isBalancePaymentIntentMetadata(session.metadata)) return;

  // Gestion RÉSERVATION (existant)
  const bookingIds = getBookingIds(session.metadata);

  if (bookingIds.length === 0) {
    console.error("Pas de bookingIds dans les metadata de la session");
    return;
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error("PaymentIntent absent de la session Checkout terminée");
  }

  await prisma.checkoutAttempt.updateMany({
    where: { stripeSessionId: session.id },
    data: { status: "COMPLETED" },
  });

  await prisma.payment.updateMany({
    where: { bookingId: { in: bookingIds } },
    data: {
      stripePaymentId: paymentIntentId,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      status: "PROCESSING",
    },
  });

  await storeCheckoutDepositPlan(session, paymentIntentId, bookingIds);

  // Incrémenter le coupon si utilisé (le code est stocké dans les metadata)
  const promoCode = session.metadata?.promoCode;
  if (promoCode) {
    await prisma.$transaction(async (tx) => {
      const redeemed = await tx.booking.updateMany({
        where: { id: { in: bookingIds }, couponRedeemedAt: null },
        data: { couponRedeemedAt: new Date() },
      });
      if (redeemed.count > 0) {
        await tx.coupon.updateMany({
          where: { code: promoCode.toUpperCase(), isActive: true },
          data: { currentUses: { increment: redeemed.count } },
        });
      }
    });
  }

  // Conditions du paiement en deux fois rappelées dans l'e-mail « demande reçue ».
  const depositPlanTerms = readCheckoutDepositRecord(session.metadata)?.terms ?? null;

  // Boucler pour envoyer les emails pour CHAQUE réservation
  for (const id of bookingIds) {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { client: true, pets: true, pet: true }
      });

      if (booking) {
        const bookingDetails = getBookingEmailDetails(booking);

        try {
          await sendBookingRequestEmail(
            booking.client.email,
            booking.client.name || "Client",
            bookingDetails.petName,
            depositPlanTerms ? { ...bookingDetails, depositPlan: depositPlanTerms } : bookingDetails,
            { idempotencyKey: `booking-request-${booking.id}` }
          );
        } catch (emailError) {
          console.error(`Email client non envoyé pour la réservation ${id}:`, emailError);
        }

        try {
          await sendNewBookingAdminEmail(
            {
              bookingId: booking.id,
              petName: bookingDetails.petName,
              userName: booking.client.name || "Client",
              userEmail: booking.client.email,
              startDate: bookingDetails.startDate,
              endDate: bookingDetails.endDate,
              totalPrice: booking.totalPrice,
              serviceLabel: bookingDetails.serviceLabel,
            },
            { idempotencyKey: `new-booking-admin-${booking.id}` }
          );
        } catch (emailError) {
          console.error(`Notification admin non envoyée pour la réservation ${id}:`, emailError);
        }
      } else {
        console.error(`❌ Réservation ${id} introuvable en base !`);
      }
  }

}

// Plan acompte + solde (spec 07) : la session porte les conditions acceptées.
// On les fige sur la réservation avec la carte enregistrée pour le solde.
// Sans métadonnées de plan (FULL, ou drapeau désactivé), rien ne change.
async function storeCheckoutDepositPlan(
  session: Stripe.Checkout.Session,
  paymentIntentId: string,
  bookingIds: string[],
) {
  const record = readCheckoutDepositRecord(session.metadata);
  if (!record) return;
  if (bookingIds.length !== 1) {
    throw new Error(`Plan acompte sur ${bookingIds.length} réservations pour la session ${session.id}`);
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const paymentMethodId = typeof paymentIntent.payment_method === "string"
    ? paymentIntent.payment_method
    : paymentIntent.payment_method?.id;
  if (!paymentMethodId) {
    throw new Error(`Carte absente du PaymentIntent ${paymentIntentId} (plan acompte)`);
  }

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { bookingId: bookingIds[0], stripePaymentId: paymentIntentId },
      data: { stripePaymentMethodId: paymentMethodId },
    }),
    prisma.booking.updateMany({
      where: { id: bookingIds[0] },
      data: {
        paymentPlan: "DEPOSIT_BALANCE",
        depositAmount: record.terms.depositAmount,
        balanceAmount: record.terms.balanceAmount,
        balanceDueAt: record.balanceDueAt,
        mandateAcceptedAt: record.mandateAcceptedAt,
        mandateLegalVersion: record.mandateLegalVersion,
      },
    }),
  ]);
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  if (isBalancePaymentIntentMetadata(session.metadata)) {
    await releaseExpiredBalanceCheckout(session);
    return;
  }

  const bookingIds = getBookingIds(session.metadata);
  if (bookingIds.length === 0) return;

  await prisma.checkoutAttempt.updateMany({
    where: { stripeSessionId: session.id },
    data: { status: "EXPIRED" },
  });

  await prisma.$transaction(async (tx) => {
    // Une ancienne session expirée ne doit jamais supprimer une tentative plus
    // récente : on ne nettoie que le Payment rattaché à cette session précise.
    const abandonedBookings = await tx.booking.findMany({
      where: {
        id: { in: bookingIds },
        status: "PENDING",
        depositPaid: false,
        OR: [
          { payment: { is: null } },
          {
            payment: {
              is: {
                stripeCheckoutSessionId: session.id,
                stripePaymentId: null,
                status: { not: "SUCCEEDED" },
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    const abandonedBookingIds = abandonedBookings.map((booking) => booking.id);
    if (abandonedBookingIds.length === 0) return;

    await tx.payment.deleteMany({
      where: {
        bookingId: { in: abandonedBookingIds },
        stripeCheckoutSessionId: session.id,
        stripePaymentId: null,
        status: { not: "SUCCEEDED" },
      },
    });

    await tx.booking.deleteMany({
      where: {
        id: { in: abandonedBookingIds },
        status: "PENDING",
        depositPaid: false,
        payment: { is: null },
      },
    });
  });
}
