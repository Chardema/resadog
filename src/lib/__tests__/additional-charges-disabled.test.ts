import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockBookingFindUnique,
  mockChargeCreateMany,
  mockChargeFindUniqueOrThrow,
  mockChargeUpdate,
  mockChargeUpdateMany,
  mockChargeFindMany,
  mockPaymentIntentsCreate,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockBookingFindUnique: vi.fn(),
  mockChargeCreateMany: vi.fn(),
  mockChargeFindUniqueOrThrow: vi.fn(),
  mockChargeUpdate: vi.fn(),
  mockChargeUpdateMany: vi.fn(),
  mockChargeFindMany: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    booking: {
      findUnique: mockBookingFindUnique,
    },
    additionalCharge: {
      createMany: mockChargeCreateMany,
      findUniqueOrThrow: mockChargeFindUniqueOrThrow,
      update: mockChargeUpdate,
      updateMany: mockChargeUpdateMany,
      findMany: mockChargeFindMany,
    },
  },
}));

vi.mock("@/lib/stripe/config", () => ({
  stripe: {
    paymentIntents: {
      create: mockPaymentIntentsCreate,
    },
  },
}));

import { GET, POST } from "@/app/api/admin/additional-charges/route";
import {
  ADDITIONAL_CHARGES_DISABLED_MESSAGE,
  ADDITIONAL_CHARGES_ENABLED,
} from "@/lib/additional-charges";

const validBody = {
  bookingId: "booking-1",
  amount: 25,
  reason: "Toilettage",
  idempotencyKey: "6f1c2a8e-3b4d-4e5f-9a6b-7c8d9e0f1a2b",
};

function postRequest(body: unknown = validBody) {
  return new NextRequest("http://localhost:3000/api/admin/additional-charges", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function expectNoChargeSideEffects() {
  expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  expect(mockChargeCreateMany).not.toHaveBeenCalled();
  expect(mockChargeUpdate).not.toHaveBeenCalled();
  expect(mockChargeUpdateMany).not.toHaveBeenCalled();
  expect(mockBookingFindUnique).not.toHaveBeenCalled();
}

describe("/api/admin/additional-charges — débit automatique neutralisé", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the automatic charge flag disabled", () => {
    expect(ADDITIONAL_CHARGES_ENABLED).toBe(false);
  });

  it("still requires authentication on POST (401/403, not the disabled message)", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(postRequest());
    const json = await res.json();

    expect([401, 403]).toContain(res.status);
    expect(json.error).not.toBe(ADDITIONAL_CHARGES_DISABLED_MESSAGE);
    expectNoChargeSideEffects();
  });

  it("still requires the ADMIN role on POST", async () => {
    mockAuth.mockResolvedValue({ user: { id: "client-1", role: "CLIENT" } });

    const res = await POST(postRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).not.toBe(ADDITIONAL_CHARGES_DISABLED_MESSAGE);
    expectNoChargeSideEffects();
  });

  it("refuses an admin POST with a clear error and never calls Stripe nor writes a charge", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });

    const res = await POST(postRequest());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toEqual({ error: ADDITIONAL_CHARGES_DISABLED_MESSAGE });
    expect(json.error).toMatch(/désactivé/);
    expect(json.error).toMatch(/CGV/);
    expectNoChargeSideEffects();
  });

  it("refuses an admin POST before validating the payload", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });

    const res = await POST(postRequest({}));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: ADDITIONAL_CHARGES_DISABLED_MESSAGE });
    expectNoChargeSideEffects();
  });

  it("keeps GET working: auth required, then returns the booking charges", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const unauthenticated = await GET(
      new NextRequest("http://localhost:3000/api/admin/additional-charges?bookingId=booking-1")
    );
    expect(unauthenticated.status).toBe(401);

    mockAuth.mockResolvedValueOnce({ user: { id: "other-client", role: "CLIENT" } });
    mockBookingFindUnique.mockResolvedValueOnce({ clientId: "client-1" });
    const forbidden = await GET(
      new NextRequest("http://localhost:3000/api/admin/additional-charges?bookingId=booking-1")
    );
    expect(forbidden.status).toBe(403);

    const charges = [{ id: "charge-1", bookingId: "booking-1", amount: 25, status: "SUCCEEDED" }];
    mockAuth.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    mockBookingFindUnique.mockResolvedValueOnce({ clientId: "client-1" });
    mockChargeFindMany.mockResolvedValueOnce(charges);
    const ok = await GET(
      new NextRequest("http://localhost:3000/api/admin/additional-charges?bookingId=booking-1")
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ charges });
    expect(mockChargeFindMany).toHaveBeenCalledWith({
      where: { bookingId: "booking-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  });
});
