import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { calculateSubscriptionPlan } from "@/lib/subscription-pricing";
import { SERVICE_TYPES } from "@/lib/services";
import { z } from "zod";

const subscribeSchema = z.object({
  serviceType: z.enum(SERVICE_TYPES),
  daysPerWeek: z.number().int().min(1).max(5),
  petCount: z.number().int().min(1).max(3),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

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
    const { serviceType, daysPerWeek, petCount, billingCycle } =
      subscribeSchema.parse(body);
    const plan = calculateSubscriptionPlan({
      serviceType,
      daysPerWeek,
      petCount,
      billingCycle,
    });

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

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId: session.user.id },
    });

    if (
      existingSubscription?.stripeSubscriptionId &&
      !["ACTIVE", "CANCELED", "CANCELED_REMOTE"].includes(existingSubscription.status)
    ) {
      return NextResponse.json(
        { error: "Régularisez d'abord l'abonnement existant depuis votre profil." },
        { status: 409 }
      );
    }

    if (
      existingSubscription &&
      existingSubscription.status === "ACTIVE" &&
      existingSubscription.billingPeriod !== billingCycle
    ) {
      return NextResponse.json(
        {
          error:
            "Le passage mensuel/annuel se fait à la fin de la période en cours pour éviter une facturation confuse.",
        },
        { status: 409 }
      );
    }

    // Créer un produit dynamique pour cet abonnement (Nouveau plan)
    const product = await stripe.products.create({
      name: `Abonnement La Meute (${plan.service.label})`,
      description: `${daysPerWeek}j/semaine pour ${petCount} animal(aux). ${billingCycle === "YEARLY" ? "Facturation annuelle" : "Facturation mensuelle"}`,
    });

    const price = await stripe.prices.create({
      unit_amount: plan.amountDueNowCents,
      currency: "eur",
      recurring: {
        interval: billingCycle === "YEARLY" ? "year" : "month",
      },
      product: product.id,
    });

    // MODE MISE À JOUR (SWAP)
    if (existingSubscription && existingSubscription.status === 'ACTIVE' && existingSubscription.stripeSubscriptionId) {
        // 1. Récupérer l'abonnement Stripe actuel pour avoir l'ID de l'item
        const stripeSub = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId);
        if (stripeSub.cancel_at_period_end || stripeSub.cancel_at) {
          return NextResponse.json(
            { error: "Annulez d'abord la résiliation programmée depuis votre profil." },
            { status: 409 }
          );
        }
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
                creditsPerMonth: String(plan.creditsPerMonth),
                daysPerWeek: String(daysPerWeek),
                petCount: String(petCount),
                billingCycle,
                monthlyPrice: plan.monthlyPrice.toFixed(2),
                effectiveCreditPrice: plan.effectiveCreditPrice.toFixed(2),
            },
            proration_behavior: 'none',
        });

        // 3. Mettre à jour la base locale
        await prisma.userSubscription.update({
            where: { userId: session.user.id },
            data: {
                serviceType,
                daysPerWeek,
                creditsPerMonth: plan.creditsPerMonth,
                price: plan.amountDueNow,
                billingPeriod: billingCycle,
            }
        });

        // 4. Rediriger vers le dashboard : pas de débit immédiat, nouveau tarif au prochain renouvellement.
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
        creditsPerMonth: String(plan.creditsPerMonth),
        daysPerWeek: String(daysPerWeek),
        petCount: String(petCount),
        billingCycle,
        monthlyPrice: plan.monthlyPrice.toFixed(2),
        effectiveCreditPrice: plan.effectiveCreditPrice.toFixed(2),
      },
      subscription_data: {
        metadata: {
            userId: session.user.id,
            serviceType,
            creditsPerMonth: String(plan.creditsPerMonth),
            daysPerWeek: String(daysPerWeek),
            petCount: String(petCount),
            billingCycle,
            monthlyPrice: plan.monthlyPrice.toFixed(2),
            effectiveCreditPrice: plan.effectiveCreditPrice.toFixed(2),
        }
      }
    });

    return NextResponse.json({ url: checkoutSession.url });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Configuration d'abonnement invalide",
          details: error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      );
    }

    console.error("Erreur création abonnement:", error);

    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
