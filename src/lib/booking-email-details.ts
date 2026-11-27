import { LEGAL_INFORMATION } from "@/lib/legal";
import { extractServiceDetails } from "@/lib/booking-details";
import { isDropOffService } from "@/lib/booking-attendance";
import { getServiceLabel } from "@/lib/services";

type BookingForEmail = {
  id: string;
  startDate: Date;
  endDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  specialRequests?: string | null;
  totalPrice: number;
  serviceType: string;
  pets?: { name: string }[];
  pet?: { name: string | null } | null;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const formatShortDate = (date: Date) => date.toLocaleDateString("fr-FR", { timeZone: "UTC" });

type ServicePeriodInput = Pick<BookingForEmail, "startDate" | "endDate" | "startTime" | "endTime">;

// Période de la prestation pour les factures et le Checkout Stripe, avec une
// seule mention du fuseau : « du 04 janvier 2027 à 18:00 au 07 janvier 2027
// à 10:00 (heure de Paris) », ou « le 04 janvier 2027 de 09:00 à 18:00
// (heure de Paris) » pour une prestation sur un seul jour.
export function formatServicePeriod(booking: ServicePeriodInput, dateStyle: "long" | "short" = "long") {
  const format = dateStyle === "long" ? formatDate : formatShortDate;
  const start = format(new Date(booking.startDate));
  const end = format(new Date(booking.endDate));
  const startTime = booking.startTime?.trim() || null;
  const endTime = booking.endTime?.trim() || null;
  const timeZoneNote = startTime || endTime ? " (heure de Paris)" : "";

  if (start === end) {
    if (startTime && endTime && startTime !== endTime) return `le ${start} de ${startTime} à ${endTime}${timeZoneNote}`;
    const time = startTime || endTime;
    return `le ${start}${time ? ` à ${time}` : ""}${timeZoneNote}`;
  }

  return `du ${start}${startTime ? ` à ${startTime}` : ""} au ${end}${endTime ? ` à ${endTime}` : ""}${timeZoneNote}`;
}

function getBookingPetNames(booking: BookingForEmail) {
  if (booking.pets && booking.pets.length > 0) {
    return booking.pets.map((pet) => pet.name).join(", ");
  }

  return booking.pet?.name || "Votre compagnon";
}

export function getBookingEmailDetails(booking: BookingForEmail) {
  return {
    bookingId: booking.id,
    petName: getBookingPetNames(booking),
    serviceLabel: getServiceLabel(booking.serviceType),
    startDate: `${formatDate(booking.startDate)}${booking.startTime ? ` à ${booking.startTime} (Paris)` : ""}`,
    endDate: `${formatDate(booking.endDate)}${booking.endTime ? ` à ${booking.endTime} (Paris)` : ""}`,
    serviceAddress: isDropOffService(booking.serviceType) ? LEGAL_INFORMATION.address : extractServiceDetails(booking.specialRequests)?.serviceAddress || "Adresse à convenir avec notre équipe",
    totalPrice: booking.totalPrice,
  };
}
