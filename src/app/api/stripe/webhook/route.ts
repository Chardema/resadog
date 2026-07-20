import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import {
  sendBookingConfirmationEmail,
  sendBookingRequestEmail,
  sendNewBookingAdminEmail,
  sendPaymentFailedEmail,
  sendSubscriptionPaymentFailedAdminEmail,
} from "@/lib/email";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { awardBookingLoyalty } from "@/lib/loyalty-ledger";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import {
  WELCOME_OFFER_LOCK_ID,
  isWelcomeOfferCode,
} from "@/lib/welcome-offer";

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
        include: { client: true, pets: true, pet: true },
      });
      if (booking) {
        try {
          await sendBookingConfirmationEmail(
            booking.client.email,
            booking.client.name || "Client",
            getBookingEmailDetails(booking),
            { idempotencyKey: `booking-confirmation-${booking.id}` }
          );
        } catch (emailError) {
          console.error(`Email de confirmation non envoyé pour ${booking.id}:`, emailError);
        }
      }
    }
    await awardBookingLoyalty(bookingId);
  }

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

  // Incrémenter le coupon si utilisé (le code est stocké dans les metadata)
  const promoCode = session.metadata?.promoCode;
  if (promoCode && !isWelcomeOfferCode(promoCode)) {
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
            bookingDetails,
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

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  const bookingIds = getBookingIds(session.metadata);
  if (bookingIds.length === 0) return;

  await prisma.checkoutAttempt.updateMany({
    where: { stripeSessionId: session.id },
    data: { status: "EXPIRED" },
  });

  await prisma.$transaction(async (tx) => {
    if (isWelcomeOfferCode(session.metadata?.promoCode)) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WELCOME_OFFER_LOCK_ID})`;
    }

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
