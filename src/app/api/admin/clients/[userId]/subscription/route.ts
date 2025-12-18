import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const { userId } = await params;

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    // Résilier dans Stripe
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    // Mettre à jour la base
    await prisma.userSubscription.update({
      where: { userId },
      data: { status: "CANCELED" },
    });

    // Optionnel : Retirer les crédits restants ?
    // await prisma.creditBatch.updateMany({ where: { userId }, data: { remaining: 0 } });

    return NextResponse.json({ success: true, message: "Abonnement résilié" });
  } catch (error) {
    console.error("Erreur résiliation admin:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
