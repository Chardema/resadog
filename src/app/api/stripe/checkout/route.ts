import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { getStripeCheckoutLocale, getStripeReturnBaseUrl } from "@/lib/stripe/checkout";
import Stripe from "stripe";
import {
  CheckoutAttemptBusyError,
  CheckoutAttemptClaim,
  claimCheckoutAttempt,
  failCheckoutAttempt,
} from "@/lib/checkout-attempts";
import {
  WELCOME_OFFER_CHECKOUT_MINUTES,
  WELCOME_OFFER_LOCK_ID,
  WELCOME_OFFER_MAX_CLIENTS,
  WELCOME_OFFER_NOTE,
  isWelcomeOfferCode,
} from "@/lib/welcome-offer";

class WelcomeOfferError extends Error {}

const BOOKING_CHECKOUT_MINUTES = 31;

async function claimWelcomeOffer(userId: string, bookingIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WELCOME_OFFER_LOCK_ID})`;

    // Une session Checkout expire après 31 minutes. Ce filet de sécurité libère
    // également une place si le webhook Stripe d'expiration a été retardé.
    const staleBefore = new Date(Date.now() - (WELCOME_OFFER_CHECKOUT_MINUTES + 5) * 60 * 1000);
    await tx.booking.updateMany({
      where: {
        status: "PENDING",
        depositPaid: false,
        couponRedeemedAt: { lt: staleBefore },
        notes: { contains: WELCOME_OFFER_NOTE },
        OR: [
          { payment: { is: null } },
          { payment: { is: { status: { not: "SUCCEEDED" } } } },
        ],
      },
      data: { couponRedeemedAt: null },
    });

    const [hasPreviousBooking, otherClaim, currentBookings, claimedPlaces] = await Promise.all([
      tx.booking.findFirst({
        where: {
          clientId: userId,
          id: { notIn: bookingIds },
          OR: [
            { depositPaid: true },
            { payment: { is: { status: "SUCCEEDED" } } },
            { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
          ],
        },
        select: { id: true },
      }),
      tx.booking.findFirst({
        where: {
          clientId: userId,
          id: { notIn: bookingIds },
          couponRedeemedAt: { not: null },
          notes: { contains: WELCOME_OFFER_NOTE },
        },
        select: { id: true },
      }),
      tx.booking.findMany({
        where: {
          id: { in: bookingIds },
          clientId: userId,
          notes: { contains: WELCOME_OFFER_NOTE },
        },
        select: { id: true, couponRedeemedAt: true },
      }),
      tx.booking.count({
        where: {
          couponRedeemedAt: { not: null },
          notes: { contains: WELCOME_OFFER_NOTE },
        },
      }),
    ]);

    if (hasPreviousBooking) {
      throw new WelcomeOfferError("Cette offre est réservée aux nouveaux clients, pour leur première réservation.");
    }
    if (otherClaim) {
      throw new WelcomeOfferError("Votre offre de bienvenue est déjà associée à une autre réservation.");
    }
    if (currentBookings.length !== bookingIds.length) {
      throw new WelcomeOfferError("L'offre de bienvenue n'est pas associée à cette réservation.");
    }

    const unclaimedIds = currentBookings
      .filter((booking) => !booking.couponRedeemedAt)
      .map((booking) => booking.id);

    if (claimedPlaces + unclaimedIds.length > WELCOME_OFFER_MAX_CLIENTS) {
      throw new WelcomeOfferError("Les 5 offres de bienvenue ont déjà été attribuées.");
    }

    if (unclaimedIds.length > 0) {
      await tx.booking.updateMany({
        where: { id: { in: unclaimedIds }, couponRedeemedAt: null },
        data: { couponRedeemedAt: new Date() },
      });
    }

    return unclaimedIds;
  });
}

export async function POST(request: NextRequest) {
  let newlyClaimedWelcomeBookingIds: string[] = [];
  let checkoutSession: Stripe.Checkout.Session | null = null;
  let checkoutAttemptClaim: CheckoutAttemptClaim | null = null;

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

    if (bookingIds.length > 1) {
      return NextResponse.json(
        { error: "Le paiement groupé de réservations séparées est désactivé pour éviter une capture ou un remboursement incohérent." },
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

    // Le code appliqué vient de la réservation calculée par le serveur, jamais du navigateur.
    const appliedPromoCodes = [...new Set(bookings
      .map((booking) => booking.notes?.match(/(?:^|\n)Code promo: ([A-Z0-9_-]+)/)?.[1])
      .filter((code): code is string => Boolean(code)))];
    const promoCode = appliedPromoCodes.length === 1 ? appliedPromoCodes[0] : "";

    // Check if any already paid
    for (const booking of bookings) {
      if (booking.payment?.status === "SUCCEEDED") {
        return NextResponse.json(
          { error: `La réservation pour ${booking.startDate.toLocaleDateString()} a déjà été payée` },
          { status: 400 }
        );
      }
      if (booking.payment?.status === "PROCESSING" && booking.payment.stripePaymentId) {
        return NextResponse.json(
          { error: "Le paiement de cette réservation est déjà autorisé et attend la validation de l'équipe." },
          { status: 409 }
        );
      }
    }

    const checkoutAttempt = await claimCheckoutAttempt(bookings[0].id);
    if (checkoutAttempt.kind === "REUSE") {
      return NextResponse.json({
        checkoutUrl: checkoutAttempt.checkoutUrl,
        sessionId: checkoutAttempt.sessionId,
        reused: true,
      });
    }
    checkoutAttemptClaim = checkoutAttempt.claim;

    if (isWelcomeOfferCode(promoCode)) {
      newlyClaimedWelcomeBookingIds = await claimWelcomeOffer(session.user.id, bookingIds);
    }

    const client = bookings[0].client;

    // Créer ou récupérer le Stripe Customer
    let stripeCustomerId = client.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: client.email,
          name: client.name || undefined,
          metadata: {
            userId: client.id,
          },
        },
        { idempotencyKey: `booking-customer:${client.id}` }
      );

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
    const returnBaseUrl = getStripeReturnBaseUrl(request);

    // Créer la Checkout Session avec setup_future_usage
    checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        mode: "payment",
        locale: getStripeCheckoutLocale(request),
        line_items,
        // 🔑 Empreinte bancaire uniquement (pas de débit immédiat)
        payment_intent_data: {
          capture_method: "manual", // L'argent est bloqué mais pas prélevé
          setup_future_usage: "off_session",
          metadata: {
            bookingIds: bookingIdsStr,
            userId: client.id,
            promoCode,
          },
        },
        success_url: `${returnBaseUrl}/booking/success?bookingId=${bookingIds[0]}`,
        cancel_url: `${returnBaseUrl}/booking?cancelled=true`,
        // Toutes les demandes expirent rapidement : tant que Checkout n'est pas
        // terminé, elles ne doivent pas rester comme réservations actionnables.
        expires_at: Math.floor(Date.now() / 1000) + (
          isWelcomeOfferCode(promoCode)
            ? WELCOME_OFFER_CHECKOUT_MINUTES
            : BOOKING_CHECKOUT_MINUTES
        ) * 60,
        metadata: {
          bookingIds: bookingIdsStr,
          userId: client.id,
          promoCode,
        },
      },
      { idempotencyKey: checkoutAttemptClaim.idempotencyKey }
    );

    await prisma.$transaction(async (tx) => {
      if (isWelcomeOfferCode(promoCode)) {
        // La date de création de la session identifie la tentative la plus récente.
        await tx.booking.updateMany({
          where: { id: { in: bookingIds }, clientId: session.user.id },
          data: { couponRedeemedAt: new Date(checkoutSession!.created * 1000) },
        });
      }

      for (const booking of bookings) {
        await tx.payment.upsert({
          where: { bookingId: booking.id },
          update: {
            amount: booking.totalPrice,
            capturedAmount: 0,
            refundAmount: null,
            refundedAt: null,
            paidAt: null,
            stripePaymentId: null,
            stripeCheckoutSessionId: checkoutSession!.id,
            stripeCustomerId: stripeCustomerId!,
            status: "PROCESSING",
          },
          create: {
            bookingId: booking.id,
            amount: booking.totalPrice,
            capturedAmount: 0,
            currency: "eur",
            status: "PROCESSING",
            stripePaymentId: null,
            stripeCheckoutSessionId: checkoutSession!.id,
            stripeCustomerId: stripeCustomerId!,
          },
        });
      }

      const opened = await tx.checkoutAttempt.updateMany({
        where: {
          bookingId: checkoutAttemptClaim!.bookingId,
          attemptToken: checkoutAttemptClaim!.attemptToken,
          status: "CREATING",
        },
        data: {
          status: "OPEN",
          stripeSessionId: checkoutSession!.id,
          checkoutUrl: checkoutSession!.url,
          expiresAt: new Date(checkoutSession!.expires_at * 1000),
        },
      });
      if (opened.count !== 1) {
        throw new Error(`Verrou Checkout perdu pour ${checkoutAttemptClaim!.bookingId}`);
      }
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    if (checkoutSession && checkoutSession.status === "open") {
      await stripe.checkout.sessions.expire(checkoutSession.id).catch((expireError) => {
        console.error("Session Checkout non expirée après erreur:", expireError);
      });
    }
    if (newlyClaimedWelcomeBookingIds.length > 0) {
      await prisma.booking.updateMany({
        where: {
          id: { in: newlyClaimedWelcomeBookingIds },
          status: "PENDING",
          depositPaid: false,
        },
        data: { couponRedeemedAt: null },
      }).catch((releaseError) => console.error("Place de bienvenue non libérée:", releaseError));
    }
    if (checkoutAttemptClaim) {
      await failCheckoutAttempt(checkoutAttemptClaim, error).catch((attemptError) => {
        console.error("Tentative Checkout non marquée en échec:", attemptError);
      });
    }

    if (error instanceof CheckoutAttemptBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof WelcomeOfferError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erreur lors de la création de la session Stripe:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
