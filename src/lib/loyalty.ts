import { PREMIUM_SUBSCRIPTION } from "@/lib/subscription-pricing";

type LoyaltyTierKey = "BRONZE" | "ARGENT" | "OR" | "DIAMANT";

type LoyaltyTier = {
  key: LoyaltyTierKey;
  name: string;
  minPaws: number;
  maxPaws: number | null;
  benefits: string[];
};

export type LoyaltyReward = {
  threshold: number;
  label: string;
  discountEquivalent: number;
};

export const LOYALTY_REWARDS: LoyaltyReward[] = [
  { threshold: 300, label: "5 euros de réduction", discountEquivalent: 5 },
  { threshold: 700, label: "15 euros de réduction", discountEquivalent: 15 },
  {
    threshold: 1500,
    label: "1 nuit d'hébergement offerte ou réduction équivalente",
    discountEquivalent: 24,
  },
];

const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    key: "BRONZE",
    name: "Bronze",
    minPaws: 0,
    maxPaws: 499,
    benefits: ["Programme fidélité gratuit", "Pattes gagnées à chaque réservation"],
  },
  {
    key: "ARGENT",
    name: "Argent",
    minPaws: 500,
    maxPaws: 1499,
    benefits: ["Accès aux récompenses fidélité", "Suivi prioritaire des demandes"],
  },
  {
    key: "OR",
    name: "Or",
    minPaws: 1500,
    maxPaws: 2999,
    benefits: ["Meilleures récompenses fidélité", "Attention renforcée sur les périodes chargées"],
  },
  {
    key: "DIAMANT",
    name: "Diamant",
    minPaws: 3000,
    maxPaws: null,
    benefits: ["Statut le plus élevé", "Traitement prioritaire des demandes récurrentes"],
  },
];

export type LoyaltyStatus = {
  paws: number;
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  nextTierProgress: number;
  pawsToNextTier: number;
  nextReward: LoyaltyReward | null;
  nextRewardProgress: number;
  pawsToNextReward: number;
};

export function calculatePawsEarned(amountSpent: number, isPremium: boolean) {
  const multiplier = isPremium ? PREMIUM_SUBSCRIPTION.pointsMultiplier : 1;
  return Math.floor(Math.max(0, amountSpent) * multiplier);
}

export function calculatePremiumDiscount(amount: number) {
  const discountAmount = Math.round(Math.max(0, amount) * PREMIUM_SUBSCRIPTION.discountRate * 100) / 100;
  return {
    discountAmount,
    finalAmount: Math.max(0, Math.round((amount - discountAmount) * 100) / 100),
  };
}

export function getPremiumBenefits(isPremium: boolean) {
  return {
    isPremium,
    monthlyPrice: PREMIUM_SUBSCRIPTION.monthlyPrice,
    discountRate: isPremium ? PREMIUM_SUBSCRIPTION.discountRate : 0,
    pointsMultiplier: isPremium ? PREMIUM_SUBSCRIPTION.pointsMultiplier : 1,
    benefits: isPremium ? PREMIUM_SUBSCRIPTION.benefits : [],
  };
}

function calculateLoyaltyTier(paws: number) {
  const safePaws = Math.max(0, Math.floor(paws));
  return LOYALTY_TIERS.find((tier) =>
    safePaws >= tier.minPaws && (tier.maxPaws === null || safePaws <= tier.maxPaws)
  ) || LOYALTY_TIERS[0];
}

function calculateNextReward(paws: number) {
  const safePaws = Math.max(0, Math.floor(paws));
  return LOYALTY_REWARDS.find((reward) => reward.threshold > safePaws) || null;
}

export function calculateLoyaltyStatus(paws: number): LoyaltyStatus {
  const safePaws = Math.max(0, Math.floor(paws));
  const tier = calculateLoyaltyTier(safePaws);
  const tierIndex = LOYALTY_TIERS.findIndex((candidate) => candidate.key === tier.key);
  const nextTier = LOYALTY_TIERS[tierIndex + 1] || null;
  const nextReward = calculateNextReward(safePaws);

  const nextTierProgress = nextTier
    ? Math.min(100, Math.round(((safePaws - tier.minPaws) / (nextTier.minPaws - tier.minPaws)) * 100))
    : 100;
  const nextRewardProgress = nextReward
    ? Math.min(100, Math.round((safePaws / nextReward.threshold) * 100))
    : 100;

  return {
    paws: safePaws,
    tier,
    nextTier,
    nextTierProgress,
    pawsToNextTier: nextTier ? Math.max(0, nextTier.minPaws - safePaws) : 0,
    nextReward,
    nextRewardProgress,
    pawsToNextReward: nextReward ? Math.max(0, nextReward.threshold - safePaws) : 0,
  };
}
