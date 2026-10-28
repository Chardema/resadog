import { describe, expect, it } from "vitest";
import { selectBestBookingDiscount } from "@/lib/booking-discounts";
import {
  calculateBookingPrice,
  calculateDogCareQuote,
  calculateSameDayDurationMinutes,
  getHouseSittingDurationTier,
  getLastMinuteFee,
  getServiceDisplayPrice,
  getServiceDisplayPriceForDuration,
  isValidDayCareSchedule,
} from "@/lib/pricing";
import {
  addCalendarMonthsClamped,
  calculatePremiumSubscriptionPlan,
  getPremiumCommitmentEnd,
  getPremiumCommitmentMonths,
  LEGACY_PREMIUM_COMMITMENT_MONTHS,
  PREMIUM_SUBSCRIPTION,
  STANDARD_FREE_CANCELLATION_HOURS,
} from "@/lib/subscription-pricing";

const dog = { id: "dog-1", species: "DOG" as const, age: 4 };
const secondDog = { id: "dog-2", species: "DOG" as const, age: 3 };
const cat = { id: "cat-1", species: "CAT" as const, age: 2 };
const secondCat = { id: "cat-2", species: "CAT" as const, age: 2 };
const thirdCat = { id: "cat-3", species: "CAT" as const, age: 2 };
const fourthCat = { id: "cat-4", species: "CAT" as const, age: 2 };

