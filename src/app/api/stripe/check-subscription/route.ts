import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { PREMIUM_SUBSCRIPTION } from "@/lib/subscription-pricing";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.stripeCustomerId) return NextResponse.json({ status: "NO_CUSTOMER" });

    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      await prisma.userSubscription.updateMany({
        where: { userId: session.user.id, status: "ACTIVE" },
        data: { status: "CANCELED_REMOTE" },
      });
      return NextResponse.json({ status: "NO_ACTIVE_SUBSCRIPTION" });
    }

    const stripeSub = subscriptions.data[0];

    await prisma.userSubscription.upsert({
      where: { userId: session.user.id },
      update: {
        stripeSubscriptionId: stripeSub.id,
        status: "ACTIVE",
        price: PREMIUM_SUBSCRIPTION.monthlyPrice,
      },
      create: {
        userId: session.user.id,
        stripeSubscriptionId: stripeSub.id,
        status: "ACTIVE",
        price: PREMIUM_SUBSCRIPTION.monthlyPrice,
      },
    });

    return NextResponse.json({ status: "REPAIRED", message: "Abonnement Premium synchronisé" });
  } catch (error) {
    console.error("Erreur check subscription:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
