export const PREMIUM_SUBSCRIPTION = {
  name: "Premium La Patte Dorée",
  monthlyPrice: 9.99,
  monthlyPriceCents: 999,
  billingCycle: "MONTHLY" as const,
  discountRate: 0.1,
  pointsMultiplier: 2,
  benefits: [
    "-10 % sur toutes les réservations",
    "Pattes doublées : 1 euro dépensé = 2 Pattes",
    "Priorité sur les créneaux pendant les vacances",
    "Annulation gratuite jusqu'à 24 h avant",
    "Badge Premium visible dans l'espace client",
  ],
};

export function calculatePremiumSubscriptionPlan() {
  return {
    name: PREMIUM_SUBSCRIPTION.name,
    billingCycle: PREMIUM_SUBSCRIPTION.billingCycle,
    monthlyPrice: PREMIUM_SUBSCRIPTION.monthlyPrice,
    amountDueNow: PREMIUM_SUBSCRIPTION.monthlyPrice,
    amountDueNowCents: PREMIUM_SUBSCRIPTION.monthlyPriceCents,
    discountRate: PREMIUM_SUBSCRIPTION.discountRate,
    pointsMultiplier: PREMIUM_SUBSCRIPTION.pointsMultiplier,
    benefits: PREMIUM_SUBSCRIPTION.benefits,
  };
}
