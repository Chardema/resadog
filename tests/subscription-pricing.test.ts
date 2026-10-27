import { describe, expect, it } from "vitest";
import {
  LEGACY_PREMIUM_COMMITMENT_MONTHS,
  PREMIUM_SUBSCRIPTION,
  addCalendarMonthsClamped,
  calculatePremiumSubscriptionPlan,
  getPremiumCommitmentEnd,
  getPremiumCommitmentMonths,
} from "@/lib/subscription-pricing";

describe("getPremiumCommitmentMonths", () => {
  it("lit l'engagement enregistré dans les métadonnées", () => {
    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "3" })).toBe(3);
  });

  it("retombe sur l'engagement historique sans valeur valide", () => {
    expect(getPremiumCommitmentMonths(undefined)).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths(null)).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths({})).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "0" })).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "13" })).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "1.5" })).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
    expect(getPremiumCommitmentMonths({ minimumCommitmentMonths: "abc" })).toBe(LEGACY_PREMIUM_COMMITMENT_MONTHS);
  });
});

describe("addCalendarMonthsClamped", () => {
  it("conserve le jour et l'heure quand le mois cible le permet", () => {
    expect(addCalendarMonthsClamped(new Date("2026-11-15T10:30:00.000Z"), 3).toISOString())
      .toBe("2027-02-15T10:30:00.000Z");
  });

  it("se cale sur le dernier jour d'un mois plus court", () => {
    expect(addCalendarMonthsClamped(new Date("2026-01-31T10:00:00.000Z"), 1).toISOString())
      .toBe("2026-02-28T10:00:00.000Z");
    expect(addCalendarMonthsClamped(new Date("2024-01-31T10:00:00.000Z"), 1).toISOString())
      .toBe("2024-02-29T10:00:00.000Z");
  });

  it("ne modifie pas la date d'origine", () => {
    const start = new Date("2026-01-31T10:00:00.000Z");
    addCalendarMonthsClamped(start, 1);
    expect(start.toISOString()).toBe("2026-01-31T10:00:00.000Z");
  });
});

describe("offre Premium", () => {
  it("calcule la fin d'engagement", () => {
    expect(getPremiumCommitmentEnd(new Date("2026-09-08T08:00:00.000Z"), 3).toISOString())
      .toBe("2026-12-08T08:00:00.000Z");
  });

  it("garde des montants cohérents entre euros et centimes", () => {
    const plan = calculatePremiumSubscriptionPlan();
    expect(plan.amountDueNowCents).toBe(999);
    expect(plan.amountDueNowCents).toBe(Math.round(plan.monthlyPrice * 100));
    expect(plan.minimumCommitmentTotalCents).toBe(plan.amountDueNowCents * plan.minimumCommitmentMonths);
    expect(plan.minimumCommitmentTotalCents).toBe(Math.round(plan.minimumCommitmentTotal * 100));
  });

  it("reprend les paramètres de l'offre", () => {
    expect(calculatePremiumSubscriptionPlan()).toMatchObject({
      name: PREMIUM_SUBSCRIPTION.name,
      billingCycle: "MONTHLY",
      discountRate: 0.1,
      maximumDiscountPerBooking: 20,
      pointsMultiplier: 2,
    });
  });
});
