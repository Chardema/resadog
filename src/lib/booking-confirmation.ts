import { Prisma } from "@prisma/client";
import {
  countBookingsByDate,
  getBookingDateKeys,
  getBookingSlotsForDate,
  getDateRangeBounds,
  getHourlyBookingConflicts,
  toDateKey,
} from "@/lib/booking-availability";
import { prisma } from "@/lib/db/prisma";
import { isHourlyServiceType } from "@/lib/services";

const bookingForConfirmation = Prisma.validator<Prisma.BookingDefaultArgs>()({
  include: {
    payment: true,
    client: true,
    pets: true,
    pet: true,
  },
});

export class BookingConfirmationError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "BUSY" | "INVALID_STATUS" | "INVALID_PAYMENT" | "UNAVAILABLE",
    message: string,
    public readonly blockedDates: string[] = []
  ) {
    super(message);
  }
}

/**
 * Réserve atomiquement la capacité avant d'appeler Stripe. Les advisory locks
 * sérialisent les confirmations pour chaque couple service/date, y compris
 * lorsque plusieurs instances serveur traitent des requêtes concurrentes.
 */
export async function claimBookingForConfirmation(bookingId: string) {
  return prisma.$transaction(async (tx) => {
    let booking = await tx.booking.findUnique({
      where: { id: bookingId },
      ...bookingForConfirmation,
    });

    if (!booking) {
      throw new BookingConfirmationError("NOT_FOUND", "Réservation non trouvée");
    }

    if (booking.status === "CONFIRMED") {
      return { booking, unchanged: true };
    }

    const staleAcceptingBefore = new Date(Date.now() - 10 * 60 * 1000);
    const isRecoverableAccepting =
      booking.status === "ACCEPTING" && booking.updatedAt <= staleAcceptingBefore;

    if (booking.status === "ACCEPTING" && !isRecoverableAccepting) {
      throw new BookingConfirmationError(
        "BUSY",
        "Cette réservation est déjà en cours de validation. Réessayez dans quelques instants."
      );
    }

    if (booking.status !== "PENDING" && !isRecoverableAccepting) {
      throw new BookingConfirmationError(
        "INVALID_STATUS",
        "Cette réservation ne peut pas être confirmée depuis son statut actuel."
      );
    }

    if (!booking.payment?.stripePaymentId) {
      throw new BookingConfirmationError(
        "INVALID_PAYMENT",
        "Aucune autorisation Stripe n'est rattachée à cette réservation."
      );
    }

    const bookingDateKeys = getBookingDateKeys(booking);
    const serviceType = booking.serviceType;
    const lockKeys = bookingDateKeys
      .map((dateKey) => `booking-confirmation:${serviceType}:${dateKey}`)
      .sort();

    for (const lockKey of lockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    }

    // Le statut peut avoir changé pendant l'attente du verrou.
    booking = await tx.booking.findUnique({
      where: { id: bookingId },
      ...bookingForConfirmation,
    });
    if (!booking) {
      throw new BookingConfirmationError("NOT_FOUND", "Réservation non trouvée");
    }
    if (booking.status === "CONFIRMED") return { booking, unchanged: true };

    const isStillRecoverable =
      booking.status === "ACCEPTING" && booking.updatedAt <= staleAcceptingBefore;
    if (booking.status !== "PENDING" && !isStillRecoverable) {
      throw new BookingConfirmationError(
        booking.status === "ACCEPTING" ? "BUSY" : "INVALID_STATUS",
        booking.status === "ACCEPTING"
          ? "Cette réservation est déjà en cours de validation."
          : "Cette réservation ne peut pas être confirmée depuis son statut actuel."
      );
    }

    const selectedDateKeys = new Set(bookingDateKeys);
    const { start, end } = getDateRangeBounds(bookingDateKeys);
    const isHourlyService = isHourlyServiceType(booking.serviceType);
    const [availabilities, existingServiceBookings] = await Promise.all([
      tx.availability.findMany({
        where: {
          date: { gte: start, lte: end },
          serviceType: booking.serviceType,
        },
      }),
      tx.booking.findMany({
        where: {
          id: { not: booking.id },
          status: { in: ["ACCEPTING", "CANCELLING", "CONFIRMED", "IN_PROGRESS"] },
          serviceType: booking.serviceType,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          startTime: true,
          endTime: true,
          serviceType: true,
          specialRequests: true,
        },
      }),
    ]);

    const availabilityByDate = new Map(
      availabilities.map((availability) => [toDateKey(availability.date), availability])
    );
    const bookingCountsByDate = isHourlyService
      ? new Map<string, number>()
      : countBookingsByDate(existingServiceBookings, selectedDateKeys);
    const requestedSlots = bookingDateKeys.flatMap((dateKey) =>
      getBookingSlotsForDate(booking, dateKey).map((slot) => ({
        date: dateKey,
        startTime: slot.startTime,
        duration: slot.duration,
      }))
    );
    const hourlyConflictDateKeys = new Set(
      isHourlyService
        ? getHourlyBookingConflicts(existingServiceBookings, requestedSlots)
            .map((slot) => slot.date || "")
        : []
    );
    const blockedDateKeys = bookingDateKeys.filter((dateKey) => {
      const availability = availabilityByDate.get(dateKey);
      if (availability && (!availability.available || availability.maxSlots <= 0)) return true;
      if (isHourlyService) return hourlyConflictDateKeys.has(dateKey);
      return (bookingCountsByDate.get(dateKey) || 0) >= (availability?.maxSlots ?? 1);
    });

    if (blockedDateKeys.length > 0) {
      throw new BookingConfirmationError(
        "UNAVAILABLE",
        isHourlyService
          ? `Cette réservation ne peut plus être acceptée : ${blockedDateKeys.length} créneau(x) sont déjà bloqués ou réservés.`
          : `Cette réservation ne peut plus être acceptée : ${blockedDateKeys.length} date(s) sont déjà bloquées ou réservées.`,
        blockedDateKeys
      );
    }

    const claimed = await tx.booking.updateMany({
      where: {
        id: booking.id,
        ...(isStillRecoverable
          ? { status: "ACCEPTING", updatedAt: { lte: staleAcceptingBefore } }
          : { status: "PENDING" }),
      },
      data: { status: "ACCEPTING" },
    });
    if (claimed.count !== 1) {
      throw new BookingConfirmationError("BUSY", "La réservation vient d'être modifiée.");
    }

    return {
      booking: { ...booking, status: "ACCEPTING" as const, updatedAt: new Date() },
      unchanged: false,
    };
  }, { maxWait: 5_000, timeout: 15_000 });
}

export async function releaseBookingConfirmationClaim(bookingId: string) {
  await prisma.booking.updateMany({
    where: { id: bookingId, status: "ACCEPTING" },
    data: { status: "PENDING" },
  });
}
