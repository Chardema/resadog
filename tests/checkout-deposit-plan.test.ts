import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Stripe, Prisma et l'authentification sont simulés : aucun appel réseau.
const { flags, prismaMock, stripeMock, attemptsMock, txMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  const txMock = {
    payment: { upsert: vi.fn() },
    checkoutAttempt: { updateMany: vi.fn() },
  };
  return {
    flags: { enabled: false },
    txMock,
    prismaMock: {
      booking: { findMany: vi.fn() },
      user: { update: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    },
    stripeMock: {
      customers: { create: vi.fn() },
      checkout: {
        sessions: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn(), expire: vi.fn() },
      },
    },
    attemptsMock: { claimCheckoutAttempt: vi.fn(), failCheckoutAttempt: vi.fn() },
  };
});

vi.mock("@/lib/payment-plan", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/payment-plan")>();
  return {
    ...original,
    isPaymentPlanEnabled: () => flags.enabled,
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

import { POST } from "@/app/api/stripe/checkout/route";
import { getLegalDocumentVersion } from "@/lib/legal";
import {
  getDepositPlanTermsMetadata,
  isSameMandateTerms,
  readCheckoutDepositRecord,
  readDepositPlanTerms,
  resolveCheckoutDepositPlan,
} from "@/lib/checkout-payment-plan";

const NOW = new Date("2026-11-26T10:00:00.000Z");

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const validMandate = { accepted: true, balanceAmount: 210, balanceDueDate: "2027-04-19" };

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({
      bookingId: "booking_cuid_00000001",
      legalAccepted: true,
      legalVersion: getLegalDocumentVersion(),
      ...body,
    }),
  }));

const createdSession = () => stripeMock.checkout.sessions.create.mock.calls[0][0];

