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

  if (subscription?.stripeSubscriptionId) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      
      // Calcul engagement
      const startDate = new Date(subscription.createdAt);
      const monthsToAdd = subscription.billingPeriod === "YEARLY" ? 12 : 2;
      commitmentEndsAt = new Date(startDate.setMonth(startDate.getMonth() + monthsToAdd));
      const isLocked = new Date() < commitmentEndsAt;

      if (user?.stripeCustomerId) {
          // Créer une configuration de portail adaptée
          // Note: En prod, on devrait créer ces configs une fois et stocker leurs IDs.
          // Ici pour le prototype, on crée à la volée (attention aux limites de rate limit Stripe si trafic énorme)
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
              subscription_pause: { enabled: false },
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
    commitmentEndsAt
  });
}
