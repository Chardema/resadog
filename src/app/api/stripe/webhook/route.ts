import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
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

      default:
        console.log(`Événement non géré : ${event.type}`);
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

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata.bookingId;

  if (!bookingId) {
    console.error("Pas de bookingId dans les metadata du PaymentIntent");
    return;
  }

  // Récupérer le Payment Method attaché
  const paymentMethodId = paymentIntent.payment_method as string;

  // Récupérer les détails du Payment Method pour obtenir les infos de carte
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

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
  if (userId && paymentMethod.card) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        paymentMethodId: paymentMethodId,
        cardLast4: paymentMethod.card.last4,
        cardBrand: paymentMethod.card.brand,
      },
    });
  }

  // Marquer la réservation comme confirmée
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CONFIRMED",
      depositPaid: true,
    },
  });

  console.log(`✅ Paiement réussi pour la réservation ${bookingId}`);
  console.log(`💳 Carte enregistrée : ${paymentMethod.card?.brand} •••• ${paymentMethod.card?.last4}`);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await prisma.payment.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: {
      status: "FAILED",
    },
  });

  console.log(`❌ Paiement échoué : ${paymentIntent.id}`);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    console.error("Pas de bookingId dans les metadata de la session");
    return;
  }

  console.log(`✅ Session Checkout complétée pour la réservation ${bookingId}`);
}
