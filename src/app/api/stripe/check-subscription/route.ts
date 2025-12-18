import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.stripeCustomerId) return NextResponse.json({ status: "NO_CUSTOMER" });

    // Récupérer les abonnements actifs chez Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
        return NextResponse.json({ status: "NO_ACTIVE_SUBSCRIPTION" });
    }

    const stripeSub = subscriptions.data[0];
    const metadata = stripeSub.metadata;

    // Tentative de synchronisation / auto-réparation
    if (metadata && metadata.userId === session.user.id && metadata.serviceType) {
        console.log(`🔄 Auto-sync abonnement Stripe ${stripeSub.id} -> DB`);
        
        // Upsert l'abonnement
        await prisma.userSubscription.upsert({
            where: { userId: session.user.id },
            update: {
                stripeSubscriptionId: stripeSub.id,
                status: 'ACTIVE',
                serviceType: metadata.serviceType as any,
                daysPerWeek: parseInt(metadata.daysPerWeek || "0"),
                creditsPerMonth: parseInt(metadata.creditsPerMonth || "0"),
                // On pourrait mettre à jour le prix si dispo dans metadata ou via l'item
            },
            create: {
                userId: session.user.id,
                stripeSubscriptionId: stripeSub.id,
                status: 'ACTIVE',
                serviceType: metadata.serviceType as any,
                daysPerWeek: parseInt(metadata.daysPerWeek || "0"),
                creditsPerMonth: parseInt(metadata.creditsPerMonth || "0"),
                price: 0, // Fallback si on a pas l'info facile ici
            }
        });
        return NextResponse.json({ status: "REPAIRED", message: "Abonnement synchronisé" });
    }

    // Fallback : Si on a un abo en base qui matche l'ID mais pas le statut
    const dbSub = await prisma.userSubscription.findUnique({ where: { userId: session.user.id } });
    
    if (dbSub && dbSub.stripeSubscriptionId === stripeSub.id) {
        if (dbSub.status !== 'ACTIVE') {
            await prisma.userSubscription.update({
                where: { id: dbSub.id },
                data: { status: 'ACTIVE' }
            });
            return NextResponse.json({ status: "UPDATED", message: "Statut mis à jour" });
        }
    }

    return NextResponse.json({ status: "SYNCED" });

  } catch (error) {
    console.error("Erreur check subscription:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
