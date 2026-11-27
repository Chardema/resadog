import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Lot 6 (spec 07) : non-présentation (retenue ≤ montants encaissés), finance
// (solde = second encaissement) et conversion Ads, avec non-régression FULL.
// Stripe, Prisma et Resend sont simulés : aucun appel réseau.

const { prismaMock, txMock, stripeMock, state } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  const state = { installment: null as Record<string, unknown> | null };
  const txMock = {
    booking: { updateMany: vi.fn() },
    bookingNoShow: { create: vi.fn() },
    bookingNotice: { create: vi.fn() },
  };
  return {
    state,
    txMock,
    prismaMock: {
      booking: { findUnique: vi.fn() },
      bookingInstallment: {
        findFirst: vi.fn(async () => (state.installment ? { ...state.installment } : null)),
        updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
          if (!state.installment || state.installment.status !== where.status) return { count: 0 };
          Object.assign(state.installment, data);
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    },
    stripeMock: {
      paymentIntents: { retrieve: vi.fn() },
      checkout: { sessions: { retrieve: vi.fn(), expire: vi.fn() } },
      refunds: { list: vi.fn() },
    },
  };
});

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "admin_1", role: "ADMIN" } })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/email", () => ({ sendBookingBalanceEmail: vi.fn(), sendBookingBalanceAlertAdminEmail: vi.fn() }));
vi.mock("@/lib/loyalty-ledger", () => ({ reverseBookingLoyalty: vi.fn() }));
vi.mock("@/lib/booking-notices", () => ({ deliverBookingNotice: vi.fn(async () => ({ delivered: true })) }));
vi.mock("@/lib/booking-attendance", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/booking-attendance")>();
  return {
    ...original,
    noShowTimingError: () => null,
    noShowMessage: (_booking: unknown, retained: number) => ({ subject: "Non-présentation", text: `retenu ${retained.toFixed(2)}` }),
  };
});

import { POST as noShowRoute } from "@/app/api/admin/bookings/[bookingId]/no-show/route";
import { buildFinanceReport, DEFAULT_FINANCE_SETTINGS, toBalanceFinanceSource, type FinanceSource } from "@/lib/finance";
import { getBookingConversionValue, isBookingPaidForConversion } from "@/lib/booking-conversion";

const booking = (plan: "FULL" | "DEPOSIT_BALANCE") => ({
  id: "booking_1",
  status: "CONFIRMED",
  paymentPlan: plan,
  serviceType: "DAY_CARE",
  totalPrice: 120,
  startDate: new Date("2027-04-26T00:00:00.000Z"),
  endDate: new Date("2027-04-26T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "18:00",
  updatedAt: new Date("2027-04-20T00:00:00.000Z"),
  client: { email: "client@example.test", name: "Client" },
  pets: [{ name: "Rex" }],
  pet: null,
  noShow: null,
  payment: {
    stripePaymentId: "pi_deposit",
    stripeCheckoutSessionId: "cs_booking",
    status: "SUCCEEDED",
    refundStatus: null,
    refundAmount: null,
    stripeRefundId: null,
  },
});

const intents: Record<string, { id: string; status: string; currency: string; amount_received: number }> = {};

const noShow = () =>
  noShowRoute(
    new NextRequest("http://localhost/api/admin/bookings/booking_1/no-show", {
      method: "POST",
      body: JSON.stringify({
        confirmed: true,
        reminderSentAt: "2027-04-26T09:35",
        responseDeadline: "2027-04-26T10:05",
        contactEvidence: "SMS envoyé à 9h35, aucune réponse reçue.",
        lossEvidence: "Créneau bloqué toute la journée, deux demandes refusées.",
      }),
    }),
    { params: Promise.resolve({ bookingId: "booking_1" }) }
  );

const retainedAmount = () => txMock.bookingNoShow.create.mock.calls[0]?.[0].data.retainedAmount;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.installment = null;
  for (const key of Object.keys(intents)) delete intents[key];
  stripeMock.paymentIntents.retrieve.mockImplementation(async (id: string) => intents[id]);
  stripeMock.checkout.sessions.retrieve.mockResolvedValue({ metadata: { legalAccepted: "true", legalVersion: "2026-11-27" } });
  stripeMock.refunds.list.mockResolvedValue({ data: [] });
  txMock.booking.updateMany.mockResolvedValue({ count: 1 });
});

