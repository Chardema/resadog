import { isDirectPayment } from "@/lib/direct-booking";
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
import { getPetProfileCompletion, isPetBirthDateVerified } from "@/lib/pets";
import {
  BOOKING_INVOICE_VERSION,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_INFORMATION,
} from "@/lib/legal";
import { getServiceLabel } from "@/lib/services";
import { PAYMENT_PLAN_ENABLED, isBalanceMandateConsentValid, type BalanceMandateTerms } from "@/lib/payment-plan";
import {
  getBalanceMandateMetadata,
  getDepositPlanTermsMetadata,
  readDepositPlanTerms,
  resolveCheckoutDepositPlan,
  toStripeCents,
} from "@/lib/checkout-payment-plan";
import {
  getBalanceMandateRequiredError,
  getCheckoutSubmitMessage,
  getDepositLineItemDetail,
  toPaymentPlanLocale,
  type PaymentPlanLocale,
} from "@/lib/payment-plan-text";

const BOOKING_CHECKOUT_MINUTES = 31;

// Sans la case d'autorisation du solde (ou avec des conditions qui ne sont plus
// celles du serveur), le Checkout de l'acompte est refusé : le navigateur
// réaffiche les conditions renvoyées et redemande le consentement.
const balanceMandateRequired = (terms: BalanceMandateTerms, locale: PaymentPlanLocale) =>
  NextResponse.json(
    {
      error: getBalanceMandateRequiredError(locale),
      code: "BALANCE_MANDATE_REQUIRED",
      paymentPlan: { plan: "DEPOSIT_BALANCE", ...terms },
    },
    { status: 400 }
  );

