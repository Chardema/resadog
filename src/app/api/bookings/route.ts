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
  petIds: z.array(z.string()).min(1, "Au moins un animal est requis"),
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
    
    // Support backward compatibility if frontend sends single petId
    if (body.petId && !body.petIds) {
      body.petIds = [body.petId];
    }

    const validatedData = createBookingSchema.parse(body);

    const {
      petIds,
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

    // --- Validation des contraintes de capacité ---
    if (serviceType === "BOARDING" && petIds.length > 2) {
      return NextResponse.json(
        { error: "Maximum 2 animaux pour l'hébergement" },
        { status: 400 }
      );
    }
    if (serviceType === "DAY_CARE" && petIds.length > 2) {
      return NextResponse.json(
        { error: "Maximum 2 animaux pour la garderie" },
        { status: 400 }
      );
    }
    // DROP_IN et DOG_WALKING sont illimités (logic handled naturally)

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

    // Vérifier que TOUS les animaux appartiennent bien à l'utilisateur
    const pets = await prisma.pet.findMany({
      where: {
        id: { in: petIds },
        ownerId: session.user.id,
      },
    });

    if (pets.length !== petIds.length) {
      return NextResponse.json(
        { error: "Certains animaux n'existent pas ou ne vous appartiennent pas" },
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

    // Vérifier que toutes les dates sont disponibles (Admin blocking)
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

    // Créer une nouvelle réservation
    // Note: On ne met pas à jour les réservations PENDING existantes car avec le multi-pet
    // la logique de fusion devient complexe. On crée toujours une nouvelle entrée.
    
    // Vérifier les conflits réels (réservations CONFIRMED ou IN_PROGRESS)
    // Pour simplifier : si UN des animaux a déjà une réservation confirmée, c'est bloqué.
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        pets: { some: { id: { in: petIds } } },
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        OR: [
          {
            AND: [{ startDate: { lte: start } }, { endDate: { gte: start } }],
          },
          {
            AND: [{ startDate: { lte: end } }, { endDate: { gte: end } }],
          },
          {
            AND: [{ startDate: { gte: start } }, { endDate: { lte: end } }],
          },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      return NextResponse.json(
        {
          error: "Une réservation confirmée existe déjà pour l'un de ces animaux sur cette période",
        },
        { status: 400 }
      );
    }

    // Créer une nouvelle réservation
    const booking = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        startTime: startTime || null,
        endTime: endTime || null,
        status: "PENDING",
        serviceType,
        totalPrice,
        depositPaid: false,
        depositAmount,
        specialRequests: notes || null,
        notes: paymentMethod ? `Mode de paiement: ${paymentMethod}` : null,
        clientId: session.user.id,
        // Liaison Many-to-Many
        pets: {
          connect: petIds.map((id) => ({ id })),
        },
        // Backward compatibility (optional, points to first pet)
        petId: petIds[0],
      },
      include: {
        pets: { select: { name: true, breed: true } },
        client: { select: { name: true, email: true } },
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
        pets: booking.pets,
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
        pets: {
          select: {
            name: true,
            breed: true,
          },
        },
        // Fallback for old bookings
        pet: {
          select: {
            name: true,
            breed: true,
          }
        }
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
        // Combine old and new pets logic
        pets: b.pets.length > 0 ? b.pets : (b.pet ? [b.pet] : []),
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