import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";

// Stripe simulé : seule la vérification de signature est réelle (locale).
const { WEBHOOK_SECRET, flags, prismaMock, txMock, stripeMock, emailMock, invoiceMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
  const txMock = {
    booking: { updateMany: vi.fn() },
    payment: { updateMany: vi.fn() },
  };
  return {
    WEBHOOK_SECRET: "whsec_test_dummy",
    flags: { enabled: false },
    txMock,
    prismaMock: {
      stripeWebhookEvent: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      payment: { updateMany: vi.fn(), findFirst: vi.fn() },
      booking: { updateMany: vi.fn(), findUnique: vi.fn() },
      bookingInstallment: { upsert: vi.fn() },
      user: { update: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    },
    stripeMock: {
      paymentIntents: { retrieve: vi.fn() },
      paymentMethods: { retrieve: vi.fn() },
    },
    emailMock: {
      sendBookingConfirmationEmail: vi.fn(),
      sendBookingDepositConfirmationEmail: vi.fn(),
      sendBookingAuthorizationExpiredEmail: vi.fn(),
      sendBookingAuthorizationAlertAdminEmail: vi.fn(),
      sendBookingRefundCompletedEmail: vi.fn(),
      sendBookingRefundFailedAdminEmail: vi.fn(),
      sendBookingTeamCancellationEmail: vi.fn(),
      sendBookingRequestEmail: vi.fn(),
      sendNewBookingAdminEmail: vi.fn(),
      sendPaymentFailedEmail: vi.fn(),
      sendSubscriptionPaymentFailedAdminEmail: vi.fn(),
      sendSubscriptionRefundCompletedEmail: vi.fn(),
    },
    invoiceMock: { ensureBookingInvoice: vi.fn() },
  };
});

vi.mock("@/lib/payment-plan", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/payment-plan")>();
  return {
    ...original,
    isPaymentPlanEnabled: () => flags.enabled,
  };
});
vi.mock("@/lib/stripe/config", async () => {
  const { default: StripeSdk } = await import("stripe");
  const sdk = new StripeSdk("sk_test_dummy");
  return { stripe: { webhooks: sdk.webhooks, ...stripeMock } };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => emailMock);
vi.mock("@/lib/booking-invoices", () => invoiceMock);
vi.mock("@/lib/loyalty-ledger", () => ({ awardBookingLoyalty: vi.fn() }));

import { POST } from "@/app/api/stripe/webhook/route";

const post = (type: string, object: Record<string, unknown>, id = `evt_${type}`) => {
  const body = JSON.stringify({ id, object: "event", type, data: { object } });
  return POST(new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }) },
  }));
};

const depositBooking = {
  id: "booking_1",
  status: "CONFIRMED",
  serviceType: "BOARDING",
  totalPrice: 300,
  startDate: new Date("2027-04-26T00:00:00.000Z"),
  endDate: new Date("2027-05-01T00:00:00.000Z"),
  startTime: "10:00",
  endTime: "18:00",
  specialRequests: null,
  paymentPlan: "DEPOSIT_BALANCE",
  depositAmount: 90,
  balanceAmount: 210,
  balanceDueAt: new Date("2027-04-18T22:00:00.000Z"),
  client: { email: "client@example.test", name: "Client" },
  pets: [{ name: "Rex" }],
  pet: null,
  payment: { id: "payment_1", amount: 90, status: "PROCESSING", stripePaymentId: "pi_deposit", stripePaymentMethodId: "pm_saved" },
};

beforeEach(() => {
  vi.clearAllMocks();
  flags.enabled = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.stripeWebhookEvent.create.mockResolvedValue({});
  prismaMock.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.stripeWebhookEvent.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.bookingInstallment.upsert.mockResolvedValue({ id: "inst_1" });
  txMock.booking.updateMany.mockResolvedValue({ count: 1 });
  txMock.payment.updateMany.mockResolvedValue({ count: 1 });
  stripeMock.paymentMethods.retrieve.mockResolvedValue({ id: "pm_saved", card: { last4: "4242", brand: "visa" } });
  invoiceMock.ensureBookingInvoice.mockResolvedValue(null);
});

