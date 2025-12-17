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
    // Accept either single bookingId (for backward compat) or array of bookingIds
    const bookingIds = body.bookingIds || (body.bookingId ? [body.bookingId] : []);

    if (bookingIds.length === 0) {
      return NextResponse.json(
        { error: "ID(s) de réservation requis" },
        { status: 400 }
      );
    }

    // Charger les réservations avec l'utilisateur
    const bookings = await prisma.booking.findMany({
      where: { 
        id: { in: bookingIds },
        clientId: session.user.id // Ensure ownership
      },
      include: {
        client: true,
        pets: true, // Use new relation
        pet: true,  // Fallback
        payment: true,
      },
    });

    if (bookings.length !== bookingIds.length) {
      return NextResponse.json(
        { error: "Certaines réservations sont introuvables ou ne vous appartiennent pas" },
        { status: 404 }
      );
    }

    // Check if any already paid
    for (const booking of bookings) {
      if (booking.payment?.status === "SUCCEEDED") {
        return NextResponse.json(
          { error: `La réservation pour ${booking.startDate.toLocaleDateString()} a déjà été payée` },
          { status: 400 }
        );
      }
    }

    const client = bookings[0].client;

    // Créer ou récupérer le Stripe Customer
    let stripeCustomerId = client.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: client.email,
        name: client.name || undefined,
        metadata: {
          userId: client.id,
        },
      });

      stripeCustomerId = customer.id;

      // Sauvegarder le Customer ID
      await prisma.user.update({
        where: { id: client.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Build line items
    const line_items = bookings.map(booking => {
        const petsName = booking.pets.length > 0 
            ? booking.pets.map(p => p.name).join(", ") 
            : (booking.pet?.name || "Animal");
            
        return {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Garde de ${petsName}`,
              description: `Du ${new Date(booking.startDate).toLocaleDateString("fr-FR")} au ${new Date(booking.endDate).toLocaleDateString("fr-FR")}`,
            },
            unit_amount: Math.round(booking.totalPrice * 100),
          },
          quantity: 1,
        };
    });

    // Create Metadata string (comma separated IDs)
    // Note: Stripe metadata limits: 500 chars. 
    // UUIDs are 36 chars. So ~13 IDs max. Should be enough for this use case.
    const bookingIdsStr = bookingIds.join(",");

    // Créer la Checkout Session avec setup_future_usage
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      // 🔑 Empreinte bancaire uniquement (pas de débit immédiat)
      payment_intent_data: {
        capture_method: "manual", // L'argent est bloqué mais pas prélevé
        setup_future_usage: "off_session",
        metadata: {
          bookingIds: bookingIdsStr,
          userId: client.id,
        },
      },
      // Redirect to success page (first booking ID used for display logic if needed, or update page to handle multiple)
      success_url: `${process.env.NEXTAUTH_URL}/booking/success?bookingId=${bookingIds[0]}`, 
      cancel_url: `${process.env.NEXTAUTH_URL}/booking?cancelled=true`,
      metadata: {
        bookingIds: bookingIdsStr,
        userId: client.id,
      },
    });

    // Create Payments records for all bookings
    await Promise.all(bookings.map(async (booking) => {
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
              stripeCustomerId: stripeCustomerId!,
            },
          });
        }
    }));

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