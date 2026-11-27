import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Activation du plan acompte selon l'environnement, sans simuler le drapeau :
// isPaymentPlanEnabled() et la garde Stripe lisent vraiment VERCEL_ENV. Stripe, Prisma et
// l'authentification sont simulés : aucun appel réseau.
const { prismaMock, stripeMock, attemptsMock, txMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  const txMock = {
    payment: { upsert: vi.fn() },
    checkoutAttempt: { updateMany: vi.fn() },
  };
  return {
    txMock,
    prismaMock: {
      booking: { findMany: vi.fn() },
      bookingInstallment: { findMany: vi.fn() },
      user: { update: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    },
    stripeMock: {
      customers: { create: vi.fn() },
      paymentIntents: { create: vi.fn(), search: vi.fn() },
      checkout: { sessions: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn(), expire: vi.fn() } },
    },
    attemptsMock: { claimCheckoutAttempt: vi.fn(), failCheckoutAttempt: vi.fn() },
  };
});

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1" } })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/checkout-attempts", () => ({
  ...attemptsMock,
  CheckoutAttemptBusyError: class CheckoutAttemptBusyError extends Error {},
}));
vi.mock("@/lib/pets", () => ({
  getPetProfileCompletion: () => ({ isComplete: true }),
  isPetBirthDateVerified: () => true,
}));
// Modules du solde sans effet ici (aucune échéance) : simulés comme dans
// balance-collection.test.ts pour n'initialiser ni Resend ni la facturation.
vi.mock("@/lib/email", () => ({ sendBookingBalanceEmail: vi.fn(), sendBookingBalanceAlertAdminEmail: vi.fn() }));
vi.mock("@/lib/booking-invoices", () => ({ ensureBookingInvoice: vi.fn(), BookingInvoiceAnomalyError: class extends Error {} }));
vi.mock("@/lib/loyalty-ledger", () => ({ reverseBookingLoyalty: vi.fn() }));

import { POST as checkoutPost } from "@/app/api/stripe/checkout/route";
import { GET as collectBalancesGet } from "@/app/api/cron/collect-balances/route";
import { getLegalDocumentVersion, PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION, STANDARD_LEGAL_DOCUMENT_VERSION } from "@/lib/legal";
import { isPaymentPlanEnabled, PAYMENT_PLAN_ENABLED_IN_PRODUCTION } from "@/lib/payment-plan";
import {
  assertPaymentPlanStripeAllowed,
  assertPaymentPlanStripeTestMode,
  isPaymentPlanStripeAllowed,
  isPaymentPlanStripeKeyAllowed,
  isPaymentPlanStripeTestMode,
  isStripeTestSecretKey,
  PAYMENT_PLAN_LIVE_STRIPE_ALLOWED,
  PaymentPlanStripeGuardError,
} from "@/lib/payment-plan-stripe-guard";

const NOW = new Date("2026-11-26T10:00:00.000Z");
// Réservation éligible à l'acompte : 300 €, hébergement, départ dans 5 mois.
const booking = {
  id: "booking_cuid_00000001",
  clientId: "user_1",
  serviceType: "BOARDING",
  totalPrice: 300,
  startDate: new Date("2027-04-26T00:00:00.000Z"),
  endDate: new Date("2027-05-01T00:00:00.000Z"),
  startTime: "10:00",
  endTime: "18:00",
  notes: null,
  client: { id: "user_1", email: "client@example.test", name: "Client", stripeCustomerId: "cus_test" },
  pets: [{ id: "pet_1", name: "Rex" }],
  pet: null,
  payment: null,
};
const validMandate = { accepted: true, balanceAmount: 210, balanceDueDate: "2027-04-19" };

const postCheckout = (body: Record<string, unknown> = {}) =>
  checkoutPost(new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({
      bookingId: booking.id,
      legalAccepted: true,
      legalVersion: getLegalDocumentVersion(),
      ...body,
    }),
  }));