describe("webhook payment_intent.succeeded : acompte capturé (lot 3)", () => {
  const depositIntent = {
    id: "pi_deposit",
    object: "payment_intent",
    status: "succeeded",
    amount_received: 9000,
    payment_method: "pm_saved",
    metadata: { bookingIds: "booking_1", userId: "user_1", paymentPlan: "DEPOSIT_BALANCE" },
  };

  it("répare une validation interrompue : échéance du solde + e-mail avec calendrier", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(depositBooking);

    const response = await post("payment_intent.succeeded", depositIntent);

    expect(response.status).toBe(200);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUCCEEDED", capturedAmount: 90 }),
    }));
    expect(prismaMock.bookingInstallment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: "booking:booking_1:balance" },
      create: expect.objectContaining({ kind: "BALANCE", amount: 210, status: "SCHEDULED" }),
    }));
    expect(emailMock.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(emailMock.sendBookingDepositConfirmationEmail).toHaveBeenCalledWith(
      "client@example.test",
      "Client",
      expect.objectContaining({ depositAmount: 90, balanceAmount: 210, balanceDueDate: "2027-04-19" }),
      { idempotencyKey: "booking-deposit-confirmation-booking_1" }
    );
    expect(invoiceMock.ensureBookingInvoice).toHaveBeenCalledTimes(1);
  });

  it("validation déjà faite par l'équipe : ni échéance ni e-mail en double", async () => {
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });

    const response = await post("payment_intent.succeeded", depositIntent);

    expect(response.status).toBe(200);
    expect(prismaMock.bookingInstallment.upsert).not.toHaveBeenCalled();
    expect(emailMock.sendBookingDepositConfirmationEmail).not.toHaveBeenCalled();
  });

  it("FULL : e-mail de confirmation habituel, aucune échéance (non-régression)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      ...depositBooking, paymentPlan: "FULL", depositAmount: 300, balanceAmount: null, balanceDueAt: null,
    });

    await post("payment_intent.succeeded", { ...depositIntent, amount_received: 30000, metadata: { bookingIds: "booking_1", userId: "user_1" } });

    expect(prismaMock.bookingInstallment.upsert).not.toHaveBeenCalled();
    expect(emailMock.sendBookingDepositConfirmationEmail).not.toHaveBeenCalled();
    expect(emailMock.sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
  });
});

describe("webhook payment_intent.canceled / charge.expired (lot 4)", () => {
  const canceledIntent = {
    id: "pi_deposit",
    object: "payment_intent",
    status: "canceled",
    cancellation_reason: "automatic",
    canceled_at: Math.floor(Date.now() / 1000),
    metadata: { bookingIds: "booking_1" },
  };

  it("drapeau désactivé : événement accepté sans aucun effet (comme sur main)", async () => {
    const response = await post("payment_intent.canceled", canceledIntent);
    expect(response.status).toBe(200);
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    const chargeResponse = await post("charge.expired", { id: "ch_1", object: "charge", payment_intent: "pi_deposit" });
    expect(chargeResponse.status).toBe(200);
    expect(stripeMock.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it("drapeau activé : la demande PENDING passe en EXPIRED, client et équipe prévenus", async () => {
    flags.enabled = true;
    prismaMock.payment.findFirst.mockResolvedValue({ ...depositBooking.payment, booking: { ...depositBooking, status: "PENDING" } });

    const response = await post("payment_intent.canceled", canceledIntent);

    expect(response.status).toBe(200);
    expect(txMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking_1", status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    expect(emailMock.sendBookingAuthorizationExpiredEmail).toHaveBeenCalledTimes(1);
    expect(emailMock.sendBookingAuthorizationAlertAdminEmail).toHaveBeenCalledTimes(1);
  });

  it("e-mail en échec : 500 pour que Stripe rejoue l'événement", async () => {
    flags.enabled = true;
    prismaMock.payment.findFirst.mockResolvedValue({ ...depositBooking.payment, booking: { ...depositBooking, status: "PENDING" } });
    emailMock.sendBookingAuthorizationExpiredEmail.mockRejectedValueOnce(new Error("Resend indisponible"));

    const response = await post("payment_intent.canceled", canceledIntent);

    expect(response.status).toBe(500);
    expect(prismaMock.stripeWebhookEvent.deleteMany).toHaveBeenCalled();
  });

  it("charge.expired relit le PaymentIntent et applique la même règle", async () => {
    flags.enabled = true;
    stripeMock.paymentIntents.retrieve.mockResolvedValue(canceledIntent);
    prismaMock.payment.findFirst.mockResolvedValue({ ...depositBooking.payment, booking: { ...depositBooking, status: "PENDING" } });

    const response = await post("charge.expired", { id: "ch_1", object: "charge", payment_intent: "pi_deposit" });

    expect(response.status).toBe(200);
    expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith("pi_deposit");
    expect(txMock.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EXPIRED" } }));
  });
});
