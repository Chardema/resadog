import { describe, expect, it } from "vitest";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";
import {
  calculateLoyaltyStatus,
  calculatePawsEarned,
  calculatePremiumDiscount,
  getPremiumBenefits,
  LOYALTY_REWARDS,
} from "@/lib/loyalty";
import { isLoyaltyValidatedStatus } from "@/lib/loyalty-ledger";

describe("Coupon pricing engine (src/lib/coupon-pricing.ts)", () => {
  it("calculates percentage discounts and enforces the 20% cap on standard promo codes", () => {
    const tenPercent = calculateCouponDiscount({
      totalAmount: 90,
      discountType: "PERCENTAGE",
      discountValue: 10,
    });
    expect(tenPercent).toEqual({
      discountAmount: 9,
      finalAmount: 81,
      capped: false,
    });

    const thirtyPercentCappedToTwenty = calculateCouponDiscount({
      totalAmount: 100,
      discountType: "PERCENTAGE",
      discountValue: 30,
    });
    expect(thirtyPercentCappedToTwenty).toEqual({
      discountAmount: 20,
      finalAmount: 80,
      capped: true,
    });
  });

  it("calculates fixed amount discounts with quantity and caps at 20% of the booking total", () => {
    const fixedFiveOnFifty = calculateCouponDiscount({
      totalAmount: 50,
      discountType: "FIXED_AMOUNT",
      discountValue: 5,
    });
    expect(fixedFiveOnFifty).toEqual({
      discountAmount: 5,
      finalAmount: 45,
      capped: false,
    });

    const fixedTwentyFourCappedOnNinety = calculateCouponDiscount({
      totalAmount: 90,
      discountType: "FIXED_AMOUNT",
      discountValue: 24,
    });
    expect(fixedTwentyFourCappedOnNinety).toEqual({
      discountAmount: 18,
      finalAmount: 72,
      capped: true,
    });

    const fixedWithQuantity = calculateCouponDiscount({
      totalAmount: 200,
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      quantity: 2,
    });
    expect(fixedWithQuantity).toEqual({
      discountAmount: 20,
      finalAmount: 180,
      capped: false,
    });
  });

  it("calculates CUSTOM_TOTAL negotiated totals and clamps between 0 and original totalAmount", () => {
    const customNegotiated = calculateCouponDiscount({
      totalAmount: 180,
      discountType: "CUSTOM_TOTAL",
      discountValue: 135,
    });
    expect(customNegotiated).toEqual({
      discountAmount: 45,
      finalAmount: 135,
      capped: false,
    });

    // Never exceeds original totalAmount
    const customAboveTotal = calculateCouponDiscount({
      totalAmount: 80,
      discountType: "CUSTOM_TOTAL",
      discountValue: 120,
    });
    expect(customAboveTotal).toEqual({
      discountAmount: 0,
      finalAmount: 80,
      capped: false,
    });

    // Never goes below 0
    const customNegative = calculateCouponDiscount({
      totalAmount: 80,
      discountType: "CUSTOM_TOTAL",
      discountValue: -10,
    });
    expect(customNegative).toEqual({
      discountAmount: 80,
      finalAmount: 0,
      capped: false,
    });
  });
});

describe("Loyalty program & Pattes engine (src/lib/loyalty.ts & src/lib/loyalty-ledger.ts)", () => {
  it("calculates earned Pattes (1€ = 1 Patte standard, 1€ = 2 Pattes for Premium)", () => {
    expect(calculatePawsEarned(45, false)).toBe(45);
    expect(calculatePawsEarned(45.9, false)).toBe(45);
    expect(calculatePawsEarned(45, true)).toBe(90);
    expect(calculatePawsEarned(-10, true)).toBe(0);
  });

  it("calculates Premium 10% discount capped at 20€ per booking and exposes Premium benefits", () => {
    expect(calculatePremiumDiscount(90)).toEqual({
      discountAmount: 9,
      finalAmount: 81,
      capped: false,
    });
    expect(calculatePremiumDiscount(250)).toEqual({
      discountAmount: 20,
      finalAmount: 230,
      capped: true,
    });

    expect(getPremiumBenefits(false).discountRate).toBe(0);
    expect(getPremiumBenefits(false).pointsMultiplier).toBe(1);
    expect(getPremiumBenefits(true).discountRate).toBe(0.1);
    expect(getPremiumBenefits(true).pointsMultiplier).toBe(2);
  });

  it("defines the 3 reward tiers (300, 700, 1500 Pattes) and resolves tier & next reward progression", () => {
    expect(LOYALTY_REWARDS).toEqual([
      { threshold: 300, label: "5 euros de réduction", discountEquivalent: 5 },
      { threshold: 700, label: "15 euros de réduction", discountEquivalent: 15 },
      { threshold: 1500, label: "24 euros de réduction", discountEquivalent: 24 },
    ]);

    const bronzeStatus = calculateLoyaltyStatus(150);
    expect(bronzeStatus.tier.key).toBe("BRONZE");
    expect(bronzeStatus.nextTier?.key).toBe("ARGENT");
    expect(bronzeStatus.pawsToNextTier).toBe(350);
    expect(bronzeStatus.nextReward?.threshold).toBe(300);
    expect(bronzeStatus.pawsToNextReward).toBe(150);
    expect(bronzeStatus.nextRewardProgress).toBe(50);

    const argentStatus = calculateLoyaltyStatus(500);
    expect(argentStatus.tier.key).toBe("ARGENT");
    expect(argentStatus.nextTier?.key).toBe("OR");
    expect(argentStatus.nextReward?.threshold).toBe(700);
    expect(argentStatus.pawsToNextReward).toBe(200);

    const orStatus = calculateLoyaltyStatus(1500);
    expect(orStatus.tier.key).toBe("OR");
    expect(orStatus.nextTier?.key).toBe("DIAMANT");
    expect(orStatus.nextReward).toBeNull();
    expect(orStatus.pawsToNextReward).toBe(0);
    expect(orStatus.nextRewardProgress).toBe(100);

    const diamantStatus = calculateLoyaltyStatus(3200);
    expect(diamantStatus.tier.key).toBe("DIAMANT");
    expect(diamantStatus.nextTier).toBeNull();
    expect(diamantStatus.nextTierProgress).toBe(100);
    expect(diamantStatus.pawsToNextTier).toBe(0);
  });

  it("validates booking statuses eligible for loyalty Pattes attribution", () => {
    expect(isLoyaltyValidatedStatus("CONFIRMED")).toBe(true);
    expect(isLoyaltyValidatedStatus("IN_PROGRESS")).toBe(true);
    expect(isLoyaltyValidatedStatus("COMPLETED")).toBe(true);
    expect(isLoyaltyValidatedStatus("PENDING")).toBe(false);
    expect(isLoyaltyValidatedStatus("CANCELLED")).toBe(false);
  });
});
