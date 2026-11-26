import type { Prisma } from "@prisma/client";
import { getTodayDateKey } from "@/lib/booking-dates";
import type { prisma } from "@/lib/db/prisma";
import { sendBookingDepositConfirmationEmail } from "@/lib/email";
import { getBalanceSchedule } from "@/lib/payment-plan";
import { stripe } from "@/lib/stripe/config";

// Lot 3 de la spec 07 : à l'acceptation d'une réservation DEPOSIT_BALANCE,
// seul l'acompte (montant du PaymentIntent autorisé) est capturé ; le solde
// devient une échéance BookingInstallment BALANCE à J-7, prélevée par le cron
// du lot 5. Une réservation FULL ne passe jamais par ce module.

export const getBalanceInstallmentKey = (bookingId: string) => `booking:${bookingId}:balance`;

export type BalancePlanBooking = {
  id: string;
  paymentPlan: string;
  startDate: Date;
  depositAmount: number | null;
  balanceAmount: number | null;
  balanceDueAt: Date | null;
};

export const isDepositBalanceBooking = (booking: { paymentPlan?: string | null }) =>
  booking.paymentPlan === "DEPOSIT_BALANCE";

// Échéance du solde : montant et date figés au consentement (checkout.session.completed).
export function getBalanceInstallmentData(booking: BalancePlanBooking) {
  if (!isDepositBalanceBooking(booking)) return null;
  const amount = booking.balanceAmount;
  if (amount === null || !(amount > 0)) {
    throw new Error(`Solde absent pour la réservation ${booking.id} (plan acompte)`);
  }
  return {
    bookingId: booking.id,
    kind: "BALANCE" as const,
    amount: Math.round(amount * 100) / 100,
    status: "SCHEDULED" as const,
    dueAt: booking.balanceDueAt ?? getBalanceSchedule(booking.startDate).dueAt,
    idempotencyKey: getBalanceInstallmentKey(booking.id),
  };
}

type InstallmentClient = typeof prisma | Prisma.TransactionClient;

// Idempotent : la validation admin et la réparation par webhook peuvent
// toutes deux l'appeler ; la clé unique garantit une seule échéance.
export async function ensureBalanceInstallment(db: InstallmentClient, booking: BalancePlanBooking) {
  const data = getBalanceInstallmentData(booking);
  if (!data) return null;
  return db.bookingInstallment.upsert({
    where: { idempotencyKey: data.idempotencyKey },
    update: {},
    create: data,
  });
}

async function getSavedCardLast4(paymentMethodId: string | null | undefined) {
  if (!paymentMethodId) return null;
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId).catch(() => null);
  return paymentMethod?.card?.last4 ?? null;
}

export type DepositConfirmationBooking = BalancePlanBooking & {
  client: { email: string; name: string | null };
  payment: { stripePaymentMethodId: string | null } | null;
};

// E-mail « réservation validée » avec le calendrier acompte / solde.
export async function sendDepositConfirmationEmail(booking: DepositConfirmationBooking, now = new Date()) {
  if (booking.depositAmount === null || booking.balanceAmount === null) {
    throw new Error(`Montants du plan acompte absents pour la réservation ${booking.id}`);
  }
  const balanceDueAt = booking.balanceDueAt ?? getBalanceSchedule(booking.startDate).dueAt;
  return sendBookingDepositConfirmationEmail(
    booking.client.email,
    booking.client.name || "Client",
    {
      depositAmount: booking.depositAmount,
      balanceAmount: booking.balanceAmount,
      balanceDueDate: getTodayDateKey(balanceDueAt),
      depositCapturedDate: getTodayDateKey(now),
      cardLast4: await getSavedCardLast4(booking.payment?.stripePaymentMethodId),
    },
    { idempotencyKey: `booking-deposit-confirmation-${booking.id}` }
  );
}
