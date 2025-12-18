import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const [subscription, creditBatches] = await Promise.all([
    prisma.userSubscription.findUnique({ where: { userId: session.user.id } }),
    prisma.creditBatch.findMany({ where: { userId: session.user.id, remaining: { gt: 0 } } })
  ]);

  const totalCredits = creditBatches.reduce((acc, b) => acc + b.remaining, 0);

  // Récupérer le portail Stripe si abonné
  let portalUrl = null;
  let commitmentEndsAt = null;
  let currentPeriodEnd = null;
  let cancelAtPeriodEnd = false;

  if (subscription?.stripeSubscriptionId) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      
      // Récupérer les détails de l'abonnement depuis Stripe
      try {
          const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          // Cast 'any' pour éviter les erreurs de typage strict sur la réponse SDK
          const subData = stripeSub as any;
          currentPeriodEnd = new Date(subData.current_period_end * 1000);
          cancelAtPeriodEnd = subData.cancel_at_period_end;
      } catch (e) {
          console.error("Erreur récupération abonnement Stripe:", e);
      }

      // Calcul engagement
      const startDate = new Date(subscription.createdAt);
      const monthsToAdd = subscription.billingPeriod === "YEARLY" ? 12 : 2;
      commitmentEndsAt = new Date(startDate.setMonth(startDate.getMonth() + monthsToAdd));
      const isLocked = new Date() < commitmentEndsAt;

      if (user?.stripeCustomerId) {
          // ... (configuration creation remains same) ...
          const configuration = await stripe.billingPortal.configurations.create({
            business_profile: {
              headline: "Gestion de votre abonnement La Meute",
            },
            features: {
              customer_update: {
                enabled: true,
                allowed_updates: ["email", "address", "phone"],
              },
              invoice_history: { enabled: true },
              payment_method_update: { enabled: true },
              subscription_cancel: {
                enabled: !isLocked, // 🔒 Désactivé si engagement en cours
                mode: "at_period_end",
              },
            },
          });

          const portalSession = await stripe.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: `${process.env.NEXTAUTH_URL}/profile`,
              configuration: configuration.id,
          });
          portalUrl = portalSession.url;
      }
  }

  return NextResponse.json({
    subscription,
    credits: totalCredits,
    portalUrl,
    commitmentEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd
  });
}
