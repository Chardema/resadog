import type { PaymentStatus } from "@prisma/client";

export type BookingConversionCandidate = {
  totalPrice: number;
  depositPaid: boolean;
  payment: {
    status: PaymentStatus;
    stripePaymentId: string | null;
    amount: number;
  } | null;
};

// Une réservation compte comme conversion si le paiement est capturé, si
// l'acompte est réglé, ou si l'empreinte Stripe est posée (PROCESSING avec
// stripePaymentId, écrit par le webhook checkout.session.completed). Une
// session Checkout ouverte (PROCESSING sans stripePaymentId) ne suffit pas.
export function isBookingPaidForConversion(booking: BookingConversionCandidate) {
  if (booking.depositPaid === true) return true;
  const payment = booking.payment;
  if (!payment) return false;
  if (payment.status === "SUCCEEDED" || payment.status === "PARTIALLY_REFUNDED") return true;
  return payment.status === "PROCESSING" && Boolean(payment.stripePaymentId?.trim());
}

// Valeur transmise à Google : montant de la réservation en base, à défaut
// le montant du paiement. Jamais la valeur fournie dans l'URL.
export function getBookingConversionValue(booking: BookingConversionCandidate) {
  const candidates = [booking.totalPrice, booking.payment?.amount];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate * 100) / 100;
    }
  }
  return null;
}
