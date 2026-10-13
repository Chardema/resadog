export const PREMIUM_SUBSCRIPTION = {
  planVersion: "2026-09-08",
  name: "Premium La Patte Dorée",
  monthlyPrice: 9.99,
  monthlyPriceCents: 999,
  billingCycle: "MONTHLY" as const,
  minimumCommitmentMonths: 3,
  minimumCommitmentTotal: 29.97,
  minimumCommitmentTotalCents: 2997,
  commitmentLabel: "Engagement initial : 3 mois (29,97 € au total)",
  renewalLabel: "Facturation mensuelle de 9,99 €, puis renouvellement mensuel sans engagement après les 3 premiers mois",
  discountRate: 0.1,
  maximumDiscountPerBooking: 20,
  pointsMultiplier: 2,
  rescheduleNoticeHours: 24,
  benefits: [
    "-10 % jusqu'à 20 € par réservation, sans cumul avec une autre remise",
    "Pattes doublées : 1 euro dépensé = 2 Pattes",
    "Priorité sur les créneaux pendant les vacances",
    "Demande de report prioritaire au moins 24 h avant, sous réserve de disponibilité",
    "Badge Premium visible dans l'espace client",
  ],
};

export const LEGACY_PREMIUM_COMMITMENT_MONTHS = 1;
export const STANDARD_FREE_CANCELLATION_HOURS = 48;

export function getPremiumCommitmentMonths(metadata?: Record<string, string> | null) {
  const recordedMonths = Number(metadata?.minimumCommitmentMonths);
  return Number.isInteger(recordedMonths) && recordedMonths >= 1 && recordedMonths <= 12
    ? recordedMonths
    : LEGACY_PREMIUM_COMMITMENT_MONTHS;
}

export function addCalendarMonthsClamped(date: Date, months: number) {
  const targetMonthFirstDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    targetMonthFirstDay.getUTCFullYear(),
    targetMonthFirstDay.getUTCMonth() + 1,
    0
  )).getUTCDate();
  targetMonthFirstDay.setUTCDate(Math.min(date.getUTCDate(), lastDayOfTargetMonth));
  return targetMonthFirstDay;
}

export function getPremiumCommitmentEnd(startDate: Date, minimumCommitmentMonths: number) {
  return addCalendarMonthsClamped(startDate, minimumCommitmentMonths);
}

export function calculatePremiumSubscriptionPlan() {
  return {
    name: PREMIUM_SUBSCRIPTION.name,
    billingCycle: PREMIUM_SUBSCRIPTION.billingCycle,
    monthlyPrice: PREMIUM_SUBSCRIPTION.monthlyPrice,
    amountDueNow: PREMIUM_SUBSCRIPTION.monthlyPrice,
    amountDueNowCents: PREMIUM_SUBSCRIPTION.monthlyPriceCents,
    minimumCommitmentMonths: PREMIUM_SUBSCRIPTION.minimumCommitmentMonths,
    minimumCommitmentTotal: PREMIUM_SUBSCRIPTION.minimumCommitmentTotal,
    minimumCommitmentTotalCents: PREMIUM_SUBSCRIPTION.minimumCommitmentTotalCents,
    commitmentLabel: PREMIUM_SUBSCRIPTION.commitmentLabel,
    renewalLabel: PREMIUM_SUBSCRIPTION.renewalLabel,
    discountRate: PREMIUM_SUBSCRIPTION.discountRate,
    maximumDiscountPerBooking: PREMIUM_SUBSCRIPTION.maximumDiscountPerBooking,
    pointsMultiplier: PREMIUM_SUBSCRIPTION.pointsMultiplier,
    benefits: PREMIUM_SUBSCRIPTION.benefits,
  };
}
