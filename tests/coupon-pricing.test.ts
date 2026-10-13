import { describe, expect, it } from "vitest";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";

describe("calculateCouponDiscount", () => {
  it("applique un pourcentage", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "PERCENTAGE", discountValue: 10 }))
      .toEqual({ discountAmount: 10, finalAmount: 90, capped: false });
  });

  it("plafonne un pourcentage à 20 % du total", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "PERCENTAGE", discountValue: 50 }))
      .toEqual({ discountAmount: 20, finalAmount: 80, capped: true });
  });

  it("arrondit au centime", () => {
    expect(calculateCouponDiscount({ totalAmount: 33.33, discountType: "PERCENTAGE", discountValue: 10 }))
      .toEqual({ discountAmount: 3.33, finalAmount: 30, capped: false });
  });

  it("multiplie un montant fixe par la quantité", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "FIXED_AMOUNT", discountValue: 5, quantity: 3 }))
      .toEqual({ discountAmount: 15, finalAmount: 85, capped: false });
  });

  it("traite une quantité absente ou nulle comme une unité", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "FIXED_AMOUNT", discountValue: 5 }).discountAmount).toBe(5);
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "FIXED_AMOUNT", discountValue: 5, quantity: 0 }).discountAmount).toBe(5);
  });

  it("plafonne un montant fixe à 20 % du total", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "FIXED_AMOUNT", discountValue: 30 }))
      .toEqual({ discountAmount: 20, finalAmount: 80, capped: true });
  });

  it("remplace le total par un total négocié, sans plafond", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "CUSTOM_TOTAL", discountValue: 60 }))
      .toEqual({ discountAmount: 40, finalAmount: 60, capped: false });
  });

  it("n'augmente jamais le total avec un total négocié supérieur", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "CUSTOM_TOTAL", discountValue: 150 }))
      .toEqual({ discountAmount: 0, finalAmount: 100, capped: false });
  });

  it("ne descend jamais sous zéro", () => {
    expect(calculateCouponDiscount({ totalAmount: 100, discountType: "CUSTOM_TOTAL", discountValue: -10 }))
      .toEqual({ discountAmount: 100, finalAmount: 0, capped: false });
  });
});