describe("Checkout de réservation : plan acompte + solde", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "error").mockImplementation(() => {});
    flags.enabled = false;
    prismaMock.booking.findMany.mockResolvedValue([makeBooking()]);
    attemptsMock.claimCheckoutAttempt.mockResolvedValue({
      kind: "CLAIMED",
      claim: { bookingId: "booking_cuid_00000001", attemptToken: "token", idempotencyKey: "booking-checkout:key" },
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
    vi.useRealTimers();
  });

  it("drapeau désactivé : session identique au paiement intégral actuel", async () => {
    const response = await post({});

    expect(response.status).toBe(200);
    const params = createdSession();
    expect(params.line_items[0].price_data.unit_amount).toBe(30000);
    expect(params.payment_intent_data).toMatchObject({ capture_method: "manual", setup_future_usage: "off_session" });
    expect(params).not.toHaveProperty("custom_text");
    expect(Object.keys(params.metadata).sort()).toEqual([
      "bookingIds", "bookingInvoiceVersion", "legalAccepted", "legalAcceptedAt",
      "legalVersion", "promoCode", "provider", "providerSiren", "userId",
    ]);
    expect(Object.keys(params.payment_intent_data.metadata).sort()).toEqual(Object.keys(params.metadata).sort());
    expect(txMock.payment.upsert.mock.calls[0][0].create.amount).toBe(300);
    expect(txMock.payment.upsert.mock.calls[0][0].update.amount).toBe(300);
  });

  it("drapeau désactivé : la case du solde n'est ni exigée ni lue", async () => {
    const response = await post({ balanceMandate: { accepted: false } });
    expect(response.status).toBe(200);
    expect(createdSession().line_items[0].price_data.unit_amount).toBe(30000);
  });

  it("refuse le Checkout de l'acompte sans la case d'autorisation (400)", async () => {
    flags.enabled = true;

    const response = await post({});

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "BALANCE_MANDATE_REQUIRED",
      paymentPlan: { plan: "DEPOSIT_BALANCE", depositAmount: 90, balanceAmount: 210, balanceDueDate: "2027-04-19" },
    });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    // La tentative réservée est libérée : un nouvel essai n'attend pas 2 minutes.
    expect(attemptsMock.failCheckoutAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ attemptToken: "token" }),
      expect.any(Error),
    );
    expect(txMock.payment.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["case non cochée", { ...validMandate, accepted: false }],
    ["montant du solde différent", { ...validMandate, balanceAmount: 200 }],
    ["date du solde différente", { ...validMandate, balanceDueDate: "2027-04-20" }],
  ])("refuse un consentement invalide : %s", async (_label, balanceMandate) => {
    flags.enabled = true;
    const response = await post({ balanceMandate });
    expect(response.status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("autorise seulement l'acompte, conserve la capture manuelle et la carte, trace le consentement", async () => {
    flags.enabled = true;

    const response = await post({ balanceMandate: validMandate });

    expect(response.status).toBe(200);
    const params = createdSession();
    expect(params.mode).toBe("payment");
    expect(params.line_items[0].price_data.unit_amount).toBe(9000);
    expect(params.line_items[0].price_data.product_data.description).toContain("19/04/2027");
    expect(params.payment_intent_data).toMatchObject({ capture_method: "manual", setup_future_usage: "off_session" });

    const expectedPlanMetadata = {
      paymentPlan: "DEPOSIT_BALANCE",
      totalAmount: "300.00",
      depositAmount: "90.00",
      balanceAmount: "210.00",
      balanceDueDate: "2027-04-19",
      balanceMandateAccepted: "true",
      balanceMandateAcceptedAt: NOW.toISOString(),
      balanceMandateLegalVersion: getLegalDocumentVersion(),
      legalVersion: getLegalDocumentVersion(),
    };
    expect(params.metadata).toMatchObject(expectedPlanMetadata);
    expect(params.payment_intent_data.metadata).toMatchObject(expectedPlanMetadata);

    const message: string = params.custom_text.submit.message;
    expect(message).toMatch(/90,00\s€/);
    expect(message).toMatch(/210,00\s€/);
    expect(message).toContain("19/04/2027");
    expect(message.length).toBeLessThanOrEqual(1200);

    expect(txMock.payment.upsert.mock.calls[0][0].create.amount).toBe(90);
    expect(txMock.payment.upsert.mock.calls[0][0].update.amount).toBe(90);
  });

  it.each([
    ["départ à moins de 14 jours", { startDate: new Date("2026-12-05T00:00:00.000Z") }],
    ["total inférieur à 100 €", { totalPrice: 99.99 }],
    ["service hors périmètre", { serviceType: "DOG_WALKING" }],
  ])("drapeau activé, plan FULL (%s) : flux actuel inchangé", async (_label, overrides) => {
    flags.enabled = true;
    prismaMock.booking.findMany.mockResolvedValue([makeBooking(overrides)]);

    const response = await post({});

    expect(response.status).toBe(200);
    const params = createdSession();
    const booking = makeBooking(overrides);
    expect(params.line_items[0].price_data.unit_amount).toBe(Math.round(booking.totalPrice * 100));
    expect(params).not.toHaveProperty("custom_text");
    expect(params.metadata).not.toHaveProperty("paymentPlan");
    expect(txMock.payment.upsert.mock.calls[0][0].create.amount).toBe(booking.totalPrice);
  });

  it("session réutilisée : ses propres conditions font foi et le consentement y est ajouté", async () => {
    flags.enabled = true;
    attemptsMock.claimCheckoutAttempt.mockResolvedValue({
      kind: "REUSE",
      checkoutUrl: "https://checkout.stripe.test/cs_open",
      sessionId: "cs_open",
    });
    const plan = resolveCheckoutDepositPlan(makeBooking(), NOW, true)!;
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_open", metadata: getDepositPlanTermsMetadata(plan) });

    const refused = await post({});
    expect(refused.status).toBe(400);
    expect(stripeMock.checkout.sessions.update).not.toHaveBeenCalled();

    const accepted = await post({ balanceMandate: validMandate });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ reused: true, sessionId: "cs_open" });
    expect(stripeMock.checkout.sessions.update).toHaveBeenCalledWith("cs_open", {
      metadata: expect.objectContaining({
        balanceMandateAccepted: "true",
        balanceMandateAcceptedAt: NOW.toISOString(),
        balanceMandateLegalVersion: getLegalDocumentVersion(),
      }),
    });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("session réutilisée aux conditions différentes : on redemande l'accord sur celles de la session", async () => {
    flags.enabled = true;
    attemptsMock.claimCheckoutAttempt.mockResolvedValue({
      kind: "REUSE",
      checkoutUrl: "https://checkout.stripe.test/cs_open",
      sessionId: "cs_open",
    });
    const sessionPlan = resolveCheckoutDepositPlan(makeBooking({ totalPrice: 250 }), NOW, true)!;
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_open", metadata: getDepositPlanTermsMetadata(sessionPlan) });

    const refused = await post({ balanceMandate: validMandate });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ paymentPlan: { depositAmount: 75, balanceAmount: 175 } });

    const accepted = await post({ balanceMandate: { ...validMandate, balanceAmount: 175 } });
    expect(accepted.status).toBe(200);
    expect(stripeMock.checkout.sessions.update).toHaveBeenCalledTimes(1);
  });

  it("session réutilisée, drapeau désactivé : aucune lecture supplémentaire chez Stripe", async () => {
    attemptsMock.claimCheckoutAttempt.mockResolvedValue({
      kind: "REUSE",
      checkoutUrl: "https://checkout.stripe.test/cs_open",
      sessionId: "cs_open",
    });

    const response = await post({});

    expect(response.status).toBe(200);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect(Object.keys(stripeMock.checkout.sessions.update.mock.calls[0][1].metadata).sort()).toEqual([
      "legalAccepted", "legalAcceptedAt", "legalVersion", "provider", "providerSiren",
    ]);
  });
});

