import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Lot 5 (spec 07) : prélèvement du solde, reprise Checkout, relances, J-2.
// Stripe, Resend et Prisma sont simulés ; la base est un petit magasin en
// mémoire pour que les verrous (updateMany conditionnels) soient réels.

type Row = Record<string, unknown> & { id: string };

const { flags, store, prismaMock, stripeMock, emailMock, invoiceMock, loyaltyMock, authMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  const store = { installments: new Map<string, Row>(), bookings: new Map<string, Row>() };

  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, expected]) => {
      const actual = row[key];
      if (expected && typeof expected === "object" && !(expected instanceof Date) && "in" in expected) {
        return (expected as { in: unknown[] }).in.includes(actual);
      }
      if (expected instanceof Date || actual instanceof Date) {
        return (actual as Date | null)?.getTime?.() === (expected as Date | null)?.getTime?.()
          || (actual == null && expected == null);
      }
      return actual === expected;
    });

  const apply = (row: Row, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in value) {
        row[key] = (row[key] as number) + (value as { increment: number }).increment;
      } else {
        row[key] = value;
      }
    }
  };

  const withBooking = (row: Row) => ({ ...row, booking: store.bookings.get(row.bookingId as string) });

  const prismaMock = {
    bookingInstallment: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...store.installments.values()]
          .filter((row) => (where.status as { in: string[] }).in.includes(row.status as string))
          .filter((row) => (row.dueAt as Date).getTime() <= (where.dueAt as { lte: Date }).lte.getTime())
          .map(withBooking)
          .filter((row) => row.booking?.status === "CONFIRMED" && row.booking?.paymentPlan === "DEPOSIT_BALANCE")),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = store.installments.get(where.id);
        return row ? withBooking(row) : null;
      }),
      findFirst: vi.fn(async ({ where }: { where: { bookingId: string; booking: { clientId: string } } }) => {
        const row = [...store.installments.values()].find((candidate) => candidate.bookingId === where.bookingId);
        if (!row) return null;
        const full = withBooking(row);
        return full.booking?.clientId === where.booking.clientId ? full : null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of store.installments.values()) {
          if (matches(row, where)) {
            apply(row, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    booking: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = store.bookings.get(where.id as string);
        if (!row || !matches(row, where)) return { count: 0 };
        apply(row, data);
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prismaMock)),
  };

  return {
    flags: { enabled: true },
    store,
    prismaMock,
    stripeMock: {
      paymentIntents: { create: vi.fn(), search: vi.fn() },
      paymentMethods: { retrieve: vi.fn() },
      checkout: { sessions: { create: vi.fn(), retrieve: vi.fn(), expire: vi.fn() } },
    },
    emailMock: {
      sendBookingBalanceEmail: vi.fn(),
      sendBookingBalanceAlertAdminEmail: vi.fn(),
    },
    invoiceMock: {
      ensureBookingInvoice: vi.fn(),
      BookingInvoiceAnomalyError: class BookingInvoiceAnomalyError extends Error {
        constructor(message: string, public readonly bookingId: string) {
          super(message);
        }
      },
    },
    loyaltyMock: { reverseBookingLoyalty: vi.fn() },
    authMock: { auth: vi.fn() },
  };
});

