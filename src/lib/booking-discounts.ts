import type { CouponDiscountType } from "@/lib/coupon-pricing";
import { calculatePremiumDiscount } from "@/lib/loyalty";

export type BookingDiscountSource = "NONE" | "AUTOMATIC" | "COUPON" | "PREMIUM";

type CouponCandidate = {
  code: string;
  discountType: CouponDiscountType;
  finalAmount: number;
};

type DiscountCandidate = {
  source: BookingDiscountSource;
  finalAmount: number;
  priority: number;
};

const roundMoney = (amount: number) => Math.round(Math.max(0, amount) * 100) / 100;

export function selectBestBookingDiscount(input: {
  originalAmount: number;
  automaticFinalAmount: number;
  coupon?: CouponCandidate | null;
  isPremium: boolean;
}) {
  const originalAmount = roundMoney(input.originalAmount);
  const automaticFinalAmount = Math.min(originalAmount, roundMoney(input.automaticFinalAmount));
  const couponFinalAmount = input.coupon
    ? Math.min(originalAmount, roundMoney(input.coupon.finalAmount))
    : null;

  if (input.coupon?.discountType === "CUSTOM_TOTAL" && couponFinalAmount !== null) {
    return {
      source: "COUPON" as const,
      originalAmount,
      finalAmount: couponFinalAmount,
      discountAmount: roundMoney(originalAmount - couponFinalAmount),
      appliedCouponCode: input.coupon.code,
      premiumDiscount: null,
    };
  }

  const candidates: DiscountCandidate[] = [
    { source: "NONE", finalAmount: originalAmount, priority: 0 },
  ];

  if (automaticFinalAmount < originalAmount) {
    candidates.push({ source: "AUTOMATIC", finalAmount: automaticFinalAmount, priority: 3 });
  }

  if (couponFinalAmount !== null && couponFinalAmount < originalAmount) {
    candidates.push({ source: "COUPON", finalAmount: couponFinalAmount, priority: 1 });
  }

  const premiumDiscount = input.isPremium ? calculatePremiumDiscount(originalAmount) : null;
  if (premiumDiscount && premiumDiscount.discountAmount > 0) {
    candidates.push({ source: "PREMIUM", finalAmount: premiumDiscount.finalAmount, priority: 2 });
  }

  const selected = candidates.reduce((best, candidate) => {
    if (candidate.finalAmount < best.finalAmount) return candidate;
    if (candidate.finalAmount === best.finalAmount && candidate.priority > best.priority) return candidate;
    return best;
  });

  return {
    source: selected.source,
    originalAmount,
    finalAmount: selected.finalAmount,
    discountAmount: roundMoney(originalAmount - selected.finalAmount),
    appliedCouponCode: selected.source === "COUPON" ? input.coupon?.code || null : null,
    premiumDiscount: selected.source === "PREMIUM" ? premiumDiscount : null,
  };
}
