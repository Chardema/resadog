export type SubscriptionServiceType = "DOG_WALKING" | "DAY_CARE";
export type SubscriptionBillingCycle = "MONTHLY" | "YEARLY";

type ServiceConfig = {
  label: string;
  creditLabel: string;
  unitPrice: number;
  minimumCreditPrice: number;
};

export const SUBSCRIPTION_SERVICES: Record<SubscriptionServiceType, ServiceConfig> = {
  DOG_WALKING: {
    label: "Promenade",
    creditLabel: "promenade",
    unitPrice: 10,
    minimumCreditPrice: 8,
  },
  DAY_CARE: {
    label: "Garderie",
    creditLabel: "jour de garderie",
    unitPrice: 23,
    minimumCreditPrice: 18,
  },
};

const WEEKS_PER_MONTH = 4;
const ANNUAL_DISCOUNT = 0.2;

export function getSubscriptionVolumeDiscount(daysPerWeek: number) {
  if (daysPerWeek >= 5) return 0.2;
  if (daysPerWeek >= 3) return 0.15;
  return 0.1;
}

export function calculateSubscriptionPlan(input: {
  serviceType: SubscriptionServiceType;
  daysPerWeek: number;
  petCount: number;
  billingCycle: SubscriptionBillingCycle;
}) {
  const service = SUBSCRIPTION_SERVICES[input.serviceType];
  const creditsPerMonth = input.daysPerWeek * WEEKS_PER_MONTH * input.petCount;
  const publicMonthlyPrice = service.unitPrice * creditsPerMonth;
  const volumeDiscount = getSubscriptionVolumeDiscount(input.daysPerWeek);
  const billingDiscount = input.billingCycle === "YEARLY" ? ANNUAL_DISCOUNT : 0;
  const requestedMonthlyPrice =
    publicMonthlyPrice * (1 - volumeDiscount) * (1 - billingDiscount);
  const minimumMonthlyPrice = service.minimumCreditPrice * creditsPerMonth;
  const finalMonthlyPrice = Math.max(requestedMonthlyPrice, minimumMonthlyPrice);
  const guardApplied = finalMonthlyPrice > requestedMonthlyPrice;

  const finalMonthlyCents = Math.round(finalMonthlyPrice * 100);
  const amountDueNowCents =
    input.billingCycle === "YEARLY" ? finalMonthlyCents * 12 : finalMonthlyCents;
  const amountDueNow = amountDueNowCents / 100;
  const monthlyPrice = finalMonthlyCents / 100;
  const effectiveCreditPrice = creditsPerMonth > 0 ? monthlyPrice / creditsPerMonth : 0;
  const effectiveDiscount =
    publicMonthlyPrice > 0 ? 1 - monthlyPrice / publicMonthlyPrice : 0;

  return {
    ...input,
    service,
    creditsPerMonth,
    publicMonthlyPrice,
    volumeDiscount,
    billingDiscount,
    requestedMonthlyPrice,
    minimumMonthlyPrice,
    guardApplied,
    monthlyPrice,
    finalMonthlyCents,
    amountDueNow,
    amountDueNowCents,
    effectiveCreditPrice,
    effectiveDiscount,
    totalSavingsYearly: (publicMonthlyPrice - monthlyPrice) * 12,
  };
}
