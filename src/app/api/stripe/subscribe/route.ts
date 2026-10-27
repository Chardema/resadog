import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { calculatePremiumSubscriptionPlan, PREMIUM_SUBSCRIPTION } from "@/lib/subscription-pricing";
import Stripe from "stripe";
import { getStripeCheckoutLocale, getStripeReturnBaseUrl } from "@/lib/stripe/checkout";
import {
  getInvoiceLegalFooter,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_INFORMATION,
} from "@/lib/legal";

const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;

async function createStripeCustomer(input: {
  userId: string;
  email: string | null;
  name?: string | null;
}) {
  return stripe.customers.create({
    email: input.email || undefined,
    name: input.name || undefined,
    metadata: { userId: input.userId },
  });
}

async function ensureLiveStripeCustomer(input: {
  userId: string;
  email: string | null;
  name?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (input.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(input.stripeCustomerId);
      if (!("deleted" in customer && customer.deleted)) {
        return input.stripeCustomerId;
      }
    } catch (error) {
      const missingCustomer =
        error instanceof Stripe.errors.StripeError &&
        error.code === "resource_missing" &&
        error.param === "customer";

      if (!missingCustomer) throw error;
    }
  }

  const customer = await createStripeCustomer(input);
  await prisma.user.update({
    where: { id: input.userId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (body?.legalAccepted !== true || body?.legalVersion !== LEGAL_DOCUMENT_VERSION) {
      return NextResponse.json(
        { error: "Vous devez accepter la version en vigueur des conditions générales de vente." },
        { status: 400 }
      );
    }
    const legalAcceptedAt = new Date().toISOString();

    const plan = calculatePremiumSubscriptionPlan();
    if (!premiumPriceId) {
      return NextResponse.json(
        { error: "L'abonnement Premium est momentanément indisponible." },
        { status: 503 }
      );
    }

    const price = await stripe.prices.retrieve(premiumPriceId);
    const isExpectedPremiumPrice =
      price.active &&
      price.currency === "eur" &&
      price.type === "recurring" &&
      price.recurring?.interval === "month" &&
      price.unit_amount === plan.amountDueNowCents;

    if (!isExpectedPremiumPrice) {
      console.error("Configuration Stripe Premium invalide", {
        priceId: premiumPriceId,
        active: price.active,
        currency: price.currency,
        type: price.type,
        interval: price.recurring?.interval,
        unitAmount: price.unit_amount,
      });
      return NextResponse.json(
        { error: "L'abonnement Premium est momentanément indisponible." },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const stripeCustomerId = await ensureLiveStripeCustomer({
      userId: session.user.id,
      email: user.email,
      name: user.name,
      stripeCustomerId: user.stripeCustomerId,
    });

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        custom_fields: [
          { name: "SIREN", value: LEGAL_INFORMATION.siren },
          { name: "SIRET", value: LEGAL_INFORMATION.siret },
        ],
        footer: getInvoiceLegalFooter(),
      },
    });

    const remoteSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 20,
    });
    const existingRemoteSubscription = remoteSubscriptions.data.find((subscription) =>
      ["active", "trialing", "past_due", "unpaid"].includes(subscription.status)
    );

    if (existingRemoteSubscription) {
      if (["active", "trialing"].includes(existingRemoteSubscription.status)) {
        await prisma.userSubscription.upsert({
          where: { userId: session.user.id },
          update: {
            stripeSubscriptionId: existingRemoteSubscription.id,
            status: "ACTIVE",
            price: plan.monthlyPrice,
          },
          create: {
            userId: session.user.id,
            stripeSubscriptionId: existingRemoteSubscription.id,
            status: "ACTIVE",
            price: plan.monthlyPrice,
          },
        });
        return NextResponse.json(
          { error: "Vous avez déjà un abonnement Premium actif." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Votre abonnement nécessite une régularisation depuis votre espace client." },
        { status: 409 }
      );
    }

    const returnBaseUrl = getStripeReturnBaseUrl(request);

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      locale: getStripeCheckoutLocale(request),
      payment_method_types: ["card"],
      line_items: [{ price: premiumPriceId, quantity: 1 }],
      custom_text: {
        submit: {
          message: "Engagement initial de 3 mois, facturé 9,99 € par mois, soit un montant minimum total de 29,97 €. Ensuite, renouvellement mensuel sans engagement.",
        },
      },
      success_url: `${returnBaseUrl}/dashboard?subscription=success`,
      cancel_url: `${returnBaseUrl}/subscriptions?checkout=cancelled`,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        monthlyPrice: plan.monthlyPrice.toFixed(2),
        premiumPlanVersion: PREMIUM_SUBSCRIPTION.planVersion,
        minimumCommitmentMonths: String(plan.minimumCommitmentMonths),
        minimumCommitmentTotal: plan.minimumCommitmentTotal.toFixed(2),
        maximumDiscountPerBooking: plan.maximumDiscountPerBooking.toFixed(2),
        legalAccepted: "true",
        legalAcceptedAt,
        legalVersion: LEGAL_DOCUMENT_VERSION,
        provider: LEGAL_INFORMATION.commercialName,
        providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          monthlyPrice: plan.monthlyPrice.toFixed(2),
          premiumPlanVersion: PREMIUM_SUBSCRIPTION.planVersion,
          minimumCommitmentMonths: String(plan.minimumCommitmentMonths),
          minimumCommitmentTotal: plan.minimumCommitmentTotal.toFixed(2),
          maximumDiscountPerBooking: plan.maximumDiscountPerBooking.toFixed(2),
          legalAccepted: "true",
          legalAcceptedAt,
          legalVersion: LEGAL_DOCUMENT_VERSION,
          provider: LEGAL_INFORMATION.commercialName,
          providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Erreur création abonnement Premium:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
