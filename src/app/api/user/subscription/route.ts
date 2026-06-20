import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import Stripe from "stripe";
import { z } from "zod";

const manageSubscriptionSchema = z.object({
  action: z.enum(["cancel_at_period_end", "resume"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const [subscription, creditBatches, user] = await Promise.all([
    prisma.userSubscription.findUnique({ where: { userId: session.user.id } }),
    prisma.creditBatch.findMany({ where: { userId: session.user.id, remaining: { gt: 0 } } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  const totalCredits = creditBatches.reduce((acc, b) => acc + b.remaining, 0);

  // Récupérer le portail Stripe si abonné
  let portalUrl = null;
  let commitmentEndsAt = null;
  let currentPeriodEnd = null;
  let cancelAtPeriodEnd = false;
  let isLocked = false;
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
      // Récupérer les détails de l'abonnement depuis Stripe
      try {
          const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          // SDK v20 : current_period_end est sur les items, plus sur la subscription
          const firstItem = stripeSub.items.data[0];
          if (firstItem?.current_period_end) {
            currentPeriodEnd = new Date(firstItem.current_period_end * 1000);
          }
          cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
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

      // Calcul engagement (clone pour éviter la mutation)
      const startDate = new Date(subscription.createdAt);
      const monthsToAdd = subscription.billingPeriod === "YEARLY" ? 12 : 2;
      commitmentEndsAt = new Date(startDate);
      commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + monthsToAdd);
      isLocked = new Date() < commitmentEndsAt;

      if (user?.stripeCustomerId) {
        try {
          const portalSession = await stripe.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: `${process.env.NEXTAUTH_URL}/profile`,
          });
          portalUrl = portalSession.url;
        } catch (error) {
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
      console.error("Erreur récupération factures Stripe:", e);
    }
  }

  return NextResponse.json({
    subscription,
    credits: totalCredits,
    portalUrl,
    commitmentEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    isLocked,
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

    const commitmentEndsAt = new Date(subscription.createdAt);
    commitmentEndsAt.setMonth(
      commitmentEndsAt.getMonth() + (subscription.billingPeriod === "YEARLY" ? 12 : 2)
    );

    if (action === "cancel_at_period_end" && new Date() < commitmentEndsAt) {
      return NextResponse.json(
        {
          error: "L'abonnement est encore dans sa période d'engagement.",
          commitmentEndsAt,
        },
        { status: 403 }
      );
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

    if (
      action === "cancel_at_period_end" &&
      currentStripeSubscription.cancel_at_period_end
    ) {
      const firstItem = currentStripeSubscription.items.data[0];
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000)
          : null,
      });
    }

    if (action === "resume" && !currentStripeSubscription.cancel_at_period_end) {
      const firstItem = currentStripeSubscription.items.data[0];
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000)
          : null,
      });
    }

    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: action === "cancel_at_period_end",
      }
    );

    if (action === "resume") {
      await prisma.userSubscription.update({
        where: { userId: session.user.id },
        data: { status: "ACTIVE" },
      });
    }

    const firstItem = stripeSubscription.items.data[0];

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      currentPeriodEnd: firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : null,
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
