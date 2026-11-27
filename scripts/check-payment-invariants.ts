import { getNetPaymentAmount } from "../src/lib/payment-amounts";
import {
  BALANCE_DAYS_BEFORE,
  BALANCE_FINAL_DEADLINE_DAYS_BEFORE,
  DEPOSIT_MIN_LEAD_DAYS,
  DEPOSIT_MIN_TOTAL,
  DEPOSIT_RATE,
  PAYMENT_PLAN_ENABLED_IN_PRODUCTION,
  PAYMENT_PLAN_PREVIEW_ENABLED,
  choosePaymentPlan,
  getBalanceSchedule,
  getBookingStartsAt,
  getDepositCancellationOutcome,
  getPaymentPlanSplit,
  isPaymentPlanEnabled,
  splitDepositBalance,
} from "../src/lib/payment-plan";
import { assertPaymentPlanStripeTestMode, isStripeTestSecretKey } from "../src/lib/payment-plan-stripe-guard";

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

// --- Acompte + solde différé (spec 07) ---
const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const cents = (amount: number) => Math.round(amount * 100);

// Le plan est fermé en production tant que le propriétaire n'a pas validé
// l'activation, quel que soit le drapeau des aperçus.
assert(PAYMENT_PLAN_ENABLED_IN_PRODUCTION === false, "Le plan acompte doit rester fermé en production");
assert(PAYMENT_PLAN_PREVIEW_ENABLED === true, "Le plan acompte doit être actif sur les aperçus");

const withEnv = <T>(env: Record<string, string | undefined>, run: () => T): T => {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  const apply = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  apply(env);
  try {
    return run();
  } finally {
    apply(previous);
  }
};

assert(withEnv({ VERCEL_ENV: "production" }, isPaymentPlanEnabled) === false, "VERCEL_ENV=production doit fermer le plan");
assert(withEnv({ VERCEL_ENV: "preview" }, isPaymentPlanEnabled) === true, "VERCEL_ENV=preview doit ouvrir le plan");
assert(withEnv({ VERCEL_ENV: undefined }, isPaymentPlanEnabled) === true, "Le plan doit être ouvert en local");

// Garde Stripe du plan : seules les clés de test passent.
assert(isStripeTestSecretKey("sk_test_factice"), "Une clé sk_test_ doit autoriser le plan");
assert(!isStripeTestSecretKey("sk_live_factice"), "Une clé sk_live_ doit être refusée pour le plan");
assert(!isStripeTestSecretKey(undefined), "Une clé absente doit être refusée pour le plan");
assert(!isStripeTestSecretKey("rk_test_factice"), "Seules les clés secrètes sk_test_ sont acceptées");
const guardRefuses = (key: string | undefined) => withEnv({ STRIPE_SECRET_KEY: key }, () => {
  const log = console.error;
  console.error = () => {};
  try {
    assertPaymentPlanStripeTestMode("check");
    return false;
  } catch {
    return true;
  } finally {
    console.error = log;
  }
});
assert(guardRefuses("sk_live_factice") && guardRefuses(undefined) && !guardRefuses("sk_test_factice"), "Garde sk_test_ du plan acompte");

assertEqual(DEPOSIT_RATE, 0.3, "Taux d'acompte");
assertEqual(DEPOSIT_MIN_TOTAL, 100, "Seuil minimal du plan acompte");
assertEqual(DEPOSIT_MIN_LEAD_DAYS, 14, "Délai minimal du plan acompte");
assertEqual(BALANCE_DAYS_BEFORE, 7, "Échéance du solde");
assertEqual(BALANCE_FINAL_DEADLINE_DAYS_BEFORE, 2, "Limite de paiement du solde");

const requestedAt = new Date("2026-11-26T10:00:00Z");
const farStart = "2027-04-26";

// Production (plan fermé) : toujours FULL, total intégral.
const disabled = withEnv({ VERCEL_ENV: "production" }, () =>
  getPaymentPlanSplit({ totalPrice: 300, serviceType: "BOARDING", startDate: farStart, requestedAt }));
assert(disabled.plan === "FULL" && disabled.depositAmount === 300 && disabled.balanceAmount === 0, "FULL doit autoriser 100 % en production");

// Somme exacte au centime sur une grille de totaux décimaux.
for (let totalCents = 10_000; totalCents <= 200_000; totalCents += 37) {
  const total = totalCents / 100;
  const split = splitDepositBalance(total);
  assertEqual(cents(split.depositAmount) + cents(split.balanceAmount), totalCents, `Acompte + solde = total pour ${total}`);
  assert(cents(split.depositAmount) % 100 === 0, `Acompte en euros entiers pour ${total}`);
  assert(split.depositAmount >= total * DEPOSIT_RATE - 1e-9, `Acompte ≥ 30 % pour ${total}`);
  assert(split.depositAmount < total * DEPOSIT_RATE + 1, `Acompte < 30 % + 1 € pour ${total}`);
  assert(split.balanceAmount > 0, `Solde strictement positif pour ${total}`);
}

// Seuils (drapeau forcé pour le contrôle).
const plan = (totalPrice: number, startDate: string, serviceType = "BOARDING") =>
  choosePaymentPlan({ totalPrice, serviceType, startDate, requestedAt, enabled: true });
assert(plan(99.99, farStart) === "FULL", "99,99 € doit rester FULL");
assert(plan(100, farStart) === "DEPOSIT_BALANCE", "100 € doit passer en acompte");
assert(plan(300, "2026-12-09") === "FULL", "13 jours doit rester FULL");
assert(plan(300, "2026-12-10") === "DEPOSIT_BALANCE", "14 jours doit passer en acompte");
assert(plan(300, farStart, "DOG_WALKING") === "FULL", "Service hors périmètre : FULL");

// Barème : la retenue ne dépasse jamais les sommes détenues.
const startsAt = getBookingStartsAt(farStart, "10:00");
for (const hours of [24 * 10, 24 * 7, 24 * 5, 48, 47, 24, 1]) {
  for (const balanceCollected of [0, 210]) {
    const outcome = getDepositCancellationOutcome({
      actor: "CLIENT",
      totalPrice: 300,
      depositAmount: 90,
      balanceCollectedAmount: balanceCollected,
      startsAt,
      cancelledAt: new Date(startsAt.getTime() - hours * 3_600_000),
    });
    assertEqual(
      cents(outcome.retainedTotal) + cents(outcome.returnedTotal),
      cents(90 + balanceCollected),
      `Retenu + rendu = encaissé (${hours} h, solde ${balanceCollected})`
    );
    assert(outcome.retainedTotal <= 90 + balanceCollected, `Retenue bornée (${hours} h)`);
  }
}
const teamOutcome = getDepositCancellationOutcome({
  actor: "TEAM", totalPrice: 300, depositAmount: 90, balanceCollectedAmount: 210, startsAt, cancelledAt: startsAt,
});
assertEqual(teamOutcome.retainedTotal, 0, "Annulation équipe : remboursement intégral");

// Échéances : J-7 avant le début, limite J-2 après.
const schedule = getBalanceSchedule(farStart);
assert(schedule.dueAt < schedule.finalDeadlineAt, "Le solde est dû avant la limite J-2");
assert(schedule.finalDeadlineAt < startsAt, "La limite J-2 précède le début");

console.log("Payment invariant checks passed");
