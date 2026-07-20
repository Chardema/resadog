const MAX_PROMO_DISCOUNT_RATE = 0.2;

export type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL";

export function calculateCouponDiscount(input: {
  totalAmount: number;
  discountType: CouponDiscountType;
  discountValue: number;
  quantity?: number;
}) {
  if (input.discountType === "CUSTOM_TOTAL") {
    const finalAmount = Math.max(0, Math.min(input.totalAmount, input.discountValue));
    const roundedFinal = Math.round(finalAmount * 100) / 100;

    return {
      discountAmount: Math.round((input.totalAmount - roundedFinal) * 100) / 100,
      finalAmount: roundedFinal,
      capped: false,
    };
  }

  const requestedDiscount = input.discountType === "PERCENTAGE"
    ? input.totalAmount * input.discountValue / 100
    : input.discountValue * Math.max(1, input.quantity || 1);
  const maximumDiscount = input.totalAmount * MAX_PROMO_DISCOUNT_RATE;
  const discountAmount = Math.round(Math.min(requestedDiscount, maximumDiscount) * 100) / 100;

  return {
    discountAmount,
    finalAmount: Math.round((input.totalAmount - discountAmount) * 100) / 100,
    capped: requestedDiscount > maximumDiscount,
  };
}