describe("non-présentation", () => {
  it("FULL : inchangé, exige le total encaissé et retient le montant capturé", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking("FULL"));
    intents.pi_deposit = { id: "pi_deposit", status: "succeeded", currency: "eur", amount_received: 12000 };
    const response = await noShow();
    expect(response.status).toBe(200);
    expect(retainedAmount()).toBe(120);
    expect(prismaMock.bookingInstallment.findFirst).not.toHaveBeenCalled();
  });

  it("FULL : un montant encaissé différent du total bloque toujours (409)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking("FULL"));
    intents.pi_deposit = { id: "pi_deposit", status: "succeeded", currency: "eur", amount_received: 6000 };
    expect((await noShow()).status).toBe(409);
    expect(txMock.bookingNoShow.create).not.toHaveBeenCalled();
  });

  it("acompte + solde encaissés : retenue = acompte + solde (≤ total)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking("DEPOSIT_BALANCE"));
    intents.pi_deposit = { id: "pi_deposit", status: "succeeded", currency: "eur", amount_received: 3600 };
    intents.pi_balance = { id: "pi_balance", status: "succeeded", currency: "eur", amount_received: 8400 };
    state.installment = { id: "inst_1", status: "SUCCEEDED", stripePaymentIntentId: "pi_balance", refundedAmount: null, stripeCheckoutSessionId: null };
    expect((await noShow()).status).toBe(200);
    expect(retainedAmount()).toBe(120);
  });

  it("solde non prélevé : retenue limitée à l'acompte, échéance fermée, aucun nouveau prélèvement", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking("DEPOSIT_BALANCE"));
    intents.pi_deposit = { id: "pi_deposit", status: "succeeded", currency: "eur", amount_received: 3600 };
    state.installment = { id: "inst_1", status: "FAILED", stripePaymentIntentId: "pi_failed", refundedAmount: null, stripeCheckoutSessionId: null, nextAttemptAt: null };
    expect((await noShow()).status).toBe(200);
    expect(retainedAmount()).toBe(36);
    expect(state.installment.status).toBe("CANCELED");
  });

  it("solde en cours de prélèvement : 409, rien n'est retenu", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking("DEPOSIT_BALANCE"));
    intents.pi_deposit = { id: "pi_deposit", status: "succeeded", currency: "eur", amount_received: 3600 };
    state.installment = { id: "inst_1", status: "PROCESSING", stripePaymentIntentId: "pi_balance", refundedAmount: null, stripeCheckoutSessionId: null };
    expect((await noShow()).status).toBe(409);
    expect(txMock.bookingNoShow.create).not.toHaveBeenCalled();
  });

  it("échec de l'enregistrement : l'échéance fermée est restaurée", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking("DEPOSIT_BALANCE"));
    intents.pi_deposit = { id: "pi_deposit", status: "succeeded", currency: "eur", amount_received: 3600 };
    state.installment = { id: "inst_1", status: "SCHEDULED", stripePaymentIntentId: null, refundedAmount: null, stripeCheckoutSessionId: null, nextAttemptAt: null };
    txMock.booking.updateMany.mockResolvedValue({ count: 0 });
    expect((await noShow()).status).toBe(502);
    expect(state.installment.status).toBe("SCHEDULED");
  });
});

