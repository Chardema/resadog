import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

// Helper pour parser une date ISO string en UTC (format YYYY-MM-DD)
function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

// Schéma de validation pour la création de réservation
const createBookingSchema = z.object({
  petId: z.string().min(1, "L'animal est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  startTime: z.string().optional(), // Heure de dépôt (HH:mm)
  endTime: z.string().optional(),   // Heure de récupération (HH:mm)
  serviceType: z.enum(["BOARDING", "DAY_CARE", "DROP_IN", "DOG_WALKING"]),
  totalPrice: z.number().positive("Le prix doit être positif"),
  depositAmount: z.number().positive("Le montant doit être positif"),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(["PAYPAL", "WERO", "BANK_TRANSFER"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté pour créer une réservation" },
        { status: 401 }
      );
    }

    // Parser et valider les données
    const body = await request.json();
    const validatedData = createBookingSchema.parse(body);

    const {
      petId,
      startDate,
      endDate,
      startTime,
      endTime,
      serviceType,
      totalPrice,
      depositAmount,
      notes,
      promoCode,
      paymentMethod,
    } = validatedData;

    // Convertir les dates en UTC pour éviter les problèmes de fuseau horaire
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);

    // Vérifier que la date de fin est après la date de début
    if (end <= start) {
      return NextResponse.json(
        { error: "La date de fin doit être après la date de début" },
        { status: 400 }
      );
    }

    // Vérifier que l'animal appartient bien à l'utilisateur
    const pet = await prisma.pet.findFirst({
      where: {
        id: petId,
        ownerId: session.user.id,
      },
    });

    if (!pet) {
      return NextResponse.json(
        { error: "Cet animal n'existe pas ou ne vous appartient pas" },
        { status: 404 }
      );
    }

    // Vérifier les disponibilités pour toutes les dates de la période
    const daysToCheck = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
      daysToCheck.push(new Date(currentDate));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Récupérer toutes les disponibilités pour ces dates et ce type de service
    const startOfRange = new Date(start);
    startOfRange.setUTCHours(0, 0, 0, 0);
    const endOfRange = new Date(end);
    endOfRange.setUTCHours(23, 59, 59, 999);

    const availabilities = await prisma.availability.findMany({
      where: {
        date: {
          gte: startOfRange,
          lte: endOfRange,
        },
        serviceType, // Important: filtrer par type de service !
      },
    });

    console.log("📅 Vérification réservation:", {
      serviceType,
      dates: daysToCheck.map(d => d.toISOString().split("T")[0]),
      availabilitiesInDB: availabilities.map(a => ({
        date: a.date.toISOString().split("T")[0],
        available: a.available
      }))
    });

    // Vérifier que toutes les dates sont disponibles
    // PAR DÉFAUT: toutes les dates sont disponibles
    // Seules les dates marquées explicitement comme indisponibles bloquent la réservation
    const unavailableDates = daysToCheck.filter((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const availability = availabilities.find(
        (a) => a.date.toISOString().split("T")[0] === dateKey
      );
      // La date est indisponible UNIQUEMENT si elle existe dans la BDD ET est marquée comme indisponible
      return availability && !availability.available;
    });

    if (unavailableDates.length > 0) {
      const formattedDates = unavailableDates
        .map((d) => d.toLocaleDateString("fr-FR"))
        .join(", ");
      return NextResponse.json(
        {
          error: `Les dates suivantes ne sont pas disponibles: ${formattedDates}. Veuillez contacter le gardien ou choisir d'autres dates.`,
        },
        { status: 400 }
      );
    }

    // Vérifier les conflits avec d'autres réservations pour le même animal
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        petId,
        status: {
          in: ["PENDING", "CONFIRMED", "IN_PROGRESS"],
        },
        OR: [
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: start } },
            ],
          },
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: end } },
            ],
          },
          {
            AND: [
              { startDate: { gte: start } },
              { endDate: { lte: end } },
            ],
          },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      return NextResponse.json(
        {
          error:
            "Une réservation existe déjà pour cet animal sur cette période",
        },
        { status: 400 }
      );
    }

    // Gérer le code promo si présent
    let finalPrice = totalPrice;
    let discount = 0;
    let appliedPromoCode = null;

    if (promoCode) {
      // TODO: Implémenter la logique des codes promo
      // Pour l'instant, on accepte le code mais on ne l'applique pas
      appliedPromoCode = promoCode;
    }

    // Créer la réservation
    const booking = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        startTime: startTime || null,
        endTime: endTime || null,
        status: "PENDING",
        serviceType,
        totalPrice: finalPrice,
        depositPaid: false,
        depositAmount,
        specialRequests: notes || null,
        notes: paymentMethod ? `Mode de paiement: ${paymentMethod}` : null,
        clientId: session.user.id,
        petId,
        // TODO: Ajouter le code promo quand le modèle sera mis à jour
      },
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
          },
        },
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        serviceType: booking.serviceType,
        status: booking.status,
        totalPrice: booking.totalPrice,
        depositAmount: booking.depositAmount,
        pet: booking.pet,
        client: booking.client,
      },
      message: "Réservation créée avec succès! En attente de confirmation du gardien.",
    });
  } catch (error) {
    console.error("Erreur lors de la création de la réservation:", error);

    // Gérer les erreurs de validation Zod
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de la création de la réservation",
      },
      { status: 500 }
    );
  }
}

// GET: Récupérer les réservations de l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    // Récupérer toutes les réservations de l'utilisateur
    const bookings = await prisma.booking.findMany({
      where: {
        clientId: session.user.id,
      },
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        serviceType: b.serviceType,
        status: b.status,
        totalPrice: b.totalPrice,
        depositAmount: b.depositAmount,
        depositPaid: b.depositPaid,
        pet: b.pet,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
