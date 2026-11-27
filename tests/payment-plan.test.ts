import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";
import {
  PAYMENT_PLAN_ENABLED_IN_PRODUCTION,
  PAYMENT_PLAN_PREVIEW_ENABLED,
  calculateAdvanceInterest,
  choosePaymentPlan,
  getBalanceAmountDue,
  getBalanceMandateTerms,
  getBalanceSchedule,
  getBookingStartsAt,
  getDepositCancellationOutcome,
  getLeadDays,
  getPaymentPlanSplit,
  isBalanceMandateConsentValid,
  isPaymentPlanEnabled,
  splitDepositBalance,
} from "@/lib/payment-plan";

const cents = (amount: number) => Math.round(amount * 100);
const requestedAt = new Date("2026-11-26T10:00:00Z");
const farStart = "2027-04-26";

describe("isPaymentPlanEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("drapeaux de code : ouvert sur les aperçus et en production", () => {
    expect(PAYMENT_PLAN_PREVIEW_ENABLED).toBe(true);
    expect(PAYMENT_PLAN_ENABLED_IN_PRODUCTION).toBe(true);
  });

  it.each(["production", "preview", "development", undefined])("VERCEL_ENV=%s : ouvert", (vercelEnv) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    expect(isPaymentPlanEnabled()).toBe(true);
    expect(getPaymentPlanSplit({ totalPrice: 300, serviceType: "BOARDING", startDate: farStart, requestedAt }).plan)
      .toBe("DEPOSIT_BALANCE");
  });

  it("NODE_ENV=production sans VERCEL_ENV=production : reste un aperçu", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isPaymentPlanEnabled()).toBe(true);
  });

  it("évaluée à l'appel : suit un changement d'environnement sans rechargement", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isPaymentPlanEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isPaymentPlanEnabled()).toBe(PAYMENT_PLAN_ENABLED_IN_PRODUCTION);
  });

  it("navigateur : NEXT_PUBLIC_VERCEL_ENV=production suit le drapeau de production (VERCEL_ENV ignoré)", () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    expect(isPaymentPlanEnabled()).toBe(PAYMENT_PLAN_ENABLED_IN_PRODUCTION);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    expect(isPaymentPlanEnabled()).toBe(PAYMENT_PLAN_PREVIEW_ENABLED);
  });
});

describe("choosePaymentPlan", () => {
  const plan = (totalPrice: number, startDate: string, serviceType = "BOARDING", at = requestedAt) =>
    choosePaymentPlan({ totalPrice, serviceType, startDate, requestedAt: at, enabled: true });

  it("applique le seuil de 100 € au centime près", () => {
    expect(plan(99.99, farStart)).toBe("FULL");
    expect(plan(100, farStart)).toBe("DEPOSIT_BALANCE");
    expect(plan(100.01, farStart)).toBe("DEPOSIT_BALANCE");
  });

  it("applique le délai de 14 jours calendaires", () => {
    expect(getLeadDays("2026-12-09", requestedAt)).toBe(13);
    expect(plan(300, "2026-12-09")).toBe("FULL");
    expect(getLeadDays("2026-12-10", requestedAt)).toBe(14);
    expect(plan(300, "2026-12-10")).toBe("DEPOSIT_BALANCE");
  });

  it("compte les jours en heure de Paris, pas en UTC", () => {
    // 23:30 UTC le 26/11 = 00:30 le 27/11 à Paris : il ne reste que 13 jours.
    const lateEvening = new Date("2026-11-26T23:30:00Z");
    expect(plan(300, "2026-12-10", "BOARDING", lateEvening)).toBe("FULL");
  });

  it("limite le plan aux gardes et séries de visites", () => {
    expect(plan(300, farStart, "HOUSE_SITTING")).toBe("DEPOSIT_BALANCE");
    expect(plan(300, farStart, "DROP_IN")).toBe("DEPOSIT_BALANCE");
    expect(plan(300, farStart, "DOG_WALKING")).toBe("FULL");
  });

  it("reste FULL quand le drapeau est coupé", () => {
    expect(choosePaymentPlan({ totalPrice: 300, serviceType: "BOARDING", startDate: farStart, requestedAt, enabled: false })).toBe("FULL");
  });
});

