export type PaymentAmounts = {
  amount: number;
  capturedAmount: number;
  refundAmount?: number | null;
  status: string;
};

export function getNetPaymentAmount(payment: PaymentAmounts) {
  if (payment.status === "REFUNDED") return 0;
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") return 0;

  return Math.max(0, payment.capturedAmount - (payment.refundAmount || 0));
}