export async function POST(request: NextRequest) {
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
    if (body.legalAccepted !== true || body.legalVersion !== LEGAL_DOCUMENT_VERSION) {
      return NextResponse.json(
        { error: "Vous devez accepter la version en vigueur des conditions générales de vente." },
        { status: 400 }
      );
    }
    const legalAcceptedAt = new Date().toISOString();
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

    const bookingPets = bookings.flatMap((booking) =>
      booking.pets.length > 0 ? booking.pets : (booking.pet ? [booking.pet] : [])
    );
    const incompletePetNames = [...new Set(bookingPets
      .filter((pet) => !getPetProfileCompletion(pet).isComplete)
      .map((pet) => pet.name))];

    if (incompletePetNames.length > 0) {
      return NextResponse.json(
        {
          error: `Le paiement est bloqué tant que le profil de ${incompletePetNames.join(", ")} n'est pas complété à 100 %.`,
          code: "PET_PROFILE_INCOMPLETE",
        },
        { status: 409 }
      );
    }

    const unverifiedPetNames = [...new Set(bookingPets
      .filter((pet) => !isPetBirthDateVerified(pet))
      .map((pet) => pet.name))];
    if (unverifiedPetNames.length > 0) {
      return NextResponse.json(
        {
          error: `Le paiement est bloqué tant que la date de naissance n'est pas vérifiée pour : ${unverifiedPetNames.join(", ")}.`,
          code: "PET_BIRTH_DATE_UNVERIFIED",
        },
        { status: 409 }
      );
    }

    // Le code appliqué vient de la réservation calculée par le serveur, jamais du navigateur.
    const appliedPromoCodes = [...new Set(bookings
      .map((booking) => booking.notes?.match(/(?:^|\n)Code promo: ([A-Z0-9_-]+)/)?.[1])
      .filter((code): code is string => Boolean(code)))];
    const promoCode = appliedPromoCodes.length === 1 ? appliedPromoCodes[0] : "";

    if (bookings.some(booking => isDirectPayment(booking.payment?.paymentMethod))) {
      return NextResponse.json({ error: "Cette réservation se règle directement auprès de Mégane, selon le mode convenu." }, { status: 409 });
    }

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

    // Plan acompte + solde (spec 07), décidé par le serveur au moment de la demande.
    const planLocale = toPaymentPlanLocale(getStripeCheckoutLocale(request));
    const depositPlan = PAYMENT_PLAN_ENABLED
      ? resolveCheckoutDepositPlan(bookings[0], new Date())
      : null;
    const balanceMandateMetadata = getBalanceMandateMetadata({
      acceptedAt: legalAcceptedAt,
      legalVersion: LEGAL_DOCUMENT_VERSION,
    });

    const checkoutAttempt = await claimCheckoutAttempt(bookings[0].id);
    if (checkoutAttempt.kind === "REUSE" && PAYMENT_PLAN_ENABLED) {
      // La session ouverte fait foi : ses conditions ont été fixées à sa création.
      const openSession = await stripe.checkout.sessions.retrieve(checkoutAttempt.sessionId);
      const sessionTerms = readDepositPlanTerms(openSession.metadata);
      if (sessionTerms && !isBalanceMandateConsentValid(body.balanceMandate, sessionTerms)) {
        return balanceMandateRequired(sessionTerms, planLocale);
      }
      await stripe.checkout.sessions.update(checkoutAttempt.sessionId, {
        metadata: {
          legalAccepted: "true",
          legalAcceptedAt,
          legalVersion: LEGAL_DOCUMENT_VERSION,
          provider: LEGAL_INFORMATION.commercialName,
          providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
          ...(sessionTerms ? balanceMandateMetadata : {}),
        },
      });
      return NextResponse.json({
        checkoutUrl: checkoutAttempt.checkoutUrl,
        sessionId: checkoutAttempt.sessionId,
        reused: true,
      });
    }
    if (checkoutAttempt.kind === "REUSE") {
      await stripe.checkout.sessions.update(checkoutAttempt.sessionId, {
        metadata: {
          legalAccepted: "true",
          legalAcceptedAt,
          legalVersion: LEGAL_DOCUMENT_VERSION,
          provider: LEGAL_INFORMATION.commercialName,
          providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
        },
      });
      return NextResponse.json({
        checkoutUrl: checkoutAttempt.checkoutUrl,
        sessionId: checkoutAttempt.sessionId,
        reused: true,
      });
    }
    checkoutAttemptClaim = checkoutAttempt.claim;

    // Nouvelle session : le consentement doit porter sur les conditions du jour.
    if (depositPlan && !isBalanceMandateConsentValid(body.balanceMandate, depositPlan.terms)) {
      await failCheckoutAttempt(checkoutAttemptClaim, new Error("Autorisation de prélèvement du solde absente"));
      checkoutAttemptClaim = null;
      return balanceMandateRequired(depositPlan.terms, planLocale);
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
        const bookingReference = `#${booking.id.slice(-8).toUpperCase()}`;
        const servicePeriod = [
          `du ${new Date(booking.startDate).toLocaleDateString("fr-FR", { timeZone: "UTC" })}${booking.startTime ? ` à ${booking.startTime}` : ""}`,
          `au ${new Date(booking.endDate).toLocaleDateString("fr-FR", { timeZone: "UTC" })}${booking.endTime ? ` à ${booking.endTime}` : ""}`,
        ].join(" ");
        const pricingDetail = booking.notes
          ?.split("\n")
          .find((line) => line.startsWith("Détail facturation:"));
            
        return {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${getServiceLabel(booking.serviceType)} – ${petsName}`,
              description: [
                `Réservation ${bookingReference}`,
                `Prestation prévue ${servicePeriod}`,
                pricingDetail,
                depositPlan ? getDepositLineItemDetail(depositPlan.terms, planLocale) : null,
              ].filter(Boolean).join(" · "),
            },
            // Plan acompte : seul l'acompte est autorisé ; le solde est prélevé à J-7.
            unit_amount: depositPlan
              ? toStripeCents(depositPlan.terms.depositAmount)
              : Math.round(booking.totalPrice * 100),
          },
          quantity: 1,
        };
    });

    // Create Metadata string (comma separated IDs)
    // Note: Stripe metadata limits: 500 chars. 
    // UUIDs are 36 chars. So ~13 IDs max. Should be enough for this use case.
    const bookingIdsStr = bookingIds.join(",");
    const returnBaseUrl = getStripeReturnBaseUrl(request);
    // La valeur de conversion Google Ads / GA4 n'est plus passée dans l'URL :
    // /booking/success la récupère via /api/bookings/[id]/conversion.
    const depositPlanMetadata = depositPlan
      ? { ...getDepositPlanTermsMetadata(depositPlan), ...balanceMandateMetadata }
      : {};

    // Créer la Checkout Session avec setup_future_usage
    checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        mode: "payment",
        billing_address_collection: "required",
        customer_update: {
          address: "auto",
          name: "auto",
        },
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
            legalAccepted: "true",
            legalAcceptedAt,
            legalVersion: LEGAL_DOCUMENT_VERSION,
            bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
            provider: LEGAL_INFORMATION.commercialName,
            providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
            ...depositPlanMetadata,
          },
        },
        ...(depositPlan
          ? { custom_text: { submit: { message: getCheckoutSubmitMessage(depositPlan.terms, planLocale) } } }
          : {}),
        success_url: `${returnBaseUrl}/booking/success?bookingId=${bookingIds[0]}`,
        cancel_url: `${returnBaseUrl}/booking?cancelled=true`,
        // Toutes les demandes expirent rapidement : tant que Checkout n'est pas
        // terminé, elles ne doivent pas rester comme réservations actionnables.
        expires_at: Math.floor(Date.now() / 1000) + BOOKING_CHECKOUT_MINUTES * 60,
        metadata: {
          bookingIds: bookingIdsStr,
          userId: client.id,
          promoCode,
          legalAccepted: "true",
          legalAcceptedAt,
          legalVersion: LEGAL_DOCUMENT_VERSION,
          bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
          provider: LEGAL_INFORMATION.commercialName,
          providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
          ...depositPlanMetadata,
        },
      },
      { idempotencyKey: checkoutAttemptClaim.idempotencyKey }
    );

    await prisma.$transaction(async (tx) => {
      for (const booking of bookings) {
        // Plan acompte : le paiement Stripe de la réservation porte l'acompte seul.
        const authorizedAmount = depositPlan ? depositPlan.terms.depositAmount : booking.totalPrice;
        await tx.payment.upsert({
          where: { bookingId: booking.id },
          update: {
            amount: authorizedAmount,
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
            amount: authorizedAmount,
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
    if (checkoutAttemptClaim) {
      await failCheckoutAttempt(checkoutAttemptClaim, error).catch((attemptError) => {
        console.error("Tentative Checkout non marquée en échec:", attemptError);
      });
    }

    if (error instanceof CheckoutAttemptBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Erreur lors de la création de la session Stripe:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
