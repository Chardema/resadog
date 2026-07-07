import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { sendBookingRequestEmail, sendAdminNotification, sendPaymentFailedEmail } from "@/lib/email";
import { SERVICE_TYPES, type AppServiceType } from "@/lib/services";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

function getMetadataServiceType(serviceType: string | undefined): AppServiceType {
  return SERVICE_TYPES.includes(serviceType as AppServiceType)
    ? (serviceType as AppServiceType)
    : "DOG_WALKING";
}

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

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

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
    if (invoice.billing_reason === 'subscription_cycle') {
        const subscriptionId = getSubscriptionIdFromInvoice(invoice);
        if (!subscriptionId) return;

        const subscription = await prisma.userSubscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId }
        });

        if (subscription) {
            const creditsGranted = subscription.billingPeriod === "YEARLY"
                ? subscription.creditsPerMonth * 12
                : subscription.creditsPerMonth;
            await prisma.creditBatch.upsert({
                where: { stripeSourceId: invoice.id },
                update: {},
                create: {
                    stripeSourceId: invoice.id,
                    userId: subscription.userId,
                    amount: creditsGranted,
                    remaining: creditsGranted,
                    serviceType: subscription.serviceType,
                    expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
                }
            });
        }
    }
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
        await sendAdminNotification(
            `⚠️ Paiement échoué`,
            subscription.user.name || 'Client',
            `Abonnement ${subscriptionId}`,
            `Statut: PAST_DUE`,
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

  // Le statut métier est piloté par l'admin. Le webhook confirme uniquement
  // que le paiement a été capturé, sans écraser CONFIRMED par une valeur obsolète.
  await prisma.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: {
      depositPaid: true,
    },
  });

}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await prisma.payment.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: {
      status: "FAILED",
    },
  });

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

      const serviceType = getMetadataServiceType(metadata.serviceType);

      // Créer ou synchroniser l'abonnement en base. Le webhook peut arriver après une réparation côté dashboard.
      await prisma.userSubscription.upsert({
          where: { userId: metadata.userId },
          update: {
              stripeSubscriptionId: subscriptionId,
              status: "ACTIVE",
              createdAt: new Date(),
              serviceType,
              daysPerWeek: parseInt(metadata.daysPerWeek),
              creditsPerMonth: parseInt(metadata.creditsPerMonth),
              price: session.amount_total ? session.amount_total / 100 : 0,
              billingPeriod: metadata.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY",
          },
          create: {
              userId: metadata.userId,
              stripeSubscriptionId: subscriptionId,
              status: "ACTIVE",
              serviceType,
              daysPerWeek: parseInt(metadata.daysPerWeek),
              creditsPerMonth: parseInt(metadata.creditsPerMonth),
              price: session.amount_total ? session.amount_total / 100 : 0,
              billingPeriod: metadata.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY",
          }
      });

      // checkout.session.completed est idempotent au niveau de l'événement : ce lot
      // correspond toujours au premier paiement de ce nouvel abonnement.
      const monthlyCredits = parseInt(metadata.creditsPerMonth);
      const creditsGranted = metadata.billingCycle === "YEARLY" ? monthlyCredits * 12 : monthlyCredits;
      await prisma.creditBatch.upsert({
          where: { stripeSourceId: session.id },
          update: {},
          create: {
              stripeSourceId: session.id,
              userId: metadata.userId,
              amount: creditsGranted,
              remaining: creditsGranted,
              serviceType,
              expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
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

  await prisma.payment.updateMany({
    where: { bookingId: { in: bookingIds } },
    data: {
      stripePaymentId: paymentIntentId,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      status: "PROCESSING",
    },
  });

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

  // Boucler pour envoyer les emails pour CHAQUE réservation
  for (const id of bookingIds) {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { client: true, pets: true, pet: true }
      });

      if (booking) {
        const petsName = booking.pets.length > 0 
            ? booking.pets.map(p => p.name).join(", ") 
            : (booking.pet?.name || "Animal");

        try {
          await sendBookingRequestEmail(
            booking.client.email,
            booking.client.name || "Client",
            petsName
          );

          await sendAdminNotification(
            petsName,
            booking.client.name || "Client",
            new Date(booking.startDate).toLocaleDateString("fr-FR"),
            new Date(booking.endDate).toLocaleDateString("fr-FR"),
            booking.totalPrice
          );
        } catch (emailError) {
          console.error(`Notifications non envoyées pour la réservation ${id}:`, emailError);
        }
      } else {
        console.error(`❌ Réservation ${id} introuvable en base !`);
      }
  }

}
