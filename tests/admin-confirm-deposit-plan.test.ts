import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Stripe, Prisma, l'authentification et Resend sont simulés : aucun appel réseau.
const { flags, prismaMock, txMock, stripeMock, emailMock, confirmationMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  const txMock = {
    payment: { update: vi.fn(), updateMany: vi.fn() },
    booking: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    bookingInstallment: { upsert: vi.fn() },
  };
  return {
    flags: { enabled: false },
    txMock,
    prismaMock: {
      booking: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      payment: { findFirst: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    },
    stripeMock: {
      paymentIntents: { retrieve: vi.fn(), capture: vi.fn() },
      paymentMethods: { retrieve: vi.fn() },
    },
    emailMock: {
      sendBookingConfirmationEmail: vi.fn(),
      sendBookingRefundCompletedEmail: vi.fn(),
      sendBookingTeamCancellationEmail: vi.fn(),
      sendBookingDepositConfirmationEmail: vi.fn(),
      sendBookingAuthorizationExpiredEmail: vi.fn(),
      sendBookingAuthorizationAlertAdminEmail: vi.fn(),
    },
    confirmationMock: { claimBookingForConfirmation: vi.fn(), releaseBookingConfirmationClaim: vi.fn() },
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
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "admin_1", role: "ADMIN" } })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/email", () => emailMock);
vi.mock("@/lib/booking-confirmation", () => ({
  ...confirmationMock,
  BookingConfirmationError: class BookingConfirmationError extends Error {},
}));
vi.mock("@/lib/loyalty-ledger", () => ({ awardBookingLoyalty: vi.fn(), reverseBookingLoyalty: vi.fn() }));
vi.mock("@/lib/complete-bookings", () => ({ completeBookings: vi.fn() }));
vi.mock("@/lib/direct-booking", () => ({ isDirectPayment: () => false }));
vi.mock("@/lib/team-booking-cancellation", () => ({
  processTeamCancellationPayment: vi.fn(),
  TeamCancellationPaymentError: class TeamCancellationPaymentError extends Error {},
}));

import { PATCH } from "@/app/api/admin/bookings/[bookingId]/status/route";
import { ensureBalanceInstallment, getBalanceInstallmentData, getBalanceInstallmentKey } from "@/lib/booking-balance";

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking_1",
  status: "PENDING",
  serviceType: "BOARDING",
  totalPrice: 300,
  startDate: new Date("2027-04-26T00:00:00.000Z"),
  endDate: new Date("2027-05-01T00:00:00.000Z"),
  startTime: "10:00",
  endTime: "18:00",
  specialRequests: null,
  notes: null,
  paymentPlan: "DEPOSIT_BALANCE",
  depositAmount: 90,
  balanceAmount: 210,
  balanceDueAt: new Date("2027-04-18T22:00:00.000Z"),
  client: { id: "user_1", email: "client@example.test", name: "Client" },
  pets: [{ name: "Rex" }],
  pet: null,
  payment: {
    id: "payment_1",
    amount: 90,
    status: "PROCESSING",
    stripePaymentId: "pi_deposit",
    stripePaymentMethodId: "pm_saved",
    paymentMethod: null,
    paidAt: null,
  },
  ...overrides,
});

const fullBooking = () => makeBooking({
  paymentPlan: "FULL",
  depositAmount: 300,
  balanceAmount: null,
  balanceDueAt: null,
  payment: { ...makeBooking().payment, amount: 300, stripePaymentMethodId: null },
});

const confirm = () =>
  PATCH(
    new NextRequest("http://localhost/api/admin/bookings/booking_1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "CONFIRMED" }),
    }),
    { params: Promise.resolve({ bookingId: "booking_1" }) }
  );

