import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// Stripe, Prisma et Resend sont simulés : aucun appel réseau.
const { prismaMock, stripeMock, emailMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  return {
    prismaMock: { booking: { findUnique: vi.fn() } },
    stripeMock: {
      invoices: {
        search: vi.fn(),
        create: vi.fn(),
        retrieve: vi.fn(),
        finalizeInvoice: vi.fn(),
        attachPayment: vi.fn(),
      },
      invoiceItems: { create: vi.fn() },
      paymentIntents: { update: vi.fn() },
    },
    emailMock: { sendBookingInvoiceEmail: vi.fn() },
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/email", () => emailMock);

import { BookingInvoiceAnomalyError, ensureBookingInvoice, getBalanceInvoiceLines } from "@/lib/booking-invoices";
import { BOOKING_INVOICE_VERSION } from "@/lib/legal";

const booking = {
  id: "booking_cuid_00000001",
  serviceType: "BOARDING",
  totalPrice: 300,
  startDate: new Date("2027-04-26T00:00:00.000Z"),
  endDate: new Date("2027-05-01T00:00:00.000Z"),
  startTime: "10:00",
  endTime: "18:00",
  notes: null,
  specialRequests: null,
  client: { email: "client@example.test", name: "Client" },
  pets: [{ name: "Rex" }],
  pet: null,
  payment: { capturedAmount: 90, paidAt: new Date("2026-11-27T15:00:00.000Z") },
};

const intent = (overrides: Record<string, unknown> = {}) => ({
  id: "pi_1",
  status: "succeeded",
  amount_received: 30000,
  currency: "eur",
  customer: "cus_test",
  metadata: { bookingIds: booking.id, bookingInvoiceVersion: BOOKING_INVOICE_VERSION },
  ...overrides,
}) as unknown as Stripe.PaymentIntent;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.booking.findUnique.mockResolvedValue(booking);
  stripeMock.invoices.search.mockResolvedValue({ data: [] });
  stripeMock.invoices.create.mockResolvedValue({ id: "in_1", status: "draft" });
  stripeMock.invoices.retrieve.mockResolvedValue({ id: "in_1", status: "draft", lines: { data: [] } });
  stripeMock.invoices.finalizeInvoice.mockResolvedValue({ id: "in_1", status: "open" });
  stripeMock.invoices.attachPayment.mockResolvedValue({
    id: "in_1", status: "paid", number: "F-1", amount_paid: 21000, hosted_invoice_url: "https://invoice.test/in_1",
  });
  stripeMock.invoiceItems.create.mockResolvedValue({});
  stripeMock.paymentIntents.update.mockResolvedValue({});
});