describe("Checkout de réservation : garde sk_test_ du plan acompte", () => {
  const stripeCalls = () => [
    stripeMock.customers.create,
    stripeMock.checkout.sessions.create,
    stripeMock.checkout.sessions.update,
    stripeMock.checkout.sessions.retrieve,
  ].reduce((total, fn) => total + fn.mock.calls.length, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "error").mockImplementation(() => {});
    flags.enabled = true;
    prismaMock.booking.findMany.mockResolvedValue([makeBooking({ client: { ...makeBooking().client, stripeCustomerId: null } })]);
    attemptsMock.claimCheckoutAttempt.mockResolvedValue({
      kind: "CLAIMED",
      claim: { bookingId: "booking_cuid_00000001", attemptToken: "token", idempotencyKey: "booking-checkout:key" },
    });
    stripeMock.customers.create.mockResolvedValue({ id: "cus_new" });
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

  it.each([
    ["clé live", "sk_live_factice_0000"],
    ["clé absente", undefined],
  ])("%s : acompte refusé (503), aucun appel Stripe, aucune tentative réservée", async (_label, key) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);

    const response = await post({ balanceMandate: validMandate });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "PAYMENT_PLAN_UNAVAILABLE" });
    expect(stripeCalls()).toBe(0);
    expect(attemptsMock.claimCheckoutAttempt).not.toHaveBeenCalled();
    expect(txMock.payment.upsert).not.toHaveBeenCalled();
    // Journalisé sans jamais afficher la clé.
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("checkout-acompte");
    expect(logged).not.toContain("sk_live_factice");
  });

  it("session acompte réutilisée avec une clé live : refusée sans mise à jour Stripe", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    prismaMock.booking.findMany.mockResolvedValue([makeBooking({ serviceType: "DOG_WALKING" })]);
    attemptsMock.claimCheckoutAttempt.mockResolvedValue({ kind: "REUSE", checkoutUrl: "https://checkout.stripe.test/cs_open", sessionId: "cs_open" });
    const plan = resolveCheckoutDepositPlan(makeBooking(), NOW, true)!;
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_open", metadata: getDepositPlanTermsMetadata(plan) });

    const response = await post({ balanceMandate: validMandate });

    expect(response.status).toBe(503);
    expect(stripeMock.checkout.sessions.update).not.toHaveBeenCalled();
  });

  it("clé de test : l'acompte est autorisé normalement", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_factice_0000");
    const response = await post({ balanceMandate: validMandate });
    expect(response.status).toBe(200);
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(9000);
  });

  it.each([
    ["plan fermé", false, {}],
    ["plan ouvert, réservation hors acompte", true, { serviceType: "DOG_WALKING" }],
  ])("paiement intégral avec une clé live (%s) : jamais bloqué", async (_label, enabled, overrides) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    flags.enabled = enabled;
    prismaMock.booking.findMany.mockResolvedValue([makeBooking(overrides)]);

    const response = await post({});

    expect(response.status).toBe(200);
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(30000);
    expect(params.metadata).not.toHaveProperty("paymentPlan");
    expect(params.payment_intent_data).toMatchObject({ capture_method: "manual", setup_future_usage: "off_session" });
  });
});

describe("métadonnées du plan acompte + solde", () => {
  it("relit exactement les conditions écrites sur la session", () => {
    const plan = resolveCheckoutDepositPlan(makeBooking({ totalPrice: 333.33 }), NOW, true)!;
    expect(plan.terms).toEqual({ depositAmount: 100, balanceAmount: 233.33, balanceDueDate: "2027-04-19" });
    expect(isSameMandateTerms(readDepositPlanTerms(getDepositPlanTermsMetadata(plan)), plan.terms)).toBe(true);
  });

  it("aucun plan quand le drapeau est désactivé", () => {
    expect(resolveCheckoutDepositPlan(makeBooking(), NOW, false)).toBeNull();
  });

  it("une session sans plan est lue comme FULL", () => {
    expect(readDepositPlanTerms({ bookingIds: "b1" })).toBeNull();
    expect(readCheckoutDepositRecord(null)).toBeNull();
  });

  it("refuse des métadonnées de plan corrompues ou sans consentement", () => {
    const plan = resolveCheckoutDepositPlan(makeBooking(), NOW, true)!;
    const terms = getDepositPlanTermsMetadata(plan);
    expect(() => readDepositPlanTerms({ ...terms, depositAmount: "abc" })).toThrow();
    expect(() => readCheckoutDepositRecord(terms)).toThrow(/Consentement/);
  });

  it("fixe l'échéance du solde à J-7 00:00, heure de Paris", () => {
    const plan = resolveCheckoutDepositPlan(makeBooking(), NOW, true)!;
    const record = readCheckoutDepositRecord({
      ...getDepositPlanTermsMetadata(plan),
      balanceMandateAccepted: "true",
      balanceMandateAcceptedAt: NOW.toISOString(),
      balanceMandateLegalVersion: getLegalDocumentVersion(),
    })!;
    expect(record.balanceDueAt.toISOString()).toBe("2027-04-18T22:00:00.000Z");
    expect(record.mandateAcceptedAt.toISOString()).toBe(NOW.toISOString());
  });
});