const setup = (booking: ReturnType<typeof makeBooking>, capturedCents: number) => {
  prismaMock.booking.findUnique.mockResolvedValue(booking);
  confirmationMock.claimBookingForConfirmation.mockResolvedValue({
    booking: { ...booking, status: "ACCEPTING" },
    unchanged: false,
  });
  stripeMock.paymentIntents.retrieve.mockResolvedValue({ id: "pi_deposit", status: "requires_capture" });
  stripeMock.paymentIntents.capture.mockResolvedValue({ id: "pi_deposit", status: "succeeded", amount_received: capturedCents });
  txMock.booking.findUniqueOrThrow.mockResolvedValue({ ...booking, status: "CONFIRMED" });
};

describe("acceptation d'une réservation : capture de l'acompte seul (lot 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.enabled = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
    txMock.payment.update.mockResolvedValue({});
    txMock.booking.updateMany.mockResolvedValue({ count: 1 });
    txMock.bookingInstallment.upsert.mockResolvedValue({ id: "inst_1" });
    stripeMock.paymentMethods.retrieve.mockResolvedValue({ id: "pm_saved", card: { last4: "4242" } });
  });

  it("DEPOSIT_BALANCE : capture le PaymentIntent de l'acompte, programme le solde à J-7 et envoie le calendrier", async () => {
    setup(makeBooking(), 9000);

    const response = await confirm();

    expect(response.status).toBe(200);
    expect(stripeMock.paymentIntents.capture).toHaveBeenCalledTimes(1);
    expect(stripeMock.paymentIntents.capture).toHaveBeenCalledWith(
      "pi_deposit",
      {},
      { idempotencyKey: "booking:booking_1:confirmation-capture" }
    );
    expect(txMock.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUCCEEDED", capturedAmount: 90 }),
    }));
    expect(txMock.bookingInstallment.upsert).toHaveBeenCalledWith({
      where: { idempotencyKey: "booking:booking_1:balance" },
      update: {},
      create: {
        bookingId: "booking_1",
        kind: "BALANCE",
        amount: 210,
        status: "SCHEDULED",
        dueAt: new Date("2027-04-18T22:00:00.000Z"),
        idempotencyKey: "booking:booking_1:balance",
      },
    });
    expect(emailMock.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(stripeMock.paymentMethods.retrieve).toHaveBeenCalledWith("pm_saved");
    expect(emailMock.sendBookingDepositConfirmationEmail).toHaveBeenCalledWith(
      "client@example.test",
      "Client",
      expect.objectContaining({
        depositAmount: 90,
        balanceAmount: 210,
        balanceDueDate: "2027-04-19",
        cardLast4: "4242",
      }),
      { idempotencyKey: "booking-deposit-confirmation-booking_1" }
    );
  });

  it("FULL : capture du total, aucune échéance, e-mail de confirmation habituel (non-régression)", async () => {
    setup(fullBooking(), 30000);

    const response = await confirm();

    expect(response.status).toBe(200);
    expect(txMock.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ capturedAmount: 300 }),
    }));
    expect(txMock.bookingInstallment.upsert).not.toHaveBeenCalled();
    expect(emailMock.sendBookingDepositConfirmationEmail).not.toHaveBeenCalled();
    expect(stripeMock.paymentMethods.retrieve).not.toHaveBeenCalled();
    expect(emailMock.sendBookingConfirmationEmail).toHaveBeenCalledWith(
      "client@example.test",
      "Client",
      expect.objectContaining({ totalPrice: 300 }),
      { idempotencyKey: "booking-confirmation-booking_1" }
    );
  });

  it("carte illisible : l'e-mail part quand même, sans les 4 derniers chiffres", async () => {
    setup(makeBooking(), 9000);
    stripeMock.paymentMethods.retrieve.mockRejectedValue(new Error("Stripe indisponible"));

    const response = await confirm();
    const body = await response.json();

    expect(body.confirmationEmailSent).toBe(true);
    expect(emailMock.sendBookingDepositConfirmationEmail).toHaveBeenCalledWith(
      "client@example.test",
      "Client",
      expect.objectContaining({ cardLast4: null }),
      expect.anything()
    );
  });

  it("drapeau désactivé : une autorisation annulée renvoie la même erreur 409 qu'aujourd'hui", async () => {
    setup(fullBooking(), 30000);
    stripeMock.paymentIntents.retrieve.mockResolvedValue({ id: "pi_deposit", status: "canceled", metadata: { bookingIds: "booking_1" } });

    const response = await confirm();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Le paiement Stripe ne peut pas être capturé (statut: canceled)");
    expect(confirmationMock.releaseBookingConfirmationClaim).toHaveBeenCalledWith("booking_1");
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(emailMock.sendBookingAuthorizationExpiredEmail).not.toHaveBeenCalled();
  });

  it("drapeau activé : une autorisation expirée fait passer la demande en EXPIRED (lot 4)", async () => {
    flags.enabled = true;
    const booking = fullBooking();
    setup(booking, 30000);
    stripeMock.paymentIntents.retrieve.mockResolvedValue({
      id: "pi_deposit",
      status: "canceled",
      canceled_at: Math.floor(Date.now() / 1000),
      metadata: { bookingIds: "booking_1" },
    });
    prismaMock.payment.findFirst.mockResolvedValue({ ...booking.payment, booking });
    txMock.payment.updateMany.mockResolvedValue({ count: 1 });

    const response = await confirm();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.expired).toBe(true);
    expect(stripeMock.paymentIntents.capture).not.toHaveBeenCalled();
    expect(confirmationMock.releaseBookingConfirmationClaim).toHaveBeenCalledWith("booking_1");
    expect(txMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking_1", status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    expect(emailMock.sendBookingAuthorizationExpiredEmail).toHaveBeenCalledTimes(1);
    expect(emailMock.sendBookingAuthorizationAlertAdminEmail).toHaveBeenCalledWith("EXPIRED", expect.anything(), expect.anything());
  });
});

