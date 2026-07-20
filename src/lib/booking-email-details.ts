import { getServiceLabel } from "@/lib/services";

type BookingForEmail = {
  id: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  serviceType: string;
  pets?: { name: string }[];
  pet?: { name: string | null } | null;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
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
    startDate: formatDate(booking.startDate),
    endDate: formatDate(booking.endDate),
    totalPrice: booking.totalPrice,
  };
}
