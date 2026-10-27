import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/auth/password";
import { distributedRateLimit } from "@/lib/rate-limit";
import { isHourlyServiceType, SERVICE_TYPES, type AppServiceType } from "@/lib/services";
import {
  countBookingsByDate,
  getHourlyBookingConflicts,
  parseUTCDate,
  toDateKey,
} from "@/lib/booking-availability";

type RequestedSlot = {
  date: string;
  startTime: string;
  duration: number;
};

function parseRequestedSlots(value: string | null): RequestedSlot[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((slot): slot is RequestedSlot =>
      typeof slot?.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(slot.date) &&
      typeof slot.startTime === "string" &&
      /^\d{2}:\d{2}$/.test(slot.startTime) &&
      typeof slot.duration === "number" &&
      Number.isFinite(slot.duration)
    );
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIp(request);
    const rateLimit = await distributedRateLimit(`availability-check:${identifier}`, {
      maxRequests: 60,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Trop de vérifications de disponibilités. Veuillez réessayer dans un instant." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.resetIn) },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const serviceType = searchParams.get("serviceType");
    const requestedSlots = parseRequestedSlots(searchParams.get("slots"));
    const selectedDates = (searchParams.get("dates") || "")
      .split(",")
      .map((date) => date.trim())
      .filter(Boolean);

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

    if (!SERVICE_TYPES.includes(serviceType as AppServiceType)) {
      return NextResponse.json(
        { error: "Le type de service est invalide" },
        { status: 400 }
      );
    }

    // Parser les dates en UTC pour éviter les problèmes de fuseau horaire
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);

    // Générer les dates à vérifier. Pour les visites/promenades, le client
    // peut sélectionner des dates non consécutives : on ne bloque que celles-ci.
    const daysToCheck = selectedDates.length > 0
      ? [...new Set(selectedDates)].sort().map(parseUTCDate)
      : (() => {
          const days = [];
          const currentDate = new Date(start);
          while (currentDate <= end) {
            days.push(new Date(currentDate));
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
          return days;
        })();

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
        serviceType: serviceType as AppServiceType,
      },
    });

    // Récupérer les réservations confirmées qui chevauchent la période.
    // Les visites/promenades non consécutives ne bloquent que leurs dates de passage.
    const existingBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["ACCEPTING", "CANCELLING", "CONFIRMED", "IN_PROGRESS"] },
        serviceType: serviceType as AppServiceType,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        serviceType: true,
        specialRequests: true,
      },
    });
    const isHourlyService = isHourlyServiceType(serviceType);
    const selectedDateKeys = new Set(daysToCheck.map(toDateKey));
    const bookingCountsByDate = isHourlyService
      ? new Map<string, number>()
      : countBookingsByDate(existingBookings, selectedDateKeys);
    const hourlyConflicts = isHourlyService
      ? getHourlyBookingConflicts(existingBookings, requestedSlots)
      : [];
    const hourlyConflictDateKeys = new Set(hourlyConflicts.map((slot) => slot.date));

    // Vérifier quelles dates sont disponibles ou non
    const dateStatuses = daysToCheck.map((date) => {
      const dateKey = toDateKey(date);
      // 1. Vérifier la table Availability (Priorité Admin)
      const adminAvailability = availabilities.find((a) => {
        const aDateKey = toDateKey(a.date);
        return aDateKey === dateKey;
      });

      if (adminAvailability && (!adminAvailability.available || adminAvailability.maxSlots <= 0)) {
        return { date: dateKey, available: false, reason: "Bloqué par admin" };
      }

      if (isHourlyService) {
        return {
          date: dateKey,
          available: !hourlyConflictDateKeys.has(dateKey),
          reason: hourlyConflictDateKeys.has(dateKey) ? "Créneau déjà réservé" : undefined,
        };
      }

      // 2. Vérifier les réservations existantes et la capacité.
      const maxSlots = adminAvailability?.maxSlots ?? 1;
      const bookingCount = bookingCountsByDate.get(dateKey) || 0;

      if (bookingCount >= maxSlots) {
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