describe("Pricing engine (src/lib/pricing.ts)", () => {
  it("returns expected base display prices and duration-specific prices", () => {
    expect(getServiceDisplayPrice("BOARDING")).toMatchObject({
      dogPrice: 45,
      catPrice: 23,
      unit: "période de 24 h",
    });
    expect(getServiceDisplayPrice("DAY_CARE")).toMatchObject({
      dogPrice: 35,
      catPrice: 30,
    });
    expect(getServiceDisplayPrice("DROP_IN")).toMatchObject({
      dogPrice: 16,
      catPrice: 15,
      durationMinutes: 30,
    });
    expect(getServiceDisplayPrice("DOG_WALKING")).toMatchObject({
      dogPrice: 15,
      durationMinutes: 30,
      catRequestOnly: true,
    });
    expect(getServiceDisplayPrice("HOUSE_SITTING")).toMatchObject({
      dogPrice: 45,
      catPrice: 40,
    });

    expect(getServiceDisplayPriceForDuration("DROP_IN", "DOG", 30)).toBe(16);
    expect(getServiceDisplayPriceForDuration("DROP_IN", "DOG", 60)).toBe(24);
    expect(getServiceDisplayPriceForDuration("DROP_IN", "DOG", 120)).toBe(40);
    expect(getServiceDisplayPriceForDuration("DROP_IN", "CAT", 120)).toBe(39);
    expect(getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 60)).toBe(22);
  });

  it("validates DAY_CARE schedule and quotes ≤10h at 35€ and >10h same day at 45€", () => {
    expect(
      isValidDayCareSchedule({
        startDate: "2026-09-29",
        endDate: "2026-10-01",
        startTime: "08:00",
        endTime: "18:00",
      })
    ).toBe(true);
    expect(
      isValidDayCareSchedule({
        startDate: "2026-09-29",
        endDate: "2026-10-01",
        startTime: "08:00",
        endTime: "18:01",
      })
    ).toBe(false);

    const upTo10hQuote = calculateDogCareQuote({
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      startTime: "08:00",
      endTime: "18:00",
    });
    expect(upTo10hQuote?.total).toBe(35);
    expect(upTo10hQuote?.periods).toBe(1);
    expect(upTo10hQuote?.priceType).toBe("DAY_CARE");

    const over10hSameDayQuote = calculateDogCareQuote({
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      startTime: "08:00",
      endTime: "18:01",
    });
    expect(over10hSameDayQuote?.total).toBe(45);
    expect(over10hSameDayQuote?.periods).toBe(1);
    expect(over10hSameDayQuote?.priceType).toBe("24_HOUR_PERIOD");

    const threeDaysDayCare = calculateBookingPrice({
      serviceType: "DAY_CARE",
      pets: [dog],
      startDate: "2026-09-29",
      endDate: "2026-10-01",
      startTime: "08:00",
      endTime: "18:00",
    });
    expect(threeDaysDayCare.total).toBe(105);
    expect(threeDaysDayCare.quantity).toBe(3);
  });

  it("calculates BOARDING 24h periods without midnight trap, multi-dog, multi-cat, and long-stay 10% discount (>=14 periods)", () => {
    // Friday 18:00 to Saturday 18:00 = 1 period of 24h (45€)
    const overnight24h = calculateBookingPrice({
      serviceType: "BOARDING",
      pets: [dog],
      startDate: "2026-09-11",
      endDate: "2026-09-12",
      startTime: "18:00",
      endTime: "18:00",
    });
    expect(overnight24h.quantity).toBe(1);
    expect(overnight24h.total).toBe(45);

    // 48h01 starts a 3rd period of 24h (135€)
    const threePeriodsStarted = calculateBookingPrice({
      serviceType: "BOARDING",
      pets: [dog],
      startDate: "2026-08-31",
      endDate: "2026-09-02",
      startTime: "18:00",
      endTime: "18:01",
    });
    expect(threePeriodsStarted.quantity).toBe(3);
    expect(threePeriodsStarted.total).toBe(135);

    // 2 cats in BOARDING for 24h: 23€ + 23€ = 46€
    const twoCatsBoarding = calculateBookingPrice({
      serviceType: "BOARDING",
      pets: [cat, secondCat],
      startDate: "2026-09-17",
      endDate: "2026-09-18",
      startTime: "09:00",
      endTime: "09:00",
    });
    expect(twoCatsBoarding.total).toBe(46);

    // 14 periods of 24h for 1 dog: 14 * 45 = 630€, -10% long stay = 567€
    const longStay14Periods = calculateBookingPrice({
      serviceType: "BOARDING",
      pets: [dog],
      startDate: "2026-09-01",
      endDate: "2026-09-15",
      startTime: "10:00",
      endTime: "10:00",
    });
    expect(longStay14Periods.quantity).toBe(14);
    expect(longStay14Periods.total).toBe(567);
  });

  it("calculates HOUSE_SITTING duration tiers (≤6h at 45€/40€, 6-10h at 60€/55€, >10h at 80€/70€)", () => {
    expect(getHouseSittingDurationTier(270)?.prices.DOG).toBe(45);
    expect(getHouseSittingDurationTier(600)?.prices.DOG).toBe(60);
    expect(getHouseSittingDurationTier(840)?.prices.DOG).toBe(80);

    const over10hDog = calculateBookingPrice({
      serviceType: "HOUSE_SITTING",
      pets: [dog],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      startTime: "09:30",
      endTime: "23:30",
    });
    expect(over10hDog.total).toBe(80);

    const over10hCat = calculateBookingPrice({
      serviceType: "HOUSE_SITTING",
      pets: [cat],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      startTime: "09:30",
      endTime: "23:30",
    });
    expect(over10hCat.total).toBe(70);

    // Rejects implicit overnight range where endTime <= startTime
    expect(calculateSameDayDurationMinutes({ startTime: "18:00", endTime: "08:00" })).toBe(0);
    expect(
      calculateBookingPrice({
        serviceType: "HOUSE_SITTING",
        pets: [dog],
        startDate: "2026-09-10",
        endDate: "2026-09-12",
        startTime: "18:00",
        endTime: "08:00",
      }).total
    ).toBe(0);
  });

  it("calculates DROP_IN 30 min / 60 min / 120 min and DOG_WALKING with multi-cat & shared duration rules", () => {
    // 1 or 2 cats included at 15€ for 30 min; 3rd cat +3€ (18€); 4th cat +3€ (21€)
    for (const [pets, expected] of [
      [[cat], 15],
      [[cat, secondCat], 15],
      [[cat, secondCat, thirdCat], 18],
      [[fourthCat, thirdCat, secondCat, cat], 21],
      [[dog, cat, secondCat], 31],
    ] as const) {
      const result = calculateBookingPrice({
        serviceType: "DROP_IN",
        pets: [...pets],
        startDate: "2026-09-17",
        endDate: "2026-09-17",
        visitSlots: [{ date: "2026-09-17", startTime: "09:00", duration: 30 }],
      });
      expect(result.total).toBe(expected);
    }

    // Shared duration surcharge counted once across 2 dogs (2 visits of 30m and 60m = (16+16)*2 + 8 = 72€)
    const sharedVisitTwoDogs = calculateBookingPrice({
      serviceType: "DROP_IN",
      pets: [dog, secondDog],
      startDate: "2026-09-10",
      endDate: "2026-09-11",
      visitSlots: [
        { date: "2026-09-10", startTime: "09:00", duration: 30 },
        { date: "2026-09-11", startTime: "18:00", duration: 60 },
      ],
    });
    expect(sharedVisitTwoDogs.total).toBe(72);

    // Dog walking 30, 60, 90, 120 min
    for (const { duration, expected } of [
      { duration: 30, expected: 15 },
      { duration: 60, expected: 22 },
      { duration: 90, expected: 29 },
      { duration: 120, expected: 36 },
    ]) {
      expect(
        calculateBookingPrice({
          serviceType: "DOG_WALKING",
          pets: [dog],
          startDate: "2026-09-10",
          endDate: "2026-09-10",
          visitSlots: [{ date: "2026-09-10", startTime: "09:00", duration }],
        }).total
      ).toBe(expected);
    }
  });

  it("applies puppy surcharge (+5€ <12 months on DAY_CARE/BOARDING only) and prioritizes birthDate over declarative age, plus last-minute fee", () => {
    // Verified birthDate under 1 year overrides falsified age: 4 -> 35€ + 5€ = 40€
    const verifiedPuppy = calculateBookingPrice({
      serviceType: "DAY_CARE",
      pets: [{ id: "puppy-verified", species: "DOG", age: 4, birthDate: "2025-10-01T00:00:00.000Z" }],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
    });
    expect(verifiedPuppy.total).toBe(40);

    // First birthday reached -> no surcharge (35€)
    const firstBirthdayDog = calculateBookingPrice({
      serviceType: "DAY_CARE",
      pets: [{ id: "dog-first-birthday", species: "DOG", age: 0.5, birthDate: "2025-09-10T00:00:00.000Z" }],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
    });
    expect(firstBirthdayDog.total).toBe(35);

    // Kitten under 1 year never gets puppy surcharge
    const youngCatBoarding = calculateBookingPrice({
      serviceType: "BOARDING",
      pets: [{ id: "kitten-1", species: "CAT", age: 0.5 }],
      startDate: "2026-09-10",
      endDate: "2026-09-11",
      startTime: "18:00",
      endTime: "18:00",
    });
    expect(youngCatBoarding.total).toBe(23);

    // Last-minute fee: +10€ when requested < 24h before start
    expect(
      getLastMinuteFee({
        serviceType: "BOARDING",
        startDate: "2026-09-10",
        startTime: "14:00",
        requestedAt: new Date("2026-09-10T08:00:00.000Z"),
      })
    ).toBe(10);
    expect(
      getLastMinuteFee({
        serviceType: "BOARDING",
        startDate: "2026-09-15",
        startTime: "14:00",
        requestedAt: new Date("2026-09-10T08:00:00.000Z"),
      })
    ).toBe(0);
  });
});

