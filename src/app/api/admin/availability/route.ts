import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const availabilitySchema = z.object({
  date: z.string().datetime(),
  available: z.boolean(),
  serviceType: z.enum(["BOARDING", "DAY_CARE", "DROP_IN", "DOG_WALKING"]),
  maxSlots: z.number().int().min(0).max(10).optional(),
  notes: z.string().optional(),
});

// GET - Récupérer les disponibilités d'un mois
// Accessible à tous les utilisateurs (authentifiés ou non) pour voir les disponibilités
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const serviceType = searchParams.get("serviceType");

    if (!month || !year) {
      return NextResponse.json(
        { error: "Mois et année requis" },
        { status: 400 }
      );
    }

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    // Construire la requête avec ou sans filtre serviceType
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (serviceType) {
      whereClause.serviceType = serviceType;
    }

    const availabilities = await prisma.availability.findMany({
      where: whereClause,
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json({ availabilities });
  } catch (error) {
    console.error("Erreur lors de la récupération des disponibilités:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// POST - Définir une disponibilité
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = availabilitySchema.parse(body);

    // Créer la date en UTC pour cohérence
    const date = new Date(validatedData.date);
    // Utiliser UTC au lieu de l'heure locale
    const utcDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12, // Midi UTC pour éviter les problèmes de bascule
      0,
      0
    ));

    // Vérifier si une disponibilité existe déjà pour cette date et ce type de service
    const existing = await prisma.availability.findUnique({
      where: {
        date_serviceType: {
          date: utcDate,
          serviceType: validatedData.serviceType,
        },
      },
    });

    let availability;
    if (existing) {
      // Mettre à jour
      availability = await prisma.availability.update({
        where: {
          date_serviceType: {
            date: utcDate,
            serviceType: validatedData.serviceType,
          },
        },
        data: {
          available: validatedData.available,
          maxSlots: validatedData.maxSlots || 1,
          notes: validatedData.notes,
        },
      });
    } else {
      // Créer
      availability = await prisma.availability.create({
        data: {
          date: utcDate,
          serviceType: validatedData.serviceType,
          available: validatedData.available,
          maxSlots: validatedData.maxSlots || 1,
          notes: validatedData.notes,
        },
      });
    }

    return NextResponse.json({
      availability,
      message: "Disponibilité mise à jour avec succès",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Erreur lors de la mise à jour de la disponibilité:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