vi.mock("@/lib/payment-plan", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/payment-plan")>();
  return {
    ...original,
    get PAYMENT_PLAN_ENABLED() {
      return flags.enabled;
    },
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/email", () => emailMock);
vi.mock("@/lib/booking-invoices", () => invoiceMock);
vi.mock("@/lib/loyalty-ledger", () => loyaltyMock);
vi.mock("@/lib/auth", () => authMock);

import {
  collectBalances,
  createBalanceCheckoutSession,
  handleBalancePaymentFailed,
  planBalanceActions,
  resolveReferenceDate,
  settleBalanceSucceeded,
} from "@/lib/balance-collection";
import { GET as cronGet } from "@/app/api/cron/collect-balances/route";
import { POST as balanceCheckoutPost } from "@/app/api/bookings/[bookingId]/balance-checkout/route";

// Garde du 26/04/2027 : J-14 = 12/04, J-7 = 19/04, J-5 = 21/04, J-3 = 23/04
// (00:00 Paris, soit 22:00 UTC la veille), limite J-2 = 24/04 12:00 Paris.
const START = new Date("2027-04-26T00:00:00.000Z");
const AT = {
  beforeNotice: new Date("2027-04-10T04:00:00.000Z"),
  notice: new Date("2027-04-12T04:00:00.000Z"),
  due: new Date("2027-04-19T04:00:00.000Z"),
  j6: new Date("2027-04-20T04:00:00.000Z"),
  j5: new Date("2027-04-21T04:00:00.000Z"),
  j3: new Date("2027-04-23T04:00:00.000Z"),
  j2Morning: new Date("2027-04-24T04:00:00.000Z"),
  j2Noon: new Date("2027-04-24T10:00:00.000Z"),
};
const DUE_AT = new Date("2027-04-18T22:00:00.000Z");

function seed(installment: Partial<Row> = {}, booking: Partial<Row> = {}) {
  store.bookings.set("booking_1", {
    id: "booking_1",
    clientId: "user_1",
    status: "CONFIRMED",
    paymentPlan: "DEPOSIT_BALANCE",
    serviceType: "BOARDING",
    totalPrice: 300,
    depositAmount: 90,
    balanceAmount: 210,
    startDate: START,
    endDate: new Date("2027-05-01T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "18:00",
    mandateLegalVersion: "2026-11-27",
    client: { email: "client@example.test", name: "Client" },
    pets: [{ name: "Rex" }],
    pet: null,
    // Acompte payé il y a moins de 3 mois : aucun intérêt L214-2.
    payment: { capturedAmount: 90, paidAt: new Date("2027-03-01T10:00:00.000Z"), stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_saved" },
    ...booking,
  });
  store.installments.set("inst_1", {
    id: "inst_1",
    bookingId: "booking_1",
    kind: "BALANCE",
    amount: 210,
    status: "SCHEDULED",
    dueAt: DUE_AT,
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastErrorCode: null,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    reminderSentAt: null,
    createdAt: new Date("2027-03-01T10:00:00.000Z"),
    ...installment,
  });
}

const installment = () => store.installments.get("inst_1")!;
const booking = () => store.bookings.get("booking_1")!;

const succeededIntent = (id = "pi_balance_1", metadata: Record<string, string> = {}) => ({
  id,
  status: "succeeded",
  amount_received: 21000,
  metadata: { type: "booking_balance", kind: "booking_balance", bookingId: "booking_1", installmentId: "inst_1", origin: "off_session", attempt: "1", ...metadata },
});

const cardError = (declineCode: string, paymentIntentId = "pi_failed_1") =>
  Object.assign(new Error("Your card was declined."), {
    type: "StripeCardError",
    code: declineCode === "authentication_required" ? "authentication_required" : "card_declined",
    decline_code: declineCode,
    payment_intent: { id: paymentIntentId, status: "requires_payment_method" },
  });

const emailKinds = () => emailMock.sendBookingBalanceEmail.mock.calls.map((call) => call[0]);
const alertKinds = () => emailMock.sendBookingBalanceAlertAdminEmail.mock.calls.map((call) => call[0]);

beforeEach(() => {
  vi.clearAllMocks();
  flags.enabled = true;
  store.installments.clear();
  store.bookings.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  emailMock.sendBookingBalanceEmail.mockResolvedValue({ id: "email" });
  emailMock.sendBookingBalanceAlertAdminEmail.mockResolvedValue({ id: "email" });
  stripeMock.paymentMethods.retrieve.mockResolvedValue({ id: "pm_saved", card: { last4: "4242" } });
  stripeMock.paymentIntents.create.mockResolvedValue(succeededIntent());
  stripeMock.paymentIntents.search.mockResolvedValue({ data: [] });
  invoiceMock.ensureBookingInvoice.mockResolvedValue(null);
});

describe("planBalanceActions (pur)", () => {
  const plan = (status: string, now: Date, extra: Partial<Row> = {}) =>
    planBalanceActions({
      status, dueAt: DUE_AT, nextAttemptAt: null, lastAttemptAt: null, reminderSentAt: null,
      createdAt: new Date("2027-03-01T10:00:00.000Z"), booking: { startDate: START }, ...extra,
    } as Parameters<typeof planBalanceActions>[0], now);

  it("rappel J-14, prélèvement à J-7, rien avant", () => {
    expect(plan("SCHEDULED", AT.beforeNotice)).toEqual([]);
    expect(plan("SCHEDULED", AT.notice)).toEqual(["NOTICE"]);
    expect(plan("SCHEDULED", AT.notice, { reminderSentAt: AT.notice })).toEqual([]);
    expect(plan("SCHEDULED", AT.due)).toEqual(["CHARGE"]);
  });

  it("après un échec : nouvelle tentative à l'heure prévue, relances J-5 / J-3 une seule fois chacune", () => {
    expect(plan("FAILED", AT.j6)).toEqual([]);
    expect(plan("FAILED", AT.j6, { nextAttemptAt: AT.j6 })).toEqual(["CHARGE"]);
    expect(plan("FAILED", AT.j5)).toEqual(["REMIND"]);
    expect(plan("FAILED", AT.j5, { reminderSentAt: AT.j5 })).toEqual([]);
    expect(plan("FAILED", AT.j3, { reminderSentAt: AT.j5 })).toEqual(["REMIND"]);
  });

  it("limite J-2 12:00 (Paris) : annulation, avant midi rien", () => {
    expect(plan("FAILED", AT.j2Morning, { reminderSentAt: AT.j3 })).toEqual([]);
    expect(plan("FAILED", AT.j2Noon)).toEqual(["CANCEL"]);
    expect(plan("SCHEDULED", AT.j2Noon)).toEqual(["CANCEL"]);
  });

  it("succès, annulation et tentative en cours récente : aucune action ; tentative bloquée : réconciliation", () => {
    expect(plan("SUCCEEDED", AT.j2Noon)).toEqual([]);
    expect(plan("CANCELED", AT.j3)).toEqual([]);
    expect(plan("PROCESSING", AT.due, { lastAttemptAt: new Date(AT.due.getTime() - 5 * 60_000) })).toEqual([]);
    expect(plan("PROCESSING", AT.due, { lastAttemptAt: new Date(AT.due.getTime() - 60 * 60_000) })).toEqual(["RECONCILE"]);
  });
});

describe("date de référence injectable", () => {
  it("acceptée hors production, refusée en production Vercel", () => {
    expect(resolveReferenceDate("2027-04-19T04:00:00Z", { NODE_ENV: "test" })).toEqual({ now: AT.due });
    expect(resolveReferenceDate("2027-04-19T04:00:00Z", { NODE_ENV: "production", VERCEL_ENV: "preview" })).toEqual({ now: AT.due });
    expect(resolveReferenceDate("2027-04-19T04:00:00Z", { NODE_ENV: "production", VERCEL_ENV: "production" })).toHaveProperty("error");
    expect(resolveReferenceDate("2027-04-19T04:00:00Z", { NODE_ENV: "production" })).toHaveProperty("error");
    expect(resolveReferenceDate("pas une date", { NODE_ENV: "test" })).toHaveProperty("error");
    expect(resolveReferenceDate(null, { VERCEL_ENV: "production" })).toHaveProperty("now");
  });
});

describe("collectBalances : prélèvement à J-7", () => {
  it("dryRun : planifie sans appel Stripe, sans écriture, sans e-mail", async () => {
    seed();
    const report = await collectBalances({ now: AT.due, dryRun: true });

    expect(report.planned).toEqual([{ installmentId: "inst_1", bookingId: "booking_1", actions: ["CHARGE"] }]);
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
    expect(prismaMock.bookingInstallment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(emailMock.sendBookingBalanceEmail).not.toHaveBeenCalled();
    expect(installment().status).toBe("SCHEDULED");
  });

  it("prélève hors session sur la carte de la réservation, avec clé d'idempotence, puis SUCCEEDED", async () => {
    seed();
    const report = await collectBalances({ now: AT.due });

    expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 21000,
        currency: "eur",
        customer: "cus_1",
        payment_method: "pm_saved",
        off_session: true,
        confirm: true,
        metadata: expect.objectContaining({ type: "booking_balance", kind: "booking_balance", bookingId: "booking_1", installmentId: "inst_1", attempt: "1" }),
      }),
      { idempotencyKey: "booking:booking_1:balance:1" }
    );
    expect(report).toMatchObject({ charged: 1, succeeded: 1, failed: 0, errors: [] });
    expect(installment()).toMatchObject({ status: "SUCCEEDED", attempts: 1, stripePaymentIntentId: "pi_balance_1" });
    // La réservation et l'acompte ne bougent pas.
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(booking().status).toBe("CONFIRMED");
    expect(emailKinds()).toEqual(["PAID"]);
  });

  it("rejouable : un second passage (ou deux passages simultanés) ne débite jamais deux fois", async () => {
    seed();
    await Promise.all([collectBalances({ now: AT.due }), collectBalances({ now: AT.due })]);
    await collectBalances({ now: AT.due });

    expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(installment().status).toBe("SUCCEEDED");
  });

  it("issue inconnue (réseau) : reste PROCESSING, puis réconciliation avec Stripe sans nouveau débit", async () => {
    seed();
    stripeMock.paymentIntents.create.mockRejectedValueOnce(Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" }));
    const first = await collectBalances({ now: AT.due });
    expect(first.pending).toBe(1);
    expect(installment().status).toBe("PROCESSING");

    stripeMock.paymentIntents.search.mockResolvedValueOnce({ data: [succeededIntent()] });
    await collectBalances({ now: new Date(AT.due.getTime() + 60 * 60_000) });

    expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(installment().status).toBe("SUCCEEDED");
  });

  it("réconciliation sans PaymentIntent créé : rejoue la même tentative avec la même clé", async () => {
    seed({ status: "PROCESSING", attempts: 1, lastAttemptAt: new Date(AT.due.getTime() - 60 * 60_000) });
    await collectBalances({ now: AT.due });

    expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.paymentIntents.create.mock.calls[0][1]).toEqual({ idempotencyKey: "booking:booking_1:balance:1" });
    expect(installment()).toMatchObject({ status: "SUCCEEDED", attempts: 1 });
  });

  it("carte absente de la réservation : échec sans appel Stripe", async () => {
    seed({}, { payment: { capturedAmount: 90, paidAt: null, stripeCustomerId: "cus_1", stripePaymentMethodId: null } });
    await collectBalances({ now: AT.due });

    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
    expect(installment()).toMatchObject({ status: "FAILED", lastErrorCode: "missing_payment_method", nextAttemptAt: null });
  });
});

describe("collectBalances : échec, relances et annulation J-2", () => {
  it("refus bancaire : FAILED, e-mail avec lien de reprise, nouvelle tentative le lendemain", async () => {
    seed();
    stripeMock.paymentIntents.create.mockRejectedValueOnce(cardError("insufficient_funds"));
    const report = await collectBalances({ now: AT.due });

    expect(report).toMatchObject({ failed: 1, succeeded: 0 });
    expect(installment()).toMatchObject({
      status: "FAILED",
      attempts: 1,
      lastErrorCode: "insufficient_funds",
      stripePaymentIntentId: "pi_failed_1",
    });
    expect(installment().nextAttemptAt).toEqual(new Date(AT.due.getTime() + 20 * 3_600_000));
    expect(emailKinds()).toEqual(["FAILED"]);
    expect(emailMock.sendBookingBalanceEmail.mock.calls[0][3]).toMatchObject({ bookingId: "booking_1", amount: 210, deadlineDate: "2027-04-24" });

    // Le lendemain : deuxième tentative (nouvelle clé), réussie, sans nouvel e-mail d'échec.
    stripeMock.paymentIntents.create.mockResolvedValueOnce(succeededIntent("pi_balance_2", { attempt: "2" }));
    await collectBalances({ now: AT.j6 });
    expect(stripeMock.paymentIntents.create.mock.calls[1][1]).toEqual({ idempotencyKey: "booking:booking_1:balance:2" });
    expect(installment()).toMatchObject({ status: "SUCCEEDED", attempts: 2, stripePaymentIntentId: "pi_balance_2", lastErrorCode: null });
    expect(emailKinds()).toEqual(["FAILED", "PAID"]);
  });

  it("authentification requise : pas de nouvelle tentative automatique (seul le client peut payer)", async () => {
    seed();
    stripeMock.paymentIntents.create.mockRejectedValueOnce(cardError("authentication_required"));
    await collectBalances({ now: AT.due });

    expect(installment()).toMatchObject({ status: "FAILED", lastErrorCode: "authentication_required", nextAttemptAt: null });
    await collectBalances({ now: AT.j6 });
    expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
  });

  it("relances J-5 et J-3 : client + alerte équipe, une seule fois par étape", async () => {
    seed({ status: "FAILED", attempts: 1, lastErrorCode: "authentication_required" });

    await collectBalances({ now: AT.j5 });
    await collectBalances({ now: AT.j5 });
    expect(emailKinds()).toEqual(["REMINDER"]);
    expect(alertKinds()).toEqual(["REMINDER"]);
    expect(emailMock.sendBookingBalanceAlertAdminEmail.mock.calls[0][1]).toMatchObject({ note: "J-5", attempts: 1 });

    await collectBalances({ now: AT.j3 });
    expect(emailKinds()).toEqual(["REMINDER", "REMINDER"]);
    expect(emailMock.sendBookingBalanceAlertAdminEmail.mock.calls[1][1]).toMatchObject({ note: "J-3" });
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("J-2 12:00 : annulation pour défaut de paiement, acompte conservé (aucun remboursement)", async () => {
    seed({ status: "FAILED", attempts: 2, lastErrorCode: "insufficient_funds", reminderSentAt: AT.j3 });
    const report = await collectBalances({ now: AT.j2Noon });

    expect(report.cancelled).toBe(1);
    expect(installment()).toMatchObject({ status: "CANCELED", nextAttemptAt: null });
    expect(booking()).toMatchObject({ status: "CANCELLED", cancellationOrigin: "PAYMENT_DEFAULT" });
    expect(booking().cancelledAt).toEqual(AT.j2Noon);
    expect(loyaltyMock.reverseBookingLoyalty).toHaveBeenCalledWith("booking_1", expect.any(String), prismaMock);
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
    expect(emailKinds()).toEqual(["DEFAULT_CANCELLED"]);
    expect(alertKinds()).toEqual(["DEFAULT_CANCELLED"]);

    // Rejeu : rien de plus.
    await collectBalances({ now: AT.j2Noon });
    expect(emailKinds()).toEqual(["DEFAULT_CANCELLED"]);
  });

  it("J-2 : une session de reprise déjà payée bloque l'annulation", async () => {
    seed({ status: "FAILED", attempts: 1, lastErrorCode: "authentication_required", stripeCheckoutSessionId: "cs_paid" });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_paid", status: "complete" });
    await collectBalances({ now: AT.j2Noon });

    expect(installment().status).toBe("FAILED");
    expect(booking().status).toBe("CONFIRMED");
  });

  it("rappel J-14 avec la carte enregistrée, une seule fois", async () => {
    seed();
    await collectBalances({ now: AT.notice });
    await collectBalances({ now: AT.notice });

    expect(emailKinds()).toEqual(["NOTICE"]);
    expect(emailMock.sendBookingBalanceEmail.mock.calls[0][3]).toMatchObject({ cardLast4: "4242", dueDate: "2027-04-19" });
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
  });
});

describe("webhooks booking_balance", () => {
  it("un échec n'écrase jamais un succès", async () => {
    seed({ status: "SUCCEEDED", attempts: 1, stripePaymentIntentId: "pi_balance_1", paidAt: AT.due });
    const record = await handleBalancePaymentFailed({
      id: "pi_balance_1",
      status: "requires_payment_method",
      metadata: { type: "booking_balance", installmentId: "inst_1", origin: "off_session" },
      last_payment_error: { code: "card_declined", decline_code: "generic_decline" },
    } as never);

    expect(record.recorded).toBe(false);
    expect(installment()).toMatchObject({ status: "SUCCEEDED", lastErrorCode: null });
    expect(emailMock.sendBookingBalanceEmail).not.toHaveBeenCalled();
  });

  it("échec sur la page Checkout : le client réessaie sur place, rien n'est enregistré", async () => {
    seed({ status: "FAILED", attempts: 1, lastErrorCode: "authentication_required" });
    await handleBalancePaymentFailed({
      id: "pi_checkout_1",
      status: "requires_payment_method",
      metadata: { type: "booking_balance", installmentId: "inst_1", origin: "checkout" },
      last_payment_error: { code: "card_declined" },
    } as never);
    expect(prismaMock.bookingInstallment.updateMany).not.toHaveBeenCalled();
  });

  it("e-mail d'échec non parti : erreur pour que Stripe rejoue, puis renvoi au rejeu", async () => {
    seed({ status: "PROCESSING", attempts: 1, lastAttemptAt: AT.due });
    const failedIntent = {
      id: "pi_failed_1",
      status: "requires_payment_method",
      metadata: { type: "booking_balance", installmentId: "inst_1", origin: "off_session", attempt: "1" },
      last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" },
    } as never;
    emailMock.sendBookingBalanceEmail.mockRejectedValueOnce(new Error("Resend indisponible"));

    await expect(handleBalancePaymentFailed(failedIntent, { now: AT.due })).rejects.toThrow(/e-mail à renvoyer/);
    expect(installment()).toMatchObject({ status: "FAILED", lastErrorCode: "insufficient_funds" });

    await handleBalancePaymentFailed(failedIntent, { now: AT.due });
    expect(emailKinds()).toEqual(["FAILED", "FAILED"]);
    expect(emailMock.sendBookingBalanceEmail.mock.calls[1][4]).toEqual({ idempotencyKey: "booking-balance-failed-inst_1" });
  });

  it("reprise réussie (Checkout) : solde SUCCEEDED + facture finale, réservation et acompte intacts ; rejeu idempotent", async () => {
    seed({ status: "FAILED", attempts: 1, lastErrorCode: "authentication_required", stripeCheckoutSessionId: "cs_1" });
    const intent = succeededIntent("pi_checkout_1", { origin: "checkout", attempt: "" }) as never;

    expect(await settleBalanceSucceeded(intent, { now: AT.j6, invoice: true })).toBe("SUCCEEDED");
    expect(installment()).toMatchObject({ status: "SUCCEEDED", stripePaymentIntentId: "pi_checkout_1", paidAt: AT.j6 });
    expect(invoiceMock.ensureBookingInvoice).toHaveBeenCalledTimes(1);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(emailKinds()).toEqual(["PAID"]);

    expect(await settleBalanceSucceeded(intent, { now: AT.j6, invoice: true })).toBe("ALREADY_SUCCEEDED");
    expect(emailKinds()).toEqual(["PAID"]);
    expect(invoiceMock.ensureBookingInvoice).toHaveBeenCalledTimes(2);
  });

  it("lot 6 : facture finale incohérente = alerte équipe, le webhook ne lève pas ; erreur transitoire = rejeu", async () => {
    seed({ status: "PROCESSING", attempts: 1 });
    invoiceMock.ensureBookingInvoice.mockRejectedValueOnce(
      new invoiceMock.BookingInvoiceAnomalyError("Montant encaissé incohérent", "booking_1")
    );
    expect(await settleBalanceSucceeded(succeededIntent("pi_balance_1") as never, { now: AT.j6, invoice: true })).toBe("SUCCEEDED");
    expect(alertKinds()).toEqual(["ANOMALY"]);
    expect(emailMock.sendBookingBalanceAlertAdminEmail.mock.calls[0][2]).toEqual({
      idempotencyKey: "booking-balance-invoice-anomaly-pi_balance_1",
    });

    invoiceMock.ensureBookingInvoice.mockRejectedValueOnce(new Error("Stripe indisponible"));
    await expect(settleBalanceSucceeded(succeededIntent("pi_balance_1") as never, { now: AT.j6, invoice: true }))
      .rejects.toThrow(/Stripe indisponible/);
  });

  it("second paiement du même solde : alerte équipe, aucun remboursement automatique", async () => {
    seed({ status: "SUCCEEDED", attempts: 1, stripePaymentIntentId: "pi_balance_1" });
    expect(await settleBalanceSucceeded(succeededIntent("pi_balance_dup") as never, { invoice: true })).toBe("ANOMALY");
    expect(alertKinds()).toEqual(["ANOMALY"]);
    expect(installment().stripePaymentIntentId).toBe("pi_balance_1");
    expect(invoiceMock.ensureBookingInvoice).not.toHaveBeenCalled();
  });
});

describe("reprise par Checkout (/dashboard/bookings/[id]/pay)", () => {
  const create = (userId = "user_1", now = AT.j6) =>
    createBalanceCheckoutSession({ bookingId: "booking_1", userId, returnBaseUrl: "https://example.test", locale: "fr", now });

  beforeEach(() => {
    stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" });
  });

  it("crée une session fraîche : montant du solde, client Stripe existant, métadonnées booking_balance", async () => {
    seed({ status: "FAILED", attempts: 1, lastErrorCode: "authentication_required" });
    expect(await create()).toEqual({ ok: true, url: "https://checkout.stripe.test/cs_1" });

    const [params, options] = stripeMock.checkout.sessions.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: "payment",
      customer: "cus_1",
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 21000 }) })],
      payment_intent_data: { metadata: expect.objectContaining({ type: "booking_balance", installmentId: "inst_1", origin: "checkout" }) },
      success_url: "https://example.test/dashboard/bookings/booking_1/pay?paid=1",
    });
    expect(params.expires_at - Math.floor(AT.j6.getTime() / 1000)).toBe(60 * 60);
    expect(options.idempotencyKey).toMatch(/^booking:booking_1:balance-checkout:/);
    expect(installment().stripeCheckoutSessionId).toBe("cs_1");
  });

  it("une session ouverte bloque le prélèvement automatique ; une nouvelle demande expire l'ancienne", async () => {
    seed({ status: "FAILED", attempts: 1, lastErrorCode: "insufficient_funds", nextAttemptAt: AT.j6, stripeCheckoutSessionId: "cs_old" });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_old", status: "open" });

    const report = await collectBalances({ now: AT.j6 });
    expect(report.skipped).toBe(1);
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();

    stripeMock.checkout.sessions.expire.mockResolvedValue({ id: "cs_old", status: "expired" });
    expect(await create()).toMatchObject({ ok: true });
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith("cs_old");
    expect(installment().stripeCheckoutSessionId).toBe("cs_1");
  });

  it("refusée pour un autre client, un solde planifié, déjà payé ou après la limite", async () => {
    seed({ status: "FAILED", attempts: 1 });
    expect(await create("user_2")).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await create("user_1", AT.j2Noon)).toEqual({ ok: false, reason: "DEADLINE_PASSED" });

    seed({ status: "SCHEDULED" });
    expect(await create()).toEqual({ ok: false, reason: "NOT_PAYABLE" });

    seed({ status: "SUCCEEDED" });
    expect(await create()).toEqual({ ok: false, reason: "ALREADY_PAID" });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("route POST : connexion requise, redirection 303 vers Checkout", async () => {
    seed({ status: "FAILED", attempts: 1 });
    const call = () => balanceCheckoutPost(
      new NextRequest("http://localhost:3000/api/bookings/booking_1/balance-checkout", { method: "POST" }),
      { params: Promise.resolve({ bookingId: "booking_1" }) }
    );

    authMock.auth.mockResolvedValueOnce(null);
    const anonymous = await call();
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toContain("/auth/signin?callbackUrl=");

    authMock.auth.mockResolvedValueOnce({ user: { id: "user_1" } });
    const signedIn = await call();
    expect(signedIn.status).toBe(303);
    expect(signedIn.headers.get("location")).toBe("https://checkout.stripe.test/cs_1");

    flags.enabled = false;
    expect((await call()).status).toBe(404);
  });
});

describe("route /api/cron/collect-balances", () => {
  const call = (query = "", secret = "cron_secret") =>
    cronGet(new NextRequest(`http://localhost:3000/api/cron/collect-balances${query}`, {
      headers: { authorization: `Bearer ${secret}` },
    }));

  beforeEach(() => {
    process.env.CRON_SECRET = "cron_secret";
  });

  it("protégée par CRON_SECRET", async () => {
    expect((await call("", "wrong")).status).toBe(401);
  });

  it("drapeau désactivé : aucune lecture, aucun effet", async () => {
    flags.enabled = false;
    const response = await call();
    expect(await response.json()).toEqual({ success: true, enabled: false });
    expect(prismaMock.bookingInstallment.findMany).not.toHaveBeenCalled();
  });

  it("dryRun avec date de référence : planification sans effet", async () => {
    seed();
    const response = await call("?dryRun=true&now=2027-04-19T04:00:00.000Z");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ dryRun: true, now: AT.due.toISOString(), planned: [{ bookingId: "booking_1", actions: ["CHARGE"] }] });
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
    expect(installment().status).toBe("SCHEDULED");
  });

  it("date de référence refusée en production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    try {
      expect((await call("?now=2027-04-19T04:00:00.000Z")).status).toBe(400);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