describe("facture : plan acompte + solde", () => {
  it("aucune facture à la capture de l'acompte (plus d'exception sur le montant)", async () => {
    const result = await ensureBookingInvoice(intent({
      amount_received: 9000,
      metadata: { bookingIds: booking.id, bookingInvoiceVersion: BOOKING_INVOICE_VERSION, paymentPlan: "DEPOSIT_BALANCE" },
    }));
    expect(result).toBeNull();
    expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    expect(stripeMock.invoices.create).not.toHaveBeenCalled();
  });

  it("facture finale au solde : total, acompte déduit, acquittée par le PaymentIntent du solde", async () => {
    const result = await ensureBookingInvoice(intent({
      id: "pi_balance",
      amount_received: 21000,
      metadata: {
        type: "booking_balance",
        bookingId: booking.id,
        bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
        paymentPlan: "DEPOSIT_BALANCE",
      },
    }));

    expect(result?.status).toBe("paid");
    const items = stripeMock.invoiceItems.create.mock.calls.map(([params]) => params);
    expect(items.map((item) => [item.metadata.invoiceLine, item.amount])).toEqual([
      ["service", 30000],
      ["deposit", -9000],
    ]);
    expect(items[1].description).toBe("Acompte déjà versé le 27/11/2026");
    expect(stripeMock.invoiceItems.create.mock.calls.map(([, options]) => options.idempotencyKey)).toEqual([
      `booking-invoice:${BOOKING_INVOICE_VERSION}:pi_balance:item:service`,
      `booking-invoice:${BOOKING_INVOICE_VERSION}:pi_balance:item:deposit`,
    ]);
    expect(stripeMock.invoices.finalizeInvoice).toHaveBeenCalledTimes(1);
    expect(stripeMock.invoices.attachPayment).toHaveBeenCalledWith(
      "in_1",
      { payment_intent: "pi_balance", expand: ["payments"] },
      expect.anything()
    );
  });

  it("déduit les intérêts L214-2 portés par le PaymentIntent du solde", async () => {
    await ensureBookingInvoice(intent({
      id: "pi_balance",
      amount_received: 20850,
      metadata: {
        type: "booking_balance",
        bookingId: booking.id,
        bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
        balanceInterest: "1.50",
      },
    }));
    const amounts = stripeMock.invoiceItems.create.mock.calls.map(([params]) => params.amount);
    expect(amounts).toEqual([30000, -9000, -150]);
  });

  it("rejeu : ne recrée que les lignes manquantes", async () => {
    stripeMock.invoices.search.mockResolvedValue({ data: [{ id: "in_1", status: "draft" }] });
    stripeMock.invoices.retrieve.mockResolvedValue({
      id: "in_1", status: "draft", lines: { data: [{ metadata: { invoiceLine: "service" } }] },
    });
    await ensureBookingInvoice(intent({
      id: "pi_balance",
      amount_received: 21000,
      metadata: { type: "booking_balance", bookingId: booking.id, bookingInvoiceVersion: BOOKING_INVOICE_VERSION },
    }));
    expect(stripeMock.invoices.create).not.toHaveBeenCalled();
    expect(stripeMock.invoiceItems.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.invoiceItems.create.mock.calls[0][0].metadata.invoiceLine).toBe("deposit");
  });

  it("refuse un solde dont le montant ne correspond pas au total moins l'acompte", async () => {
    await expect(ensureBookingInvoice(intent({
      id: "pi_balance",
      amount_received: 30000,
      metadata: { type: "booking_balance", bookingId: booking.id, bookingInvoiceVersion: BOOKING_INVOICE_VERSION },
    }))).rejects.toThrow(/Montant encaissé incohérent/);
    expect(stripeMock.invoices.create).not.toHaveBeenCalled();
  });

  it("lot 6 : l'incohérence du solde est une anomalie typée (alerte équipe, pas de rejeu Stripe)", async () => {
    const error = await ensureBookingInvoice(intent({
      id: "pi_balance",
      amount_received: 30000,
      metadata: { type: "booking_balance", bookingId: booking.id, bookingInvoiceVersion: BOOKING_INVOICE_VERSION },
    })).catch((caught) => caught);
    expect(error).toBeInstanceOf(BookingInvoiceAnomalyError);
    expect(error.bookingId).toBe(booking.id);
  });

  it("FULL : un montant incohérent reste une erreur ordinaire, comme sur main", async () => {
    const error = await ensureBookingInvoice(intent({ amount_received: 15000 })).catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(BookingInvoiceAnomalyError);
    expect(error.message).toMatch(/Montant encaissé incohérent/);
  });

  it("FULL : une seule ligne du montant encaissé, comme sur main", async () => {
    stripeMock.invoices.attachPayment.mockResolvedValue({
      id: "in_1", status: "paid", number: "F-1", amount_paid: 30000, hosted_invoice_url: "https://invoice.test/in_1",
    });
    await ensureBookingInvoice(intent());
    expect(stripeMock.invoiceItems.create).toHaveBeenCalledTimes(1);
    const [params, options] = stripeMock.invoiceItems.create.mock.calls[0];
    expect(params.amount).toBe(30000);
    expect(params.metadata).toEqual({ bookingId: booking.id, bookingInvoiceVersion: BOOKING_INVOICE_VERSION });
    expect(options).toEqual({ idempotencyKey: `booking-invoice:${BOOKING_INVOICE_VERSION}:pi_1:item` });
  });
});

describe("getBalanceInvoiceLines", () => {
  const base = { bookingId: "b1", totalPrice: 186.33, depositCaptured: 56, depositPaidAt: null, description: "Garde" };

  it("total − acompte − intérêts = solde, au centime", () => {
    const lines = getBalanceInvoiceLines({ ...base, interest: "0.42" });
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(18633 - 5600 - 42);
  });

  it("refuse une facture finale sans acompte encaissé", () => {
    expect(() => getBalanceInvoiceLines({ ...base, depositCaptured: 0 })).toThrow();
  });

  it("refuse des intérêts illisibles", () => {
    expect(() => getBalanceInvoiceLines({ ...base, interest: "abc" })).toThrow();
  });
});
