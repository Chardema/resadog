export const MAX_PROMO_DISCOUNT_RATE = 0.2;

export function calculateCouponDiscount(input: {
  totalAmount: number;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  quantity?: number;
}) {
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
