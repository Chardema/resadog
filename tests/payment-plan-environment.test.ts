import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Activation du plan acompte selon l'environnement, sans simuler le drapeau :
// isPaymentPlanEnabled() lit vraiment VERCEL_ENV. Stripe, Prisma et
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
import { getLegalDocumentVersion } from "@/lib/legal";
import {
  assertPaymentPlanStripeTestMode,
  isPaymentPlanStripeTestMode,
  isStripeTestSecretKey,
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

describe("VERCEL_ENV=production : plan fermé, comportement de main", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("checkout d'une réservation éligible : paiement intégral, même avec un consentement envoyé par le navigateur", async () => {
    const response = await postCheckout({ balanceMandate: validMandate });

    expect(response.status).toBe(200);
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(30000);
    expect(params).not.toHaveProperty("custom_text");
    expect(params.metadata).not.toHaveProperty("paymentPlan");
    expect(params.metadata).not.toHaveProperty("balanceMandateAccepted");
    expect(params.metadata.legalVersion).toBe("2026-09-13");
    expect(txMock.payment.upsert.mock.calls[0][0].create.amount).toBe(300);
  });

  it("checkout en production avec une clé live : le paiement intégral n'est pas bloqué", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    const response = await postCheckout();
    expect(response.status).toBe(200);
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(30000);
  });

  it("la version des CGV de l'acompte est refusée en production", async () => {
    const response = await postCheckout({ legalVersion: "2026-11-27" });
    expect(response.status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("cron collect-balances : { enabled: false }, aucune lecture, aucun appel Stripe", async () => {
    const response = await callCron();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, enabled: false });
    expect(prismaMock.bookingInstallment.findMany).not.toHaveBeenCalled();
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
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

describe("garde assertPaymentPlanStripeTestMode", () => {
  it("clé sk_test_ : autorisée", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_factice_0000");
    expect(() => assertPaymentPlanStripeTestMode("test")).not.toThrow();
  });

  it.each([
    ["clé live", "sk_live_factice_0000"],
    ["clé restreinte de test", "rk_test_factice_0000"],
    ["clé vide", ""],
    ["clé absente", undefined],
  ])("%s : refusée, sans afficher la clé", (_label, key) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    expect(() => assertPaymentPlanStripeTestMode("test")).toThrow(PaymentPlanStripeGuardError);
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("aucun appel Stripe");
    if (key) expect(logged).not.toContain(key);
  });

  it("lecture pure de la clé", () => {
    expect(isStripeTestSecretKey("sk_test_x")).toBe(true);
    expect(isStripeTestSecretKey("sk_live_x")).toBe(false);
    expect(isStripeTestSecretKey(undefined)).toBe(false);
  });

  it("lecture de STRIPE_SECRET_KEY à l'appel", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    expect(isPaymentPlanStripeTestMode()).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_factice_0000");
    expect(isPaymentPlanStripeTestMode()).toBe(true);
  });
});