describe("splitDepositBalance", () => {
  it.each([
    [300, 90, 210],
    [100, 30, 70],
    [200, 60, 140],
    [100.01, 31, 69.01],
    [133.33, 40, 93.33],
    [250.5, 76, 174.5],
    [100.3, 31, 69.3],
  ])("%s € → acompte %s € + solde %s €", (total, deposit, balance) => {
    expect(splitDepositBalance(total)).toEqual({ totalAmount: total, depositAmount: deposit, balanceAmount: balance });
  });

  it("garde acompte + solde = total après un code promo", () => {
    const { finalAmount } = calculateCouponDiscount({ totalAmount: 150, discountType: "PERCENTAGE", discountValue: 10 });
    const split = splitDepositBalance(finalAmount);
    expect(split).toEqual({ totalAmount: 135, depositAmount: 41, balanceAmount: 94 });
  });

  it("garde acompte + solde = total après une remise en montant fixe", () => {
    const { finalAmount } = calculateCouponDiscount({ totalAmount: 333.33, discountType: "FIXED_AMOUNT", discountValue: 7.77 });
    const split = splitDepositBalance(finalAmount);
    expect(cents(split.depositAmount) + cents(split.balanceAmount)).toBe(cents(finalAmount));
  });

  it("arrondit un finalPrice à plus de deux décimales au centime avant de répartir", () => {
    // Réservation par animal : total × ratio de remise, non arrondi.
    const finalPrice = 205.7613 * (135 / 150);
    const split = splitDepositBalance(finalPrice);
    expect(split.totalAmount).toBe(185.19);
    expect(split.depositAmount).toBe(56);
    expect(split.balanceAmount).toBe(129.19);
  });

  it("ne dérive jamais sur une grille de totaux décimaux", () => {
    for (let totalCents = 10_000; totalCents <= 100_000; totalCents += 13) {
      const split = splitDepositBalance(totalCents / 100);
      expect(cents(split.depositAmount) + cents(split.balanceAmount)).toBe(totalCents);
      expect(cents(split.depositAmount) % 100).toBe(0);
      expect(split.depositAmount * 100).toBeGreaterThanOrEqual(totalCents * 0.3 - 1e-6);
    }
  });

  it("refuse un total nul ou invalide", () => {
    expect(() => splitDepositBalance(0)).toThrow();
    expect(() => splitDepositBalance(Number.NaN)).toThrow();
  });
});

describe("getBalanceSchedule", () => {
  it("place le solde à J-7 et la limite à J-2 midi, heure de Paris", () => {
    const schedule = getBalanceSchedule(farStart);
    expect(schedule.dueAt.toISOString()).toBe("2027-04-18T22:00:00.000Z");
    expect(schedule.noticeAt.toISOString()).toBe("2027-04-11T22:00:00.000Z");
    expect(schedule.reminderAts.map((date) => date.toISOString())).toEqual([
      "2027-04-20T22:00:00.000Z",
      "2027-04-22T22:00:00.000Z",
    ]);
    expect(schedule.finalDeadlineAt.toISOString()).toBe("2027-04-24T10:00:00.000Z");
  });

  it("suit l'heure d'hiver", () => {
    expect(getBalanceSchedule("2027-01-20").dueAt.toISOString()).toBe("2027-01-12T23:00:00.000Z");
  });

  it("produit les conditions du mandat affichées au client", () => {
    const split = getPaymentPlanSplit({ totalPrice: 300, serviceType: "BOARDING", startDate: farStart, requestedAt, enabled: true });
    const terms = getBalanceMandateTerms(split, farStart);
    expect(terms).toEqual({ depositAmount: 90, balanceAmount: 210, balanceDueDate: "2027-04-19" });
    expect(isBalanceMandateConsentValid({ accepted: true, balanceAmount: 210, balanceDueDate: "2027-04-19" }, terms!)).toBe(true);
    expect(isBalanceMandateConsentValid({ accepted: false, balanceAmount: 210, balanceDueDate: "2027-04-19" }, terms!)).toBe(false);
    expect(isBalanceMandateConsentValid({ accepted: true, balanceAmount: 209, balanceDueDate: "2027-04-19" }, terms!)).toBe(false);
    expect(isBalanceMandateConsentValid({ accepted: true, balanceAmount: 210, balanceDueDate: "2027-04-20" }, terms!)).toBe(false);
    expect(isBalanceMandateConsentValid(undefined, terms!)).toBe(false);
  });
});