describe("Non-stacking discount rule & Premium subscription pricing (src/lib/booking-discounts.ts & src/lib/subscription-pricing.ts)", () => {
  it("keeps the single most advantageous discount without stacking (AUTOMATIC vs COUPON vs PREMIUM)", () => {
    // 1. Long-stay automatic discount (567€ on 630€ = -63€) beats Premium (-20€ cap) and standard coupon
    const autoWins = selectBestBookingDiscount({
      originalAmount: 630,
      automaticFinalAmount: 567,
      coupon: { code: "PROMO10", discountType: "PERCENTAGE", finalAmount: 567 },
      isPremium: true,
    });
    expect(autoWins.source).toBe("AUTOMATIC");
    expect(autoWins.finalAmount).toBe(567);
    expect(autoWins.discountAmount).toBe(63);
    expect(autoWins.appliedCouponCode).toBeNull();
    expect(autoWins.premiumDiscount).toBeNull();

    // 2. Coupon (-15€ on 100€ -> 85€) beats Premium (-10€ on 100€ -> 90€) when no automatic discount
    const couponWins = selectBestBookingDiscount({
      originalAmount: 100,
      automaticFinalAmount: 100,
      coupon: { code: "FIDELITE15", discountType: "FIXED_AMOUNT", finalAmount: 85 },
      isPremium: true,
    });
    expect(couponWins.source).toBe("COUPON");
    expect(couponWins.finalAmount).toBe(85);
    expect(couponWins.discountAmount).toBe(15);
    expect(couponWins.appliedCouponCode).toBe("FIDELITE15");
    expect(couponWins.premiumDiscount).toBeNull();

    // 3. Premium (-10% up to 20€: on 150€ -> 135€) beats smaller fixed coupon (145€)
    const premiumWins = selectBestBookingDiscount({
      originalAmount: 150,
      automaticFinalAmount: 150,
      coupon: { code: "PATTE300", discountType: "FIXED_AMOUNT", finalAmount: 145 },
      isPremium: true,
    });
    expect(premiumWins.source).toBe("PREMIUM");
    expect(premiumWins.finalAmount).toBe(135);
    expect(premiumWins.discountAmount).toBe(15);
    expect(premiumWins.appliedCouponCode).toBeNull();
    expect(premiumWins.premiumDiscount?.discountAmount).toBe(15);

    // 4. Tie-breaker priority: PREMIUM (priority 2) beats COUPON (priority 1) at equal finalAmount
    const tiePremiumVsCoupon = selectBestBookingDiscount({
      originalAmount: 100,
      automaticFinalAmount: 100,
      coupon: { code: "TENOFF", discountType: "PERCENTAGE", finalAmount: 90 },
      isPremium: true,
    });
    expect(tiePremiumVsCoupon.source).toBe("PREMIUM");
    expect(tiePremiumVsCoupon.finalAmount).toBe(90);

    // 5. CUSTOM_TOTAL admin coupon always overrides to the custom negotiated total
    const customTotalWins = selectBestBookingDiscount({
      originalAmount: 200,
      automaticFinalAmount: 180,
      coupon: { code: "DEVIS120", discountType: "CUSTOM_TOTAL", finalAmount: 120 },
      isPremium: true,
    });
    expect(customTotalWins.source).toBe("COUPON");
    expect(customTotalWins.finalAmount).toBe(120);
    expect(customTotalWins.discountAmount).toBe(80);
    expect(customTotalWins.appliedCouponCode).toBe("DEVIS120");
  });

  it("calculates Premium subscription plan details and clamped commitment end dates", () => {
    const plan = calculatePremiumSubscriptionPlan();
    expect(plan.monthlyPrice).toBe(9.99);
    expect(plan.amountDueNowCents).toBe(999);
    expect(plan.minimumCommitmentMonths).toBe(3);
    expect(plan.minimumCommitmentTotal).toBe(29.97);
    expect(plan.discountRate).toBe(0.1);
    expect(plan.maximumDiscountPerBooking).toBe(20);
    expect(plan.pointsMultiplier).toBe(2);
    expect(STANDARD_FREE_CANCELLATION_HOURS).toBe(48);

    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "3" })).toBe(3);
    expect(getPremiumCommitmentMonths(null)).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "99" })).toBe(
      LEGACY_PREMIUM_COMMITMENT_MONTHS
    );

    // Clamping Jan 31 + 1 month -> Feb 28 in non-leap year 2027
    const start = new Date("2027-01-31T10:00:00.000Z");
    const oneMonthLater = addCalendarMonthsClamped(start, 1);
    expect(oneMonthLater.toISOString()).toBe("2027-02-28T10:00:00.000Z");

    const commitmentEnd = getPremiumCommitmentEnd(
      new Date("2026-10-28T08:00:00.000Z"),
      PREMIUM_SUBSCRIPTION.minimumCommitmentMonths
    );
    expect(commitmentEnd.toISOString()).toBe("2027-01-28T08:00:00.000Z");
  });
});
