import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";

// Valeurs factices : la route lit ces variables au chargement du module.
const { WEBHOOK_SECRET, prismaMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
  return {
    WEBHOOK_SECRET: "whsec_test_dummy",
    prismaMock: {
      stripeWebhookEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
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

// Type d'événement non géré par la route : seule la signature est exercée.
const payload = JSON.stringify({
  id: "evt_test_signature",
  object: "event",
  type: "customer.created",
  data: { object: { id: "cus_test", object: "customer" } },
});

const sign = (options: { secret?: string; timestamp?: number; body?: string } = {}) =>
  Stripe.webhooks.generateTestHeaderString({
    payload: options.body ?? payload,
    secret: options.secret ?? WEBHOOK_SECRET,
    timestamp: options.timestamp,
  });

const post = (body: string, signature?: string) =>
  POST(new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : undefined,
  }));

describe("signature du webhook Stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({});
    prismaMock.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
  });

  it("accepte un événement correctement signé", async () => {
    const response = await post(payload, sign());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: "evt_test_signature", type: "customer.created", status: "PROCESSING" }),
    });
  });

  it.each([
    ["sans en-tête de signature", () => post(payload)],
    ["avec une signature illisible", () => post(payload, "t=1,v1=invalide")],
    ["signé avec un autre secret", () => post(payload, sign({ secret: "whsec_autre_secret" }))],
    ["dont le corps a été modifié après signature", () => post(payload.replace("cus_test", "cus_pirate"), sign())],
    ["rejoué hors de la fenêtre de tolérance", () => post(payload, sign({ timestamp: Math.floor(Date.now() / 1000) - 3600 }))],
  ])("rejette un événement %s", async (_label, send) => {
    const response = await send();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Signature invalide" });
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.stripeWebhookEvent.updateMany).not.toHaveBeenCalled();
  });
});