describe("getDepositCancellationOutcome", () => {
  const startsAt = getBookingStartsAt(farStart, "10:00");
  const before = (hours: number) => new Date(startsAt.getTime() - hours * 3_600_000);
  const cancel = (hours: number, balanceCollectedAmount = 0, actor: "CLIENT" | "TEAM" | "PAYMENT_DEFAULT" | "WITHDRAWAL" = "CLIENT") =>
    getDepositCancellationOutcome({ actor, totalPrice: 300, depositAmount: 90, balanceCollectedAmount, startsAt, cancelledAt: before(hours) });

  it("interprète l'heure de début en heure de Paris", () => {
    expect(startsAt.toISOString()).toBe("2027-04-26T08:00:00.000Z");
  });

  it("J-10 : annulation gratuite, acompte rendu", () => {
    expect(cancel(24 * 10)).toEqual({
      tier: "FREE",
      retainedTotal: 0,
      returnedTotal: 90,
      deposit: { retained: 0, returned: 90 },
      balance: { retained: 0, returned: 0 },
    });
  });

  it("J-7 pile : encore gratuite ; une minute plus tard, acompte conservé", () => {
    expect(cancel(24 * 7).tier).toBe("FREE");
    expect(cancel(24 * 7 - 1 / 60).tier).toBe("DEPOSIT_RETAINED");
  });

  it("J-5 : acompte conservé, solde prélevé remboursé", () => {
    expect(cancel(24 * 5, 210)).toEqual({
      tier: "DEPOSIT_RETAINED",
      retainedTotal: 90,
      returnedTotal: 210,
      deposit: { retained: 90, returned: 0 },
      balance: { retained: 0, returned: 210 },
    });
  });

  it("48 h pile : acompte conservé ; en deçà, 50 % du total", () => {
    expect(cancel(48, 210).tier).toBe("DEPOSIT_RETAINED");
    expect(cancel(47.99, 210).tier).toBe("HALF_RETAINED");
  });

  it("J-1 : 50 % du total retenus (acompte + 20 % sur le solde)", () => {
    expect(cancel(24, 210)).toEqual({
      tier: "HALF_RETAINED",
      retainedTotal: 150,
      returnedTotal: 150,
      deposit: { retained: 90, returned: 0 },
      balance: { retained: 60, returned: 150 },
    });
  });

  it("J-1 sans solde encaissé : la retenue reste bornée à l'acompte", () => {
    const outcome = cancel(24, 0);
    expect(outcome.retainedTotal).toBe(90);
    expect(outcome.balance).toEqual({ retained: 0, returned: 0 });
  });

  it("annulation par l'équipe ou rétractation : tout est rendu", () => {
    expect(cancel(24, 210, "TEAM")).toMatchObject({ tier: "TEAM_FULL_REFUND", retainedTotal: 0, returnedTotal: 300 });
    expect(cancel(24 * 30, 0, "WITHDRAWAL")).toMatchObject({ tier: "WITHDRAWAL_FULL_REFUND", retainedTotal: 0, returnedTotal: 90 });
  });

  it("défaut de paiement à J-2 : acompte conservé", () => {
    expect(cancel(48 + 22, 0, "PAYMENT_DEFAULT")).toMatchObject({ tier: "PAYMENT_DEFAULT", retainedTotal: 90, returnedTotal: 0 });
  });

  it("répartit un total impair sans perdre de centime", () => {
    const outcome = getDepositCancellationOutcome({
      actor: "CLIENT", totalPrice: 333.33, depositAmount: 100, balanceCollectedAmount: 233.33, startsAt, cancelledAt: before(10),
    });
    expect(outcome.retainedTotal).toBe(166.67);
    expect(outcome.balance).toEqual({ retained: 66.67, returned: 166.66 });
    expect(cents(outcome.retainedTotal) + cents(outcome.returnedTotal)).toBe(33_333);
  });
});

describe("intérêts L214-2", () => {
  it("ne court pas avant 3 mois de détention", () => {
    expect(calculateAdvanceInterest({ amount: 90, paidAt: new Date("2027-02-01T10:00:00Z"), until: farStart })).toBe(0);
  });

  it("court au taux légal au-delà de 3 mois", () => {
    // 26/02 → 26/04/2027 : 59 jours à 6,65 % sur 90 €.
    expect(calculateAdvanceInterest({ amount: 90, paidAt: requestedAt, until: farStart })).toBe(0.97);
  });

  it("change de taux au semestre", () => {
    // 15/06 → 01/07/2025 à 7,21 % puis 01/07 → 15/09/2025 à 6,65 %.
    expect(calculateAdvanceInterest({ amount: 100, paidAt: new Date("2025-03-15T10:00:00Z"), until: "2025-09-15" })).toBe(1.7);
  });

  it("est déduit du solde", () => {
    expect(getBalanceAmountDue({ balanceAmount: 210, depositAmount: 90, depositPaidAt: requestedAt, startDate: farStart }))
      .toEqual({ interest: 0.97, amountDue: 209.03 });
    expect(getBalanceAmountDue({ balanceAmount: 210, depositAmount: 90, depositPaidAt: null, startDate: farStart }))
      .toEqual({ interest: 0, amountDue: 210 });
  });
});