const callCron = () =>
  collectBalancesGet(new NextRequest("http://localhost:3000/api/cron/collect-balances", {
    headers: { authorization: "Bearer cron_secret" },
  }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("CRON_SECRET", "cron_secret");
  prismaMock.booking.findMany.mockResolvedValue([booking]);
  prismaMock.bookingInstallment.findMany.mockResolvedValue([]);
  attemptsMock.claimCheckoutAttempt.mockResolvedValue({
    kind: "CLAIMED",
    claim: { bookingId: booking.id, attemptToken: "token", idempotencyKey: "booking-checkout:key" },
  });
  stripeMock.checkout.sessions.create.mockImplementation(async () => ({
    id: "cs_test_1",
    url: "https://checkout.stripe.test/cs_test_1",
    status: "open",
    expires_at: Math.floor(NOW.getTime() / 1000) + 31 * 60,
  }));
  txMock.checkoutAttempt.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("VERCEL_ENV=production : plan actif (PR d'activation)", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
  });

  it("isPaymentPlanEnabled() est vrai en production", () => {
    expect(isPaymentPlanEnabled()).toBe(true);
  });

  it("checkout d'une réservation éligible avec la clé live : seul l'acompte est autorisé", async () => {
    const response = await postCheckout({ balanceMandate: validMandate });

    expect(response.status).toBe(200);
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(9000);
    expect(params.metadata).toMatchObject({ paymentPlan: "DEPOSIT_BALANCE", legalVersion: PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION });
  });

  it("checkout d'une réservation hors acompte avec la clé live : paiement intégral, garde non sollicitée", async () => {
    prismaMock.booking.findMany.mockResolvedValue([{ ...booking, serviceType: "DOG_WALKING" }]);
    const response = await postCheckout();

    expect(response.status).toBe(200);
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(30000);
    expect(params.metadata).not.toHaveProperty("paymentPlan");
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("[plan acompte]");
  });

  it("la version des CGV est celle du plan ; la version standard est refusée", async () => {
    expect(getLegalDocumentVersion()).toBe(PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION);
    const response = await postCheckout({ legalVersion: STANDARD_LEGAL_DOCUMENT_VERSION });
    expect(response.status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("cron collect-balances : actif avec la clé live", async () => {
    const response = await callCron();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, enabled: true });
    expect(prismaMock.bookingInstallment.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("VERCEL_ENV=preview : plan actif", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
  });

  it("checkout d'une réservation éligible : seul l'acompte est autorisé", async () => {
    const response = await postCheckout({ balanceMandate: validMandate });

    expect(response.status).toBe(200);
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(9000);
    expect(params.metadata).toMatchObject({ paymentPlan: "DEPOSIT_BALANCE", legalVersion: "2026-11-27" });
  });

  it("clé live sur un aperçu : acompte refusé (503) sans aucun appel Stripe", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    const response = await postCheckout({ balanceMandate: validMandate });

    expect(response.status).toBe(503);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("cron collect-balances : actif", async () => {
    const response = await callCron();
    expect(await response.json()).toMatchObject({ success: true, enabled: true });
    expect(prismaMock.bookingInstallment.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("garde Stripe du plan (assertPaymentPlanStripeAllowed)", () => {
  const LIVE = "sk_live_factice_0000";
  const allOpen = { isProduction: true, planEnabledInProduction: true, liveAllowed: true };

  it("constantes de la PR d'activation : plan ouvert en production, clés live autorisées", () => {
    expect(PAYMENT_PLAN_ENABLED_IN_PRODUCTION).toBe(true);
    expect(PAYMENT_PLAN_LIVE_STRIPE_ALLOWED).toBe(true);
  });

  it("anciens noms : alias des nouvelles fonctions", () => {
    expect(assertPaymentPlanStripeTestMode).toBe(assertPaymentPlanStripeAllowed);
    expect(isPaymentPlanStripeTestMode).toBe(isPaymentPlanStripeAllowed);
  });

  it("production + sk_live_ : acceptée", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    expect(isPaymentPlanStripeAllowed()).toBe(true);
    expect(() => assertPaymentPlanStripeAllowed("test")).not.toThrow();
  });

  it.each([
    ["aperçu", "preview"],
    ["développement", "development"],
    ["local (VERCEL_ENV absent)", undefined],
  ])("%s + sk_live_ : refusée, sans afficher la clé", (_label, vercelEnv) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    expect(isPaymentPlanStripeAllowed()).toBe(false);
    expect(() => assertPaymentPlanStripeAllowed("test")).toThrow(PaymentPlanStripeGuardError);
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("clé Stripe live");
    expect(logged).not.toContain(LIVE);
  });

  it.each(["production", "preview", undefined])("VERCEL_ENV=%s + sk_test_ : acceptée", (vercelEnv) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_factice_0000");
    expect(() => assertPaymentPlanStripeAllowed("test")).not.toThrow();
  });

  it.each([
    ["clé restreinte live", "rk_live_factice_0000"],
    ["clé restreinte de test", "rk_test_factice_0000"],
    ["clé publique live", "pk_live_factice_0000"],
    ["clé vide", ""],
    ["clé absente", undefined],
  ])("production + %s : refusée, sans afficher la clé", (_label, key) => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    expect(() => assertPaymentPlanStripeAllowed("test")).toThrow(PaymentPlanStripeGuardError);
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("aucun appel Stripe");
    if (key) expect(logged).not.toContain(key);
  });

  it("décision pure : sk_live_ exige la production et les deux constantes", () => {
    expect(isPaymentPlanStripeKeyAllowed(LIVE, allOpen)).toBe(true);
    expect(isPaymentPlanStripeKeyAllowed(LIVE, { ...allOpen, isProduction: false })).toBe(false);
    expect(isPaymentPlanStripeKeyAllowed(LIVE, { ...allOpen, planEnabledInProduction: false })).toBe(false);
    expect(isPaymentPlanStripeKeyAllowed(LIVE, { ...allOpen, liveAllowed: false })).toBe(false);
  });

  it("décision pure : sk_test_ toujours acceptée, tout le reste refusé", () => {
    const closed = { isProduction: false, planEnabledInProduction: false, liveAllowed: false };
    expect(isPaymentPlanStripeKeyAllowed("sk_test_x", closed)).toBe(true);
    expect(isPaymentPlanStripeKeyAllowed("sk_test_x", allOpen)).toBe(true);
    for (const key of [undefined, "", "rk_live_x", "rk_test_x", "pk_live_x", "live_sk_live_x"]) {
      expect(isPaymentPlanStripeKeyAllowed(key, allOpen)).toBe(false);
    }
  });

  it("lecture pure de la clé de test", () => {
    expect(isStripeTestSecretKey("sk_test_x")).toBe(true);
    expect(isStripeTestSecretKey("sk_live_x")).toBe(false);
    expect(isStripeTestSecretKey(undefined)).toBe(false);
  });

  it("lecture de VERCEL_ENV et STRIPE_SECRET_KEY à l'appel", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isPaymentPlanStripeAllowed()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isPaymentPlanStripeAllowed()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_factice_0000");
    expect(isPaymentPlanStripeAllowed()).toBe(true);
  });
});
