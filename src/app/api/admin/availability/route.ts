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

const vacationSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["BLOCK", "RESTORE"]),
  label: z.string().trim().max(120).optional(),
});

const SERVICE_TYPES = ["BOARDING", "DAY_CARE", "DROP_IN", "DOG_WALKING"] as const;
const VACATION_PREFIX = "[VACATION]";
const MAX_VACATION_DAYS = 120;

type PreviousAvailability = {
  available: boolean;
  maxSlots: number;
  notes: string | null;
};

type VacationMetadata = {
  label: string;
  previous: PreviousAvailability | null;
};

function parseVacationMetadata(notes: string | null | undefined): VacationMetadata | null {
  if (!notes?.startsWith(VACATION_PREFIX)) return null;

  try {
    return JSON.parse(notes.slice(VACATION_PREFIX.length)) as VacationMetadata;
  } catch {
    return null;
  }
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getDateRange(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate && dates.length <= MAX_VACATION_DAYS) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

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
          maxSlots: validatedData.maxSlots ?? 1,
          notes: validatedData.notes ?? null,
        },
      });
    } else {
      // Créer
      availability = await prisma.availability.create({
        data: {
          date: utcDate,
          serviceType: validatedData.serviceType,
          available: validatedData.available,
          maxSlots: validatedData.maxSlots ?? 1,
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

// PUT - Bloquer ou restaurer tous les services sur une période de vacances
export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const validatedData = vacationSchema.parse(await request.json());
    const startDate = parseCalendarDate(validatedData.startDate);
    const endDate = parseCalendarDate(validatedData.endDate);

    if (!startDate || !endDate || endDate < startDate) {
      return NextResponse.json({ error: "Période de vacances invalide" }, { status: 400 });
    }

    const dates = getDateRange(startDate, endDate);
    if (dates.length === 0 || dates.length > MAX_VACATION_DAYS) {
      return NextResponse.json(
        { error: `Une période ne peut pas dépasser ${MAX_VACATION_DAYS} jours` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingAvailabilities = await tx.availability.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          serviceType: { in: [...SERVICE_TYPES] },
        },
      });
      const existingByKey = new Map(
        existingAvailabilities.map((availability) => [
          `${availability.date.toISOString()}-${availability.serviceType}`,
          availability,
        ])
      );

      if (validatedData.action === "BLOCK") {
        for (const date of dates) {
          for (const serviceType of SERVICE_TYPES) {
            const key = `${date.toISOString()}-${serviceType}`;
            const existing = existingByKey.get(key);
            const existingVacation = parseVacationMetadata(existing?.notes);
            const previous = existingVacation ? existingVacation.previous : (existing ? {
              available: existing.available,
              maxSlots: existing.maxSlots,
              notes: existing.notes,
            } : null);
            const metadata: VacationMetadata = {
              label: validatedData.label || "Vacances",
              previous,
            };

            await tx.availability.upsert({
              where: { date_serviceType: { date, serviceType } },
              update: {
                available: false,
                maxSlots: 0,
                notes: `${VACATION_PREFIX}${JSON.stringify(metadata)}`,
              },
              create: {
                date,
                serviceType,
                available: false,
                maxSlots: 0,
                notes: `${VACATION_PREFIX}${JSON.stringify(metadata)}`,
              },
            });
          }
        }

        return dates.length * SERVICE_TYPES.length;
      }

      const vacationAvailabilities = existingAvailabilities.filter((availability) =>
        availability.notes?.startsWith(VACATION_PREFIX)
      );

      for (const availability of vacationAvailabilities) {
        const metadata = parseVacationMetadata(availability.notes);

        if (!metadata?.previous) {
          await tx.availability.delete({ where: { id: availability.id } });
          continue;
        }

        await tx.availability.update({
          where: { id: availability.id },
          data: metadata.previous,
        });
      }

      return vacationAvailabilities.length;
    }, { timeout: 30_000 });

    return NextResponse.json({
      affectedDates: dates.length,
      affectedServices: result,
      message: validatedData.action === "BLOCK"
        ? "Période de vacances activée"
        : "Période de vacances retirée",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("Erreur lors de la mise à jour des vacances:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
