import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";

// Stripe simulé : seule la vérification de signature est réelle (locale).
const { WEBHOOK_SECRET, prismaMock, retrievePaymentIntent } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
  return {
    WEBHOOK_SECRET: "whsec_test_dummy",
    retrievePaymentIntent: vi.fn(),
    prismaMock: {
      stripeWebhookEvent: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      checkoutAttempt: { updateMany: vi.fn() },
      payment: { updateMany: vi.fn() },
      booking: { updateMany: vi.fn(), findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/stripe/config", async () => {
  const { default: StripeSdk } = await import("stripe");
  const sdk = new StripeSdk("sk_test_dummy");
  return { stripe: { webhooks: sdk.webhooks, paymentIntents: { retrieve: retrievePaymentIntent } } };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({
  sendBookingConfirmationEmail: vi.fn(),
  sendBookingRefundCompletedEmail: vi.fn(),
  sendBookingRefundFailedAdminEmail: vi.fn(),
  sendBookingTeamCancellationEmail: vi.fn(),
  sendBookingRequestEmail: vi.fn(),
  sendNewBookingAdminEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendSubscriptionPaymentFailedAdminEmail: vi.fn(),
  sendSubscriptionRefundCompletedEmail: vi.fn(),
}));
vi.mock("@/lib/booking-invoices", () => ({ ensureBookingInvoice: vi.fn() }));
vi.mock("@/lib/loyalty-ledger", () => ({ awardBookingLoyalty: vi.fn() }));
vi.mock("@/lib/booking-email-details", () => ({ getBookingEmailDetails: vi.fn() }));

import { POST } from "@/app/api/stripe/webhook/route";

const baseMetadata = {
  bookingIds: "booking_1",
  userId: "user_1",
  promoCode: "",
  legalAccepted: "true",
  legalVersion: "2026-09-13",
};

const depositMetadata = {
  ...baseMetadata,
  paymentPlan: "DEPOSIT_BALANCE",
  totalAmount: "300.00",
  depositAmount: "90.00",
  balanceAmount: "210.00",
  balanceDueDate: "2027-04-19",
  balanceMandateAccepted: "true",
  balanceMandateAcceptedAt: "2026-11-26T10:00:00.000Z",
  balanceMandateLegalVersion: "2026-09-13",
};

const completedEvent = (metadata: Record<string, string>, id = "evt_checkout_completed") => JSON.stringify({
  id,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1",
      object: "checkout.session",
      mode: "payment",
      payment_intent: "pi_deposit",
      customer: "cus_test",
      metadata,
    },
  },
});

const post = (body: string) =>
  POST(new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }) },
  }));

describe("webhook checkout.session.completed : plan acompte + solde", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({});
    prismaMock.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    // Libération du verrou en cas d'erreur : Prisma renvoie toujours une promesse.
    prismaMock.stripeWebhookEvent.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.checkoutAttempt.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.booking.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    retrievePaymentIntent.mockResolvedValue({ id: "pi_deposit", payment_method: "pm_card_saved" });
  });

  it("enregistre le consentement, les montants et la carte de la réservation", async () => {
    const response = await post(completedEvent(depositMetadata));

    expect(response.status).toBe(200);
    expect(retrievePaymentIntent).toHaveBeenCalledWith("pi_deposit");
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "booking_1", stripePaymentId: "pi_deposit" },
      data: { stripePaymentMethodId: "pm_card_saved" },
    });
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking_1" },
      data: {
        paymentPlan: "DEPOSIT_BALANCE",
        depositAmount: 90,
        balanceAmount: 210,
        balanceDueAt: new Date("2027-04-18T22:00:00.000Z"),
        mandateAcceptedAt: new Date("2026-11-26T10:00:00.000Z"),
        mandateLegalVersion: "2026-09-13",
      },
    });
  });

  it("accepte une carte développée par Stripe (objet PaymentMethod)", async () => {
    retrievePaymentIntent.mockResolvedValue({ id: "pi_deposit", payment_method: { id: "pm_expanded" } });
    const response = await post(completedEvent(depositMetadata));
    expect(response.status).toBe(200);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { stripePaymentMethodId: "pm_expanded" },
    }));
  });

  it("plan FULL : aucun appel Stripe ni écriture supplémentaire", async () => {
    const response = await post(completedEvent(baseMetadata));

    expect(response.status).toBe(200);
    expect(retrievePaymentIntent).not.toHaveBeenCalled();
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ stripePaymentMethodId: expect.anything() }),
    }));
  });

  it("échoue (Stripe rejouera) si la carte manque, sans écrire le plan", async () => {
    retrievePaymentIntent.mockResolvedValue({ id: "pi_deposit", payment_method: null });

    const response = await post(completedEvent(depositMetadata));

    expect(response.status).toBe(500);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.stripeWebhookEvent.deleteMany).toHaveBeenCalled();
  });

  it("échoue si le consentement est absent des métadonnées d'un plan acompte", async () => {
    const { balanceMandateAccepted: _omitted, ...withoutMandate } = depositMetadata;
    void _omitted;

    const response = await post(completedEvent(withoutMandate));

    expect(response.status).toBe(500);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.stripeWebhookEvent.deleteMany).toHaveBeenCalled();
  });
});
