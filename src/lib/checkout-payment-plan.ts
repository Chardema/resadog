import { parisAppointment } from "@/lib/booking-dates";
import {
  PAYMENT_PLAN_ENABLED,
  getBalanceMandateTerms,
  getPaymentPlanSplit,
  type BalanceMandateTerms,
  type PaymentPlanSplit,
} from "@/lib/payment-plan";

// Lot 2 de la spec 07 : plan acompte + solde au moment du Checkout.
// Pur (pas de Prisma ni de Stripe) pour rester testable et utilisable côté
// navigateur pour l'aperçu des conditions.

export type CheckoutDepositPlan = {
  split: PaymentPlanSplit;
  terms: BalanceMandateTerms;
};

export type CheckoutPlanBooking = {
  totalPrice: number;
  serviceType: string;
  startDate: Date | string;
};

// null = plan FULL : le Checkout reste exactement celui d'aujourd'hui.
export function resolveCheckoutDepositPlan(
  booking: CheckoutPlanBooking,
  requestedAt: Date,
  enabled: boolean = PAYMENT_PLAN_ENABLED,
): CheckoutDepositPlan | null {
  if (!enabled || !(booking.totalPrice > 0)) return null;
  const split = getPaymentPlanSplit({
    totalPrice: booking.totalPrice,
    serviceType: booking.serviceType,
    startDate: booking.startDate,
    requestedAt,
    enabled,
  });
  const terms = getBalanceMandateTerms(split, booking.startDate);
  return terms ? { split, terms } : null;
}

export const toStripeCents = (amount: number) => Math.round(amount * 100);

export function isSameMandateTerms(a: BalanceMandateTerms | null, b: BalanceMandateTerms | null) {
  if (!a || !b) return a === b;
  return toStripeCents(a.depositAmount) === toStripeCents(b.depositAmount)
    && toStripeCents(a.balanceAmount) === toStripeCents(b.balanceAmount)
    && a.balanceDueDate === b.balanceDueDate;
}

export type BalanceMandateRecord = {
  acceptedAt: string;
  legalVersion: string;
};

const formatMetadataAmount = (amount: number) => (toStripeCents(amount) / 100).toFixed(2);

// Conditions du plan, posées sur la session et sur le PaymentIntent.
export function getDepositPlanTermsMetadata(plan: CheckoutDepositPlan): Record<string, string> {
  return {
    paymentPlan: "DEPOSIT_BALANCE",
    totalAmount: formatMetadataAmount(plan.split.totalAmount),
    depositAmount: formatMetadataAmount(plan.terms.depositAmount),
    balanceAmount: formatMetadataAmount(plan.terms.balanceAmount),
    balanceDueDate: plan.terms.balanceDueDate,
  };
}

// Preuve du consentement au prélèvement hors session du solde (MIT).
export function getBalanceMandateMetadata(mandate: BalanceMandateRecord): Record<string, string> {
  return {
    balanceMandateAccepted: "true",
    balanceMandateAcceptedAt: mandate.acceptedAt,
    balanceMandateLegalVersion: mandate.legalVersion,
  };
}

type Metadata = Record<string, string> | null | undefined;

const parseMetadataAmount = (value: string | undefined) => {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Number(value);
};

// Lit les conditions d'une session Checkout. null si la session est en plan
// FULL ; exception si elle se dit DEPOSIT_BALANCE avec des valeurs illisibles.
export function readDepositPlanTerms(metadata: Metadata): BalanceMandateTerms | null {
  if (metadata?.paymentPlan !== "DEPOSIT_BALANCE") return null;
  const depositAmount = parseMetadataAmount(metadata.depositAmount);
  const balanceAmount = parseMetadataAmount(metadata.balanceAmount);
  const balanceDueDate = metadata.balanceDueDate;
  if (
    depositAmount === null || depositAmount <= 0
    || balanceAmount === null || balanceAmount <= 0
    || !balanceDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(balanceDueDate)
  ) {
    throw new Error("Métadonnées du plan acompte + solde invalides");
  }
  return { depositAmount, balanceAmount, balanceDueDate };
}

export type CheckoutDepositRecord = {
  terms: BalanceMandateTerms;
  balanceDueAt: Date;
  mandateAcceptedAt: Date;
  mandateLegalVersion: string;
};

// Tout ce qu'il faut enregistrer sur la réservation à checkout.session.completed.
export function readCheckoutDepositRecord(metadata: Metadata): CheckoutDepositRecord | null {
  const terms = readDepositPlanTerms(metadata);
  if (!terms) return null;
  const acceptedAt = new Date(metadata?.balanceMandateAcceptedAt ?? "");
  const legalVersion = metadata?.balanceMandateLegalVersion;
  if (metadata?.balanceMandateAccepted !== "true" || Number.isNaN(acceptedAt.getTime()) || !legalVersion) {
    throw new Error("Consentement au prélèvement du solde absent des métadonnées Checkout");
  }
  const balanceDueAt = parisAppointment(terms.balanceDueDate, "00:00");
  if (!balanceDueAt) throw new Error(`Date de solde invalide : ${terms.balanceDueDate}`);
  return { terms, balanceDueAt, mandateAcceptedAt: acceptedAt, mandateLegalVersion: legalVersion };
}
