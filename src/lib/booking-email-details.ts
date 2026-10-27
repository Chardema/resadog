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
