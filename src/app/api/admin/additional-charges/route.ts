import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import Stripe from "stripe";
import { z } from "zod";

const chargeSchema = z.object({
  bookingId: z.string(),
  amount: z.number().positive(),
  reason: z.string().min(3),
  description: z.string().optional(),
});

// Créer un supplément et débiter automatiquement
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = chargeSchema.parse(body);

    // Charger la réservation avec le client
    const booking = await prisma.booking.findUnique({
      where: { id: validatedData.bookingId },
      include: {
        client: true,
        pets: true,
        pet: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation introuvable" },
        { status: 404 }
      );
    }

    // Vérifier que le client a un Payment Method enregistré
    if (!booking.client.paymentMethodId) {
      return NextResponse.json(
        {
          error: "Le client n'a pas de carte enregistrée. Impossible de débiter automatiquement.",
        },
        { status: 400 }
      );
    }

    if (!booking.client.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client Stripe non configuré" },
        { status: 400 }
      );
    }

    // Nom des animaux pour la description
    const petsName = booking.pets.length > 0 
      ? booking.pets.map(p => p.name).join(", ") 
      : (booking.pet?.name || "Animal");

    // 🚀 Débiter automatiquement la carte enregistrée
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(validatedData.amount * 100), // Convertir en centimes
      currency: "eur",
      customer: booking.client.stripeCustomerId,
      payment_method: booking.client.paymentMethodId,
      off_session: true, // 🔑 IMPORTANT : Permet de débiter sans que le client soit présent
      confirm: true, // Confirmer immédiatement le paiement
      description: `Supplément: ${validatedData.reason} - Réservation ${petsName}`,
      metadata: {
        bookingId: booking.id,
        userId: booking.client.id,
        type: "additional_charge",
        reason: validatedData.reason,
      },
    });

    // Créer l'enregistrement dans la BDD
    const additionalCharge = await prisma.additionalCharge.create({
      data: {
        bookingId: booking.id,
        amount: validatedData.amount,
        reason: validatedData.reason,
        description: validatedData.description,
        status: paymentIntent.status === "succeeded" ? "SUCCEEDED" : "PROCESSING",
        stripePaymentId: paymentIntent.id,
        chargedAt: paymentIntent.status === "succeeded" ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      charge: additionalCharge,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      message: paymentIntent.status === "succeeded"
        ? `Supplément de ${validatedData.amount}€ débité avec succès sur la carte •••• ${booking.client.cardLast4}`
        : "Le paiement est en cours de traitement",
    });
  } catch (error) {
    console.error("Erreur lors du débit du supplément:", error);

    // Gérer les erreurs Stripe spécifiques
    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        {
          error: "Échec du paiement",
          details: error.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Une erreur est survenue lors du débit" },
      { status: 500 }
    );
  }
}

// Récupérer tous les suppléments d'une réservation
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId requis" },
        { status: 400 }
      );
    }

    // Vérifier les droits d'accès
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clientId: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation introuvable" },
        { status: 404 }
      );
    }

    // Seul le client ou un admin peut voir les suppléments
    if (booking.clientId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const charges = await prisma.additionalCharge.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ charges });
  } catch (error) {
    console.error("Erreur lors du chargement des suppléments:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}