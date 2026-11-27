import { PAYMENT_PLAN_ENABLED_IN_PRODUCTION } from "@/lib/payment-plan";
import { isProductionDeployment } from "@/lib/runtime-env";

// Garde serveur du plan acompte + solde (spec 07) : aucune opération Stripe
// propre au plan (autorisation de l'acompte, capture, prélèvement ou reprise du
// solde, retenue du barème) ne part avec une clé non autorisée :
// - clé sk_test_ : toujours acceptée (aperçus, local, tests) ;
// - clé sk_live_ : acceptée seulement en production (VERCEL_ENV côté serveur),
//   plan ouvert en production ET PAYMENT_PLAN_LIVE_STRIPE_ALLOWED ;
// - toute autre clé (absente, restreinte, live hors production…) : refusée.
// Le paiement intégral (plan FULL) n'appelle jamais cette garde.
//
// La clé n'est jamais journalisée : seul son type (absente, live, autre).

// Coupe-circuit dédié aux clés live, posé avec l'accord du propriétaire : le
// repasser à false bloque le plan en production sans toucher au paiement intégral.
export const PAYMENT_PLAN_LIVE_STRIPE_ALLOWED = true;

export class PaymentPlanStripeGuardError extends Error {
  constructor(public readonly operation: string) {
    super(`Opération Stripe du plan acompte refusée (${operation}) : clé Stripe hors mode test`);
    this.name = "PaymentPlanStripeGuardError";
  }
}

// Pur : clé secrète de test (sk_test_…).
export function isStripeTestSecretKey(secretKey: string | undefined) {
  return typeof secretKey === "string" && secretKey.startsWith("sk_test_");
}

export type PaymentPlanStripeKeyContext = {
  isProduction: boolean;
  planEnabledInProduction: boolean;
  liveAllowed: boolean;
};

// Pur : décision de la garde, sans lecture de l'environnement.
export function isPaymentPlanStripeKeyAllowed(secretKey: string | undefined, context: PaymentPlanStripeKeyContext) {
  if (isStripeTestSecretKey(secretKey)) return true;
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk_live_")) return false;
  return context.isProduction && context.planEnabledInProduction && context.liveAllowed;
}

// Lue à chaque appel : VERCEL_ENV et STRIPE_SECRET_KEY du serveur.
export function isPaymentPlanStripeAllowed() {
  return isPaymentPlanStripeKeyAllowed(process.env.STRIPE_SECRET_KEY, {
    isProduction: isProductionDeployment(),
    planEnabledInProduction: PAYMENT_PLAN_ENABLED_IN_PRODUCTION,
    liveAllowed: PAYMENT_PLAN_LIVE_STRIPE_ALLOWED,
  });
}

const describeKey = (secretKey: string | undefined) => {
  if (!secretKey) return "absente";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "non test";
};

export function assertPaymentPlanStripeAllowed(operation: string) {
  if (isPaymentPlanStripeAllowed()) return;
  console.error(`[plan acompte] ${operation} refusé : clé Stripe ${describeKey(process.env.STRIPE_SECRET_KEY)}, aucun appel Stripe.`);
  throw new PaymentPlanStripeGuardError(operation);
}

// Anciens noms, conservés pour les appelants existants.
export const isPaymentPlanStripeTestMode = isPaymentPlanStripeAllowed;
export const assertPaymentPlanStripeTestMode = assertPaymentPlanStripeAllowed;
