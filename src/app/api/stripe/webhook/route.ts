import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { sendBookingRequestEmail, sendAdminNotification, sendPaymentFailedEmail } from "@/lib/email";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
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

    // Idempotency: vérifier si cet événement a déjà été traité
    const existingEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });

    if (existingEvent) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Enregistrer l'événement AVANT le traitement pour éviter les doublons en cas de retry
    await prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });

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

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur dans le webhook Stripe:", error);
    return NextResponse.json(
      { error: "Erreur du webhook" },
      { status: 500 }
    );
  }
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
            await prisma.creditBatch.create({
                data: {
                    userId: subscription.userId,
                    amount: subscription.creditsPerMonth,
                    remaining: subscription.creditsPerMonth,
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
        await sendPaymentFailedEmail(
            subscription.user.email,
            subscription.user.name || 'Client'
        );
    }

    // Notifier l'admin
    await sendAdminNotification(
        `⚠️ Paiement échoué`,
        subscription.user.name || 'Client',
        `Abonnement ${subscriptionId}`,
        `Statut: PAST_DUE`,
        subscription.price
    );
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
    console.error("Pas de bookingIds dans les metadata du PaymentIntent");
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

  // Marquer les réservations comme payées mais en attente de validation admin
  await prisma.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: {
      status: "PENDING", // Reste en attente de validation manuelle
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

      // Créer ou synchroniser l'abonnement en base. Le webhook peut arriver après une réparation côté dashboard.
      await prisma.userSubscription.upsert({
          where: { userId: metadata.userId },
          update: {
              stripeSubscriptionId: subscriptionId,
              status: "ACTIVE",
              serviceType: metadata.serviceType as "BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING",
              daysPerWeek: parseInt(metadata.daysPerWeek),
              creditsPerMonth: parseInt(metadata.creditsPerMonth),
              price: session.amount_total ? session.amount_total / 100 : 0,
              billingPeriod: metadata.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY",
          },
          create: {
              userId: metadata.userId,
              stripeSubscriptionId: subscriptionId,
              status: "ACTIVE",
              serviceType: metadata.serviceType as "BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING",
              daysPerWeek: parseInt(metadata.daysPerWeek),
              creditsPerMonth: parseInt(metadata.creditsPerMonth),
              price: session.amount_total ? session.amount_total / 100 : 0,
              billingPeriod: metadata.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY",
          }
      });

      // Créditer le premier lot une seule fois.
      const existingCreditBatches = await prisma.creditBatch.count({
          where: { userId: metadata.userId },
      });

      if (existingCreditBatches === 0) {
          await prisma.creditBatch.create({
              data: {
                  userId: metadata.userId,
                  amount: parseInt(metadata.creditsPerMonth),
                  remaining: parseInt(metadata.creditsPerMonth),
                  serviceType: metadata.serviceType as "BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING",
                  expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
              }
          });
      }

      return;
  }

  // Gestion RÉSERVATION (existant)
  const bookingIds = getBookingIds(session.metadata);

  if (bookingIds.length === 0) {
    console.error("Pas de bookingIds dans les metadata de la session");
    return;
  }

  // Incrémenter le coupon si utilisé (le code est stocké dans les metadata)
  const promoCode = session.metadata?.promoCode;
  if (promoCode) {
    await prisma.coupon.updateMany({
      where: { code: promoCode.toUpperCase(), isActive: true },
      data: { currentUses: { increment: 1 } },
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
      } else {
        console.error(`❌ Réservation ${id} introuvable en base !`);
      }
  }

}
