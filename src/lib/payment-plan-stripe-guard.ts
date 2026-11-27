// Garde serveur du plan acompte + solde (spec 07) : tant que le plan n'est pas
// validé en production, aucune opération Stripe propre au plan (autorisation
// de l'acompte, capture, prélèvement ou reprise du solde, retenue du barème)
// ne part avec une clé autre que de test. Le paiement intégral (plan FULL)
// n'appelle jamais cette garde.
//
// La clé n'est jamais journalisée : seul son type (absente, live, autre).

export class PaymentPlanStripeGuardError extends Error {
  constructor(public readonly operation: string) {
    super(`Opération Stripe du plan acompte refusée (${operation}) : clé Stripe hors mode test`);
    this.name = "PaymentPlanStripeGuardError";
  }
}

// Pur : seules les clés secrètes de test (sk_test_…) sont acceptées.
export function isStripeTestSecretKey(secretKey: string | undefined) {
  return typeof secretKey === "string" && secretKey.startsWith("sk_test_");
}

export function isPaymentPlanStripeTestMode() {
  return isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY);
}

const describeKey = (secretKey: string | undefined) => {
  if (!secretKey) return "absente";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "non test";
};

export function assertPaymentPlanStripeTestMode(operation: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (isStripeTestSecretKey(secretKey)) return;
  console.error(`[plan acompte] ${operation} refusé : clé Stripe ${describeKey(secretKey)}, aucun appel Stripe.`);
  throw new PaymentPlanStripeGuardError(operation);
}
