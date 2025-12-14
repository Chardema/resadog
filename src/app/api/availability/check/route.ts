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

    console.log("📅 Dates à vérifier:", daysToCheck.map(d => d.toISOString().split("T")[0]));
    console.log("🔍 Service type:", serviceType);
    console.log("🗄️ Disponibilités en BDD:", availabilities.map(a => ({
      date: a.date.toISOString().split("T")[0],
      serviceType: a.serviceType,
      available: a.available
    })));

    // Vérifier quelles dates sont disponibles ou non
    // PAR DÉFAUT: toutes les dates sont disponibles
    // L'admin marque uniquement les indisponibilités
    const dateStatuses = daysToCheck.map((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // Chercher la disponibilité en comparant les dates normalisées
      const availability = availabilities.find((a) => {
        const aDateKey = a.date.toISOString().split("T")[0];
        return aDateKey === dateKey;
      });

      const status = {
        date: dateKey,
        // Si pas défini dans la BDD = disponible par défaut
        // Sinon, on prend la valeur de la BDD
        available: availability ? availability.available : true,
        defined: !!availability,
      };

      console.log(`✅ ${dateKey}: ${status.available ? "DISPONIBLE" : "INDISPONIBLE"} (défini: ${status.defined})`);

      return status;
    });

    // Trouver les dates non disponibles
    const unavailableDates = dateStatuses.filter((d) => !d.available);
    const undefinedDates = dateStatuses.filter((d) => !d.defined);

    return NextResponse.json({
      available: unavailableDates.length === 0,
      totalDays: daysToCheck.length,
      availableDays: dateStatuses.filter((d) => d.available).length,
      unavailableDates: unavailableDates.map((d) => d.date),
      undefinedDates: undefinedDates.map((d) => d.date),
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
