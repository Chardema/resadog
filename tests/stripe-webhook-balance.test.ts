import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";

// Lot 5 (spec 07) : routage des événements metadata.kind=booking_balance.
// Le solde ne doit jamais repasser par la confirmation, la fidélité, l'e-mail
// d'acompte ni le paiement de l'acompte.
const { WEBHOOK_SECRET, prismaMock, emailMock, invoiceMock, loyaltyMock, balanceMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
  return {
    WEBHOOK_SECRET: "whsec_test_dummy",
    prismaMock: {
      stripeWebhookEvent: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      payment: { updateMany: vi.fn(), findFirst: vi.fn() },
      booking: { updateMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
      bookingInstallment: { upsert: vi.fn() },
      user: { update: vi.fn() },
      $transaction: vi.fn(),
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
    loyaltyMock: { awardBookingLoyalty: vi.fn() },
    balanceMock: {
      settleBalanceSucceeded: vi.fn(),
      handleBalancePaymentFailed: vi.fn(),
      releaseExpiredBalanceCheckout: vi.fn(),
    },
  };
});

vi.mock("@/lib/stripe/config", async () => {
  const { default: StripeSdk } = await import("stripe");
  const sdk = new StripeSdk("sk_test_dummy");
  return { stripe: { webhooks: sdk.webhooks, paymentIntents: { retrieve: vi.fn() }, paymentMethods: { retrieve: vi.fn() } } };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => emailMock);
vi.mock("@/lib/booking-invoices", () => invoiceMock);
vi.mock("@/lib/loyalty-ledger", () => loyaltyMock);
vi.mock("@/lib/balance-collection", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/balance-collection")>();
  return { isBalancePaymentIntentMetadata: original.isBalancePaymentIntentMetadata, ...balanceMock };
});

import { POST } from "@/app/api/stripe/webhook/route";

const post = (type: string, object: Record<string, unknown>, id = `evt_${type}`) => {
  const body = JSON.stringify({ id, object: "event", type, data: { object } });
  return POST(new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }) },
  }));
};

const balanceMetadata = { kind: "booking_balance", type: "booking_balance", bookingId: "booking_1", installmentId: "inst_1", userId: "user_1" };

const expectDepositFlowUntouched = () => {
  expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
  expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
  expect(prismaMock.bookingInstallment.upsert).not.toHaveBeenCalled();
  expect(prismaMock.user.update).not.toHaveBeenCalled();
  expect(loyaltyMock.awardBookingLoyalty).not.toHaveBeenCalled();
  expect(emailMock.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  expect(emailMock.sendBookingDepositConfirmationEmail).not.toHaveBeenCalled();
  expect(emailMock.sendBookingRequestEmail).not.toHaveBeenCalled();
  expect(emailMock.sendPaymentFailedEmail).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.stripeWebhookEvent.create.mockResolvedValue({});
  prismaMock.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.stripeWebhookEvent.deleteMany.mockResolvedValue({ count: 1 });
  balanceMock.settleBalanceSucceeded.mockResolvedValue("SUCCEEDED");
  balanceMock.handleBalancePaymentFailed.mockResolvedValue({ recorded: true, retryAt: null, notifyErrors: [] });
});

describe("webhook : solde booking_balance (lot 5)", () => {
  it("payment_intent.succeeded : seul le solde est réglé (facture finale demandée)", async () => {
    const intent = { id: "pi_balance_1", object: "payment_intent", status: "succeeded", amount_received: 21000, metadata: balanceMetadata };
    const response = await post("payment_intent.succeeded", intent);

    expect(response.status).toBe(200);
    expect(balanceMock.settleBalanceSucceeded).toHaveBeenCalledWith(expect.objectContaining({ id: "pi_balance_1" }), { invoice: true });
    expectDepositFlowUntouched();
  });

  it("payment_intent.payment_failed : échec du solde, réservation et acompte intacts", async () => {
    const intent = { id: "pi_balance_1", object: "payment_intent", status: "requires_payment_method", metadata: balanceMetadata };
    const response = await post("payment_intent.payment_failed", intent);

    expect(response.status).toBe(200);
    expect(balanceMock.handleBalancePaymentFailed).toHaveBeenCalledTimes(1);
    expectDepositFlowUntouched();
  });

  it("e-mail d'échec non parti : 500 et verrou libéré pour que Stripe rejoue", async () => {
    balanceMock.handleBalancePaymentFailed.mockRejectedValueOnce(new Error("e-mail à renvoyer"));
    const response = await post("payment_intent.payment_failed", { id: "pi_balance_1", object: "payment_intent", metadata: balanceMetadata });

    expect(response.status).toBe(500);
    expect(prismaMock.stripeWebhookEvent.deleteMany).toHaveBeenCalled();
  });

  it("checkout.session.completed d'une reprise : aucun effet sur le paiement de l'acompte", async () => {
    const response = await post("checkout.session.completed", {
      id: "cs_balance_1", object: "checkout.session", mode: "payment", payment_intent: "pi_checkout_1", metadata: balanceMetadata,
    });

    expect(response.status).toBe(200);
    expectDepositFlowUntouched();
  });

  it("checkout.session.expired d'une reprise : libère le verrou, ne supprime aucune réservation", async () => {
    const response = await post("checkout.session.expired", { id: "cs_balance_1", object: "checkout.session", metadata: balanceMetadata });

    expect(response.status).toBe(200);
    expect(balanceMock.releaseExpiredBalanceCheckout).toHaveBeenCalledWith(expect.objectContaining({ id: "cs_balance_1" }));
    expect(prismaMock.booking.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
