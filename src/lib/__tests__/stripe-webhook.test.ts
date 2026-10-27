import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockConstructEvent,
  mockWebhookEventCreate,
  mockWebhookEventFindUnique,
  mockWebhookEventUpdateMany,
  mockWebhookEventDeleteMany,
  mockPaymentUpdateMany,
  mockBookingUpdateMany,
  mockUserSubscriptionUpsert,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockWebhookEventCreate: vi.fn(),
  mockWebhookEventFindUnique: vi.fn(),
  mockWebhookEventUpdateMany: vi.fn(),
  mockWebhookEventDeleteMany: vi.fn(),
  mockPaymentUpdateMany: vi.fn(),
  mockBookingUpdateMany: vi.fn(),
  mockUserSubscriptionUpsert: vi.fn(),
}));

vi.mock("@/lib/stripe/config", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    paymentMethods: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    stripeWebhookEvent: {
      create: mockWebhookEventCreate,
      findUnique: mockWebhookEventFindUnique,
      updateMany: mockWebhookEventUpdateMany,
      deleteMany: mockWebhookEventDeleteMany,
    },
    payment: {
      updateMany: mockPaymentUpdateMany,
    },
    booking: {
      updateMany: mockBookingUpdateMany,
      findUnique: vi.fn(),
    },
    userSubscription: {
      upsert: mockUserSubscriptionUpsert,
      updateMany: vi.fn(),
    },
  },
}));

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

vi.mock("@/lib/booking-invoices", () => ({
  ensureBookingInvoice: vi.fn(),
}));

vi.mock("@/lib/loyalty-ledger", () => ({
  awardBookingLoyalty: vi.fn(),
}));

import { POST as postStripeWebhook } from "@/app/api/stripe/webhook/route";

describe("Stripe Webhook Route (/api/stripe/webhook)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTTP 400 when stripe-signature header is missing", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No webhook payload was provided.");
    });

    const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({ id: "evt_missing_sig" }),
    });

    const response = await postStripeWebhook(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Signature invalide" });
    expect(mockWebhookEventCreate).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when stripe-signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });

    const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=12345,v1=invalidsignature" },
      body: JSON.stringify({ id: "evt_invalid_sig" }),
    });

    const response = await postStripeWebhook(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Signature invalide" });
    expect(mockWebhookEventCreate).not.toHaveBeenCalled();
  });

  it("safely ignores duplicate already-processed Stripe events (idempotency) without re-running side effects", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_duplicate_123",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          amount_received: 4500,
          metadata: { bookingId: "booking_1" },
        },
      },
    });

    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`id`)",
      {
        code: "P2002",
        clientVersion: "7.8.0",
      }
    );
    mockWebhookEventCreate.mockRejectedValueOnce(uniqueConstraintError);
    mockWebhookEventFindUnique.mockResolvedValueOnce({
      id: "evt_duplicate_123",
      type: "payment_intent.succeeded",
      status: "PROCESSED",
      attemptToken: "token-initial",
      updatedAt: new Date(),
      processedAt: new Date(),
    });

    const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=12345,v1=validsig" },
      body: JSON.stringify({ id: "evt_duplicate_123" }),
    });

    const response = await postStripeWebhook(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ received: true, duplicate: true });
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
    expect(mockUserSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it("processes a new valid Stripe event once and marks it PROCESSED", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_fresh_123",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_sub_123",
          amount_received: 990,
          metadata: {},
        },
      },
    });
    mockWebhookEventCreate.mockResolvedValueOnce({
      id: "evt_fresh_123",
      status: "PROCESSING",
    });
    mockWebhookEventUpdateMany.mockResolvedValueOnce({ count: 1 });

    const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=12345,v1=validsig" },
      body: JSON.stringify({ id: "evt_fresh_123" }),
    });

    const response = await postStripeWebhook(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ received: true });
    expect(mockWebhookEventCreate).toHaveBeenCalledTimes(1);
    expect(mockWebhookEventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "evt_fresh_123",
          status: "PROCESSING",
        }),
        data: expect.objectContaining({
          status: "PROCESSED",
        }),
      })
    );
  });
});