describe("échéance du solde (BookingInstallment BALANCE)", () => {
  const base = {
    id: "booking_1",
    startDate: new Date("2027-04-26T00:00:00.000Z"),
    depositAmount: 90,
    balanceAmount: 210,
    balanceDueAt: null,
  };

  it("FULL : aucune échéance", () => {
    expect(getBalanceInstallmentData({ ...base, paymentPlan: "FULL" })).toBeNull();
  });

  it("DEPOSIT_BALANCE : début − 7 jours (00:00, heure de Paris) à défaut de date consentie", () => {
    expect(getBalanceInstallmentData({ ...base, paymentPlan: "DEPOSIT_BALANCE" })).toEqual({
      bookingId: "booking_1",
      kind: "BALANCE",
      amount: 210,
      status: "SCHEDULED",
      dueAt: new Date("2027-04-18T22:00:00.000Z"),
      idempotencyKey: getBalanceInstallmentKey("booking_1"),
    });
  });

  it("garde les centimes du solde", () => {
    expect(getBalanceInstallmentData({ ...base, paymentPlan: "DEPOSIT_BALANCE", balanceAmount: 186.33 })?.amount).toBe(186.33);
  });

  it("refuse un plan acompte sans solde", () => {
    expect(() => getBalanceInstallmentData({ ...base, paymentPlan: "DEPOSIT_BALANCE", balanceAmount: null })).toThrow();
  });

  it("est idempotent (upsert sur la clé unique, sans mise à jour)", async () => {
    const db = { bookingInstallment: { upsert: vi.fn().mockResolvedValue({ id: "inst_1" }) } };
    await ensureBalanceInstallment(db as never, { ...base, paymentPlan: "DEPOSIT_BALANCE" });
    await ensureBalanceInstallment(db as never, { ...base, paymentPlan: "DEPOSIT_BALANCE" });
    expect(db.bookingInstallment.upsert).toHaveBeenCalledTimes(2);
    expect(db.bookingInstallment.upsert.mock.calls[0][0]).toEqual(db.bookingInstallment.upsert.mock.calls[1][0]);
    expect(db.bookingInstallment.upsert.mock.calls[0][0].update).toEqual({});
    expect(await ensureBalanceInstallment(db as never, { ...base, paymentPlan: "FULL" })).toBeNull();
    expect(db.bookingInstallment.upsert).toHaveBeenCalledTimes(2);
  });
});
