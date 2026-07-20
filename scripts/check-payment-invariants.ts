import { getNetPaymentAmount } from "../src/lib/payment-amounts";

const assertEqual = (actual: number, expected: number, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: attendu ${expected}, reçu ${actual}`);
  }
};

assertEqual(
  getNetPaymentAmount({ amount: 100, capturedAmount: 100, refundAmount: 0, status: "SUCCEEDED" }),
  100,
  "Un paiement encaissé doit compter intégralement"
);
assertEqual(
  getNetPaymentAmount({ amount: 100, capturedAmount: 100, refundAmount: 50, status: "PARTIALLY_REFUNDED" }),
  50,
  "Un remboursement partiel ne doit être soustrait qu'une fois"
);
assertEqual(
  getNetPaymentAmount({ amount: 100, capturedAmount: 50, refundAmount: 0, status: "SUCCEEDED" }),
  50,
  "Une capture partielle doit utiliser le montant réellement encaissé"
);
assertEqual(
  getNetPaymentAmount({ amount: 100, capturedAmount: 100, refundAmount: 100, status: "REFUNDED" }),
  0,
  "Un remboursement intégral ne doit produire aucun revenu"
);
assertEqual(
  getNetPaymentAmount({ amount: 100, capturedAmount: 0, refundAmount: 0, status: "PROCESSING" }),
  0,
  "Une autorisation non capturée ne doit pas être comptée"
);

console.log("Payment invariant checks passed");
