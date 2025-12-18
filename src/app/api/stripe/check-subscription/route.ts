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

    console.log(`🔍 Check Sub pour ${session.user.id} / ${user.stripeCustomerId}`);
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 1,
    });

    console.log(`📦 Abonnements trouvés Stripe: ${subscriptions.data.length}`);

    if (subscriptions.data.length === 0) {
        // Nettoyage si on a un abo actif en base mais plus rien chez Stripe
        await prisma.userSubscription.updateMany({
            where: { userId: session.user.id, status: 'ACTIVE' },
            data: { status: 'CANCELED_REMOTE' }
        });
        return NextResponse.json({ status: "NO_ACTIVE_SUBSCRIPTION" });
    }

    const stripeSub = subscriptions.data[0];
    const metadata = stripeSub.metadata || {};
    console.log("📝 Metadata:", metadata);

    // Tentative de synchronisation / auto-réparation
    // Si metadata incomplete, on essaie de déduire ou on met des défauts pour débloquer
    const serviceType = (metadata.serviceType as any) || "DOG_WALKING"; // Default
    const daysPerWeek = parseInt(metadata.daysPerWeek || "2");
    const creditsPerMonth = parseInt(metadata.creditsPerMonth || "8");

    console.log(`🔄 Auto-sync abonnement Stripe ${stripeSub.id} -> DB (Force Update)`);
        
    // Upsert l'abonnement
    await prisma.userSubscription.upsert({
        where: { userId: session.user.id },
        update: {
            stripeSubscriptionId: stripeSub.id,
            status: 'ACTIVE',
            serviceType,
            daysPerWeek,
            creditsPerMonth,
        },
        create: {
            userId: session.user.id,
            stripeSubscriptionId: stripeSub.id,
            status: 'ACTIVE',
            serviceType,
            daysPerWeek,
            creditsPerMonth,
            price: (stripeSub.items.data[0].price.unit_amount || 0) / 100,
        }
    });
    
    // On s'assure qu'il a des crédits (si pas de batch actif)
    const activeBatch = await prisma.creditBatch.findFirst({
        where: { userId: session.user.id, remaining: { gt: 0 } }
    });

    if (!activeBatch) {
        console.log("➕ Ajout crédits de secours (Sync)");
        await prisma.creditBatch.create({
            data: {
                userId: session.user.id,
                amount: creditsPerMonth,
                remaining: creditsPerMonth,
                serviceType,
                expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
            }
        });
    }

    return NextResponse.json({ status: "REPAIRED", message: "Abonnement synchronisé" });

  } catch (error) {
    console.error("Erreur check subscription:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
