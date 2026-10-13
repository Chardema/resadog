import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getPremiumBenefits } from "@/lib/loyalty";
import { getLoyaltyAccount } from "@/lib/loyalty-ledger";
import {
  getPremiumCommitmentEnd,
  getPremiumCommitmentMonths,
  PREMIUM_SUBSCRIPTION,
} from "@/lib/subscription-pricing";
import { stripe } from "@/lib/stripe/config";
import Stripe from "stripe";
import { z } from "zod";
import { getStripeReturnBaseUrl } from "@/lib/stripe/checkout";

const manageSubscriptionSchema = z.object({
  action: z.enum(["cancel_at_period_end", "resume"]),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const [subscription, user, loyaltyAccount] = await Promise.all([
    prisma.userSubscription.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
    getLoyaltyAccount(session.user.id),
  ]);

  const isPremium = subscription?.status === "ACTIVE";

  let portalUrl = null;
  let commitmentEndsAt = null;
  let currentPeriodEnd = null;
  let cancellationEffectiveAt = null;
  let cancelAtPeriodEnd = false;
  let isLocked = false;
  let minimumCommitmentMonths = PREMIUM_SUBSCRIPTION.minimumCommitmentMonths;
  let isLegacyPlan = false;
  let invoices: {
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    amountDue: number;
    createdAt: Date;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }[] = [];

  if (subscription?.stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      const firstItem = stripeSub.items.data[0];
      if (firstItem?.current_period_end) {
        currentPeriodEnd = new Date(firstItem.current_period_end * 1000);
      }
      cancelAtPeriodEnd = stripeSub.cancel_at_period_end || Boolean(stripeSub.cancel_at);
      cancellationEffectiveAt = stripeSub.cancel_at
        ? new Date(stripeSub.cancel_at * 1000)
        : stripeSub.cancel_at_period_end
          ? currentPeriodEnd
          : null;
      minimumCommitmentMonths = getPremiumCommitmentMonths(stripeSub.metadata);
      isLegacyPlan = minimumCommitmentMonths !== PREMIUM_SUBSCRIPTION.minimumCommitmentMonths;
      const commitmentStart = new Date((stripeSub.start_date || stripeSub.created) * 1000);
      commitmentEndsAt = getPremiumCommitmentEnd(commitmentStart, minimumCommitmentMonths);
      isLocked = new Date() < commitmentEndsAt;
    } catch (e) {
      if (e instanceof Stripe.errors.StripeError && (e.statusCode === 404 || e.code === "resource_missing")) {
        await prisma.userSubscription.update({
          where: { id: subscription.id },
          data: { status: "CANCELED_REMOTE" },
        });
      } else {
        console.error("Erreur récupération abonnement Stripe:", e);
      }
    }

    if (user?.stripeCustomerId) {
      try {
        const returnUrl = `${getStripeReturnBaseUrl(request)}/profile`;
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: returnUrl,
          flow_data: {
            type: "payment_method_update",
            after_completion: {
              type: "redirect",
              redirect: { return_url: returnUrl },
            },
          },
        });
        portalUrl = portalSession.url;
      } catch (error) {
        if (
          error instanceof Stripe.errors.StripeError &&
          error.code === "resource_missing" &&
          error.param === "customer"
        ) {
          await prisma.user.update({
            where: { id: session.user.id },
            data: { stripeCustomerId: null },
          });
        }
        console.error("Erreur création portail Stripe:", error);
      }
    }
  }

  if (user?.stripeCustomerId) {
    try {
      const stripeInvoices = await stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 8,
      });

      invoices = stripeInvoices.data
        .filter((invoice) => invoice.status !== "draft")
        .map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amountPaid: (invoice.amount_paid || 0) / 100,
          amountDue: (invoice.amount_due || 0) / 100,
          createdAt: new Date(invoice.created * 1000),
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdf: invoice.invoice_pdf ?? null,
        }));
    } catch (e) {
      if (
        e instanceof Stripe.errors.StripeError &&
        e.code === "resource_missing" &&
        e.param === "customer"
      ) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { stripeCustomerId: null },
        });
      }
      console.error("Erreur récupération factures Stripe:", e);
    }
  }

  return NextResponse.json({
    subscription: subscription
      ? {
          ...subscription,
          name: PREMIUM_SUBSCRIPTION.name,
          benefits: PREMIUM_SUBSCRIPTION.benefits,
          pointsMultiplier: PREMIUM_SUBSCRIPTION.pointsMultiplier,
          discountRate: PREMIUM_SUBSCRIPTION.discountRate,
        }
      : null,
    premium: getPremiumBenefits(isPremium),
    loyalty: loyaltyAccount.status,
    paws: loyaltyAccount.paws,
    totalSpent: loyaltyAccount.totalQualifiedAmount,
    totalEarnedPaws: loyaltyAccount.totalEarnedPaws,
    totalRedeemedPaws: loyaltyAccount.totalRedeemedPaws,
    rewards: loyaltyAccount.rewards,
    rewardCoupons: loyaltyAccount.rewardCoupons,
    loyaltyTransactions: loyaltyAccount.transactions,
    portalUrl,
    commitmentEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    cancellationEffectiveAt,
    isLocked,
    minimumCommitmentMonths,
    isLegacyPlan,
    invoices,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }

    const { action } = manageSubscriptionSchema.parse(await request.json());

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    let currentStripeSubscription: Stripe.Subscription;

    try {
      currentStripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.statusCode === 404 || error.code === "resource_missing") {
          await prisma.userSubscription.update({
            where: { userId: session.user.id },
            data: { status: "CANCELED_REMOTE" },
          });

          return NextResponse.json(
            {
              error:
                "L'abonnement n'existe plus côté Stripe. Le statut local a été mis à jour.",
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            error:
              error.message ||
              "Stripe n'a pas pu vérifier l'abonnement. Réessayez dans quelques instants.",
          },
          { status: 502 }
        );
      }

      throw error;
    }

    if (currentStripeSubscription.status === "canceled") {
      await prisma.userSubscription.update({
        where: { userId: session.user.id },
        data: { status: "CANCELED" },
      });

      return NextResponse.json(
        { error: "Cet abonnement est déjà résilié." },
        { status: 409 }
      );
    }

    const cancellationAlreadyScheduled =
      currentStripeSubscription.cancel_at_period_end ||
      Boolean(currentStripeSubscription.cancel_at);

    const firstItem = currentStripeSubscription.items.data[0];
    const currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;
    const minimumCommitmentMonths = getPremiumCommitmentMonths(currentStripeSubscription.metadata);
    const commitmentStart = new Date(
      (currentStripeSubscription.start_date || currentStripeSubscription.created) * 1000
    );
    const commitmentEndsAt = getPremiumCommitmentEnd(commitmentStart, minimumCommitmentMonths);
    const isWithinCommitment = new Date() < commitmentEndsAt;
    const scheduledEffectiveAt = currentStripeSubscription.cancel_at
      ? new Date(currentStripeSubscription.cancel_at * 1000)
      : currentStripeSubscription.cancel_at_period_end
        ? currentPeriodEnd
        : null;
    const scheduledTooEarly = Boolean(
      isWithinCommitment && scheduledEffectiveAt && scheduledEffectiveAt < commitmentEndsAt
    );

    if (action === "cancel_at_period_end" && cancellationAlreadyScheduled && !scheduledTooEarly) {
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd,
        cancellationEffectiveAt: scheduledEffectiveAt,
        commitmentEndsAt,
        minimumCommitmentMonths,
      });
    }

    if (action === "resume" && !cancellationAlreadyScheduled) {
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: false,
        currentPeriodEnd,
        commitmentEndsAt,
        minimumCommitmentMonths,
      });
    }

    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      action === "resume"
        ? currentStripeSubscription.cancel_at
          ? { cancel_at: "" }
          : { cancel_at_period_end: false }
        : isWithinCommitment
          ? {
              cancel_at: Math.floor(commitmentEndsAt.getTime() / 1000),
              cancel_at_period_end: false,
            }
          : { cancel_at_period_end: true }
    );

    if (action === "resume") {
      await prisma.userSubscription.update({
        where: { userId: session.user.id },
        data: { status: "ACTIVE" },
      });
    }

    const updatedFirstItem = stripeSubscription.items.data[0];
    const updatedCurrentPeriodEnd = updatedFirstItem?.current_period_end
      ? new Date(updatedFirstItem.current_period_end * 1000)
      : null;
    const effectiveAt = stripeSubscription.cancel_at
      ? new Date(stripeSubscription.cancel_at * 1000)
      : stripeSubscription.cancel_at_period_end && updatedCurrentPeriodEnd
        ? updatedCurrentPeriodEnd
        : null;

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd:
        stripeSubscription.cancel_at_period_end || Boolean(stripeSubscription.cancel_at),
      currentPeriodEnd: updatedCurrentPeriodEnd,
      cancellationEffectiveAt: effectiveAt,
      commitmentEndsAt,
      minimumCommitmentMonths,
    });
  } catch (error) {
    console.error("Erreur gestion abonnement:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Stripe n'a pas pu modifier l'abonnement. Réessayez ou contactez le support.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
