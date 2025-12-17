import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Helper pour parser une date ISO string en UTC (format YYYY-MM-DD)
function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const serviceType = searchParams.get("serviceType");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Les dates de début et de fin sont requises" },
        { status: 400 }
      );
    }

    if (!serviceType) {
      return NextResponse.json(
        { error: "Le type de service est requis" },
        { status: 400 }
      );
    }

    // Parser les dates en UTC pour éviter les problèmes de fuseau horaire
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);

    // Générer toutes les dates entre start et end
    const daysToCheck = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
      daysToCheck.push(new Date(currentDate));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Récupérer toutes les disponibilités pour la période
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
        serviceType: serviceType as any, // Filtrer par type de service
      },
    });

    // Récupérer les réservations confirmées qui chevauchent la période
    // Pour simplifier, on considère qu'une réservation confirmée bloque le service pour la journée
    const existingBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        // serviceType: serviceType as any, // Optionnel: décommenter si on peut avoir plusieurs types de services en parallèle
        OR: [
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: start } }
            ]
          }
        ]
      }
    });

    console.log("📅 Dates à vérifier:", daysToCheck.map(d => d.toISOString().split("T")[0]));
    console.log("🔍 Service type:", serviceType);
    console.log("🗄️ Disponibilités admin:", availabilities.length);
    console.log("🔒 Réservations existantes:", existingBookings.length);

    // Vérifier quelles dates sont disponibles ou non
    const dateStatuses = daysToCheck.map((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const checkDate = new Date(dateKey); // Date normalisée minuit UTC

      // 1. Vérifier la table Availability (Priorité Admin)
      const adminAvailability = availabilities.find((a) => {
        const aDateKey = a.date.toISOString().split("T")[0];
        return aDateKey === dateKey;
      });

      if (adminAvailability && !adminAvailability.available) {
        return { date: dateKey, available: false, reason: "Bloqué par admin" };
      }

      // 2. Vérifier les réservations existantes
      const hasBooking = existingBookings.some(booking => {
        const bStart = new Date(booking.startDate.toISOString().split("T")[0]);
        const bEnd = new Date(booking.endDate.toISOString().split("T")[0]);
        const cDate = new Date(dateKey);
        return cDate >= bStart && cDate <= bEnd;
      });

      if (hasBooking) {
        return { date: dateKey, available: false, reason: "Déjà réservé" };
      }

      // 3. Sinon disponible
      return {
        date: dateKey,
        available: true,
      };
    });

    // Trouver les dates non disponibles
    const unavailableDates = dateStatuses.filter((d) => !d.available);

    return NextResponse.json({
      available: unavailableDates.length === 0,
      totalDays: daysToCheck.length,
      availableDays: dateStatuses.filter((d) => d.available).length,
      unavailableDates: unavailableDates.map((d) => d.date),
      message:
        unavailableDates.length === 0
          ? "Toutes les dates sont disponibles ✅"
          : `${unavailableDates.length} date(s) non disponible(s)`,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification des disponibilités:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la vérification" },
      { status: 500 }
    );
  }
}