describe("finance : le solde est un second encaissement", () => {
  const now = new Date("2027-04-10T12:00:00Z");
  const bookingFields = {
    clientName: "Client", pets: ["Rex"], serviceType: "BOARDING", bookingStatus: "CONFIRMED",
    startsAt: "2027-04-26T08:00:00.000Z", endsAt: "2027-05-01T16:00:00.000Z",
  };
  const deposit: FinanceSource = {
    ...bookingFields, id: "payment_1", bookingId: "booking_1", kind: "BOOKING",
    amountCents: 9000, capturedCents: 9000, refundCents: 0, paidAt: "2026-11-27T10:00:00.000Z", refundedAt: null,
    createdAt: "2026-11-26T10:00:00.000Z", updatedAt: "2026-11-27T10:00:00.000Z", status: "SUCCEEDED", paymentIntentId: "pi_deposit",
  };
  const installment = (overrides: Partial<Parameters<typeof toBalanceFinanceSource>[0]> = {}) => toBalanceFinanceSource({
    id: "inst_1", bookingId: "booking_1", amount: 210, status: "SCHEDULED", stripePaymentIntentId: null,
    paidAt: null, refundedAmount: null, createdAt: new Date("2026-11-27T10:00:00Z"), updatedAt: new Date("2026-11-27T10:00:00Z"),
    ...overrides,
  }, bookingFields);

  it("solde programmé : acompte encaissé + solde « à encaisser », sans double comptage", () => {
    const report = buildFinanceReport([deposit, installment()], new Map(), DEFAULT_FINANCE_SETTINGS, now);
    expect(report.events.map((event) => [event.id, event.grossCents])).toEqual([["payment_1:capture", 9000]]);
    expect(report.projections.map((item) => [item.id, item.grossCents])).toEqual([["inst_1", 21000]]);
    expect(report.upcoming[0]).toMatchObject({ collectedCents: 9000, toCollectCents: 21000 });
  });

  it("solde échoué : reste à encaisser (le PaymentIntent non payé est ignoré)", () => {
    const source = installment({ status: "FAILED", stripePaymentIntentId: "pi_failed" });
    expect(source).toMatchObject({ status: "PENDING", paymentIntentId: null });
  });

  it("solde prélevé puis remboursé : encaissement et remboursement à leurs propres dates", () => {
    const report = buildFinanceReport([deposit, installment({
      status: "REFUNDED", stripePaymentIntentId: "pi_balance", paidAt: new Date("2027-04-19T04:00:00Z"),
      refundedAmount: 210, updatedAt: new Date("2027-04-21T09:00:00Z"),
    })], new Map(), DEFAULT_FINANCE_SETTINGS, now);
    const balanceEvents = report.events.filter((event) => event.id.startsWith("inst_1"));
    expect(balanceEvents.map((event) => [event.kind, event.grossCents, event.refundCents])).toEqual([
      ["REFUND", 0, 21000],
      ["CAPTURE", 21000, 0],
    ]);
    expect(report.bookings.booking_1.grossCents).toBe(30000);
    expect(report.bookings.booking_1.refundCents).toBe(21000);
  });

  it("solde annulé : ni encaissement ni projection", () => {
    const report = buildFinanceReport([deposit, installment({ status: "CANCELED" })], new Map(), DEFAULT_FINANCE_SETTINGS, now);
    expect(report.projections).toHaveLength(0);
    expect(report.events).toHaveLength(1);
  });
});

describe("conversion Ads", () => {
  it("plan acompte : valeur = total de la réservation, pas l'acompte ; comptée dès l'autorisation", () => {
    const candidate = { totalPrice: 300, depositPaid: false, payment: { status: "PROCESSING" as const, stripePaymentId: "pi_deposit", amount: 90 } };
    expect(isBookingPaidForConversion(candidate)).toBe(true);
    expect(getBookingConversionValue(candidate)).toBe(300);
  });

  it("autorisation expirée : pas de conversion", () => {
    expect(isBookingPaidForConversion({ totalPrice: 300, depositPaid: false, payment: { status: "EXPIRED", stripePaymentId: "pi_deposit", amount: 90 } })).toBe(false);
  });
});
