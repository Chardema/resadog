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
    const metadata = stripeSub.metadata; // On espère que les metadata sont là, sinon on les récupère de la session checkout

    // Si les metadata sont vides sur l'abo (car mis sur la session), on doit récupérer la session
    // Mais simplifions : Si on trouve un abo actif et qu'on a rien en base, on le crée.
    // On a besoin des détails (credits, serviceType) qui étaient dans les metadata de la session.
    
    // Récupération de la session qui a créé cet abonnement (via latest_invoice -> payment_intent ou autre ?)
    // C'est complexe de remonter à la session.
    // Solution de secours : On utilise les metadata stockées sur l'abonnement SI on les a mises lors de la création (via subscription_data.metadata)
    
    // MAIS, dans mon code checkout, j'ai mis les metadata sur la SESSION, pas explicitement sur l'abonnement via `subscription_data`.
    // Stripe copie parfois, mais pas toujours.
    
    // Correctif immédiat pour l'avenir : mettre les metadata sur subscription_data.
    // Pour l'instant présent : On va essayer de deviner ou laisser le webhook faire son travail plus tard.
    // Sauf si... je peux récupérer la dernière transaction.

    // On va mettre à jour le statut en base si l'ID correspond
    const dbSub = await prisma.userSubscription.findUnique({ where: { userId: session.user.id } });
    
    if (dbSub && dbSub.stripeSubscriptionId === stripeSub.id) {
        if (dbSub.status !== 'ACTIVE') {
            await prisma.userSubscription.update({
                where: { id: dbSub.id },
                data: { status: 'ACTIVE' }
            });
            return NextResponse.json({ status: "UPDATED", message: "Abonnement activé" });
        }
    } else if (!dbSub) {
        // Cas critique : Webhook n'a pas encore créé l'abo en base.
        // On ne peut pas le créer ici sans les infos de serviceType/credits.
        // On va juste renvoyer "PENDING_WEBHOOK"
        return NextResponse.json({ status: "PENDING_WEBHOOK", message: "En attente de validation Stripe..." });
    }

    return NextResponse.json({ status: "SYNCED" });

  } catch (error) {
    console.error("Erreur check subscription:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
