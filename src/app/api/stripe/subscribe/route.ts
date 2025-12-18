import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { serviceType, daysPerWeek, petCount, billingCycle } = body;

    // Recalculer le prix côté serveur pour sécurité (copie de la logique frontend)
    const basePrices = { DOG_WALKING: 15, DAY_CARE: 20 };
    const unitPrice = basePrices[serviceType as "DOG_WALKING" | "DAY_CARE"];
    const totalDays = daysPerWeek * 4; // Par mois
    const rawPrice = (unitPrice * totalDays) * petCount;
    
    let discount = 0.10;
    if (daysPerWeek >= 3) discount = 0.15;
    if (daysPerWeek >= 5) discount = 0.20;

    const monthlyPrice = rawPrice * (1 - discount);
    const billingDiscount = billingCycle === "YEARLY" ? 0.20 : 0;
    const finalMonthlyPrice = monthlyPrice * (1 - billingDiscount);
    
    let amountToPay = finalMonthlyPrice;
    if (billingCycle === "YEARLY") {
        amountToPay = finalMonthlyPrice * 12;
    }
    
    const finalAmount = Math.round(amountToPay * 100);

    // Créer ou récupérer le client Stripe
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    let stripeCustomerId = user.stripeCustomerId;
    
    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: session.user.email!,
          name: session.user.name || undefined,
          metadata: { userId: session.user.id },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: session.user.id },
          data: { stripeCustomerId: customer.id },
        });
    }

    // Créer un produit dynamique pour cet abonnement (Nouveau plan)
    const product = await stripe.products.create({
      name: `Abonnement La Meute (${serviceType === "DOG_WALKING" ? "Promenade" : "Garderie"})`,
      description: `${daysPerWeek}j/semaine pour ${petCount} animal(aux). ${billingCycle === "YEARLY" ? "Facturation Annuelle" : "Facturation Mensuelle"}`,
    });

    const price = await stripe.prices.create({
      unit_amount: finalAmount,
      currency: "eur",
      recurring: {
        interval: billingCycle === "YEARLY" ? "year" : "month",
      },
      product: product.id,
    });

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const existingSubscription = await prisma.userSubscription.findUnique({
        where: { userId: session.user.id }
    });

    // MODE MISE À JOUR (SWAP)
    if (existingSubscription && existingSubscription.status === 'ACTIVE' && existingSubscription.stripeSubscriptionId) {
        // 1. Récupérer l'abonnement Stripe actuel pour avoir l'ID de l'item
        const stripeSub = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId);
        const itemId = stripeSub.items.data[0].id;

        // 2. Mettre à jour l'abonnement Stripe
        await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
            items: [{
                id: itemId,
                price: price.id, // Nouveau prix
            }],
            metadata: {
                userId: session.user.id,
                serviceType,
                creditsPerMonth: totalDays * petCount,
                daysPerWeek,
                petCount
            },
            proration_behavior: 'always_invoice', // Facturer la différence immédiatement
        });

        // 3. Mettre à jour la base locale
        await prisma.userSubscription.update({
            where: { userId: session.user.id },
            data: {
                serviceType: serviceType as any,
                daysPerWeek,
                creditsPerMonth: totalDays * petCount,
                price: amountToPay,
                billingPeriod: billingCycle,
            }
        });

        // 4. Rediriger vers le dashboard (pas de checkout nécessaire)
        return NextResponse.json({ url: `${process.env.NEXTAUTH_URL}/dashboard?subscription=updated` });
    }

    // MODE CRÉATION (CHECKOUT)
    // Créer la session de checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/subscriptions`,
      metadata: {
        userId: session.user.id,
        serviceType,
        creditsPerMonth: totalDays * petCount,
        daysPerWeek,
        petCount
      },
      subscription_data: {
        metadata: {
            userId: session.user.id,
            serviceType,
            creditsPerMonth: totalDays * petCount,
            daysPerWeek,
            petCount
        }
      }
    });

    return NextResponse.json({ url: checkoutSession.url });

  } catch (error: any) {
    console.error("Erreur création abonnement:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}