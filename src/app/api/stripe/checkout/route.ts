import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: "ID de réservation requis" },
        { status: 400 }
      );
    }

    // Charger la réservation avec l'utilisateur
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: true,
        pet: true,
        payment: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation introuvable" },
        { status: 404 }
      );
    }

    if (booking.clientId !== session.user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    if (booking.payment?.status === "SUCCEEDED") {
      return NextResponse.json(
        { error: "Cette réservation a déjà été payée" },
        { status: 400 }
      );
    }

    // Créer ou récupérer le Stripe Customer
    let stripeCustomerId = booking.client.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: booking.client.email,
        name: booking.client.name || undefined,
        metadata: {
          userId: booking.client.id,
        },
      });

      stripeCustomerId = customer.id;

      // Sauvegarder le Customer ID
      await prisma.user.update({
        where: { id: booking.client.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Montant à payer (totalPrice de la réservation)
    const amount = Math.round(booking.totalPrice * 100); // Convertir en centimes

    // Créer la Checkout Session avec setup_future_usage
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Garde de ${booking.pet.name}`,
              description: `Du ${new Date(booking.startDate).toLocaleDateString("fr-FR")} au ${new Date(booking.endDate).toLocaleDateString("fr-FR")}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      // 🔑 Empreinte bancaire uniquement (pas de débit immédiat)
      payment_intent_data: {
        capture_method: "manual", // L'argent est bloqué mais pas prélevé
        setup_future_usage: "off_session",
        metadata: {
          bookingId: booking.id,
          userId: booking.client.id,
        },
      },
      success_url: `${process.env.NEXTAUTH_URL}/booking/success?bookingId=${booking.id}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/bookings/${booking.id}?payment=cancelled`,
      metadata: {
        bookingId: booking.id,
        userId: booking.client.id,
      },
    });

    // Mettre à jour ou créer le Payment
    if (booking.payment) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          stripePaymentId: checkoutSession.payment_intent as string,
          status: "PROCESSING",
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.totalPrice,
          currency: "eur",
          status: "PROCESSING",
          stripePaymentId: checkoutSession.payment_intent as string,
          stripeCustomerId: stripeCustomerId,
        },
      });
    }

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la session Stripe:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
