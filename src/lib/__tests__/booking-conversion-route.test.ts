import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockBookingFindUnique } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockBookingFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    booking: {
      findUnique: mockBookingFindUnique,
    },
  },
}));

import { GET as getBookingConversion } from "@/app/api/bookings/[bookingId]/conversion/route";
import {
  getBookingConversionValue,
  isBookingPaidForConversion,
  type BookingConversionCandidate,
} from "@/lib/booking-conversion";

function booking(
  overrides: Partial<BookingConversionCandidate> & { clientId?: string } = {}
) {
  return {
    clientId: "user-1",
    totalPrice: 120,
    depositPaid: false,
    payment: { status: "PROCESSING", stripePaymentId: "pi_123", amount: 120 },
    ...overrides,
  };
}

async function callRoute(bookingId = "booking-1") {
  const request = new NextRequest(`http://localhost/api/bookings/${bookingId}/conversion`);
  return getBookingConversion(request, { params: Promise.resolve({ bookingId }) });
}

describe("GET /api/bookings/[bookingId]/conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("renvoie 401 sans session et n'interroge pas la base", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await callRoute();
    expect(response.status).toBe(401);
    expect(mockBookingFindUnique).not.toHaveBeenCalled();
  });

  it("renvoie 404 si la réservation n'existe pas", async () => {
    mockBookingFindUnique.mockResolvedValue(null);
    const response = await callRoute("missing");
    expect(response.status).toBe(404);
  });

  it("renvoie 403 si la réservation appartient à un autre client", async () => {
    mockBookingFindUnique.mockResolvedValue(booking({ clientId: "user-2" }));
    const response = await callRoute();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Non autorisé" });
  });

  it("renvoie 409 si la réservation n'est pas payée", async () => {
    mockBookingFindUnique.mockResolvedValue(
      booking({ payment: { status: "PENDING", stripePaymentId: null, amount: 120 } })
    );
    const response = await callRoute();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ paid: false });
  });

  it("valide une empreinte Stripe posée et renvoie la valeur de la base", async () => {
    mockBookingFindUnique.mockResolvedValue(booking({ totalPrice: 87.5 }));
    const response = await callRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      paid: true,
      bookingId: "booking-1",
      value: 87.5,
      currency: "EUR",
    });
    expect(mockBookingFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "booking-1" } })
    );
  });

  it("valide une réservation dont l'acompte est réglé", async () => {
    mockBookingFindUnique.mockResolvedValue(booking({ depositPaid: true, payment: null }));
    const response = await callRoute();
    expect(response.status).toBe(200);
  });

  it("renvoie 500 sans détail si la base échoue", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBookingFindUnique.mockRejectedValue(new Error("db down"));
    const response = await callRoute();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Erreur serveur" });
    consoleError.mockRestore();
  });
});

describe("isBookingPaidForConversion", () => {
  const payment = (status: string, stripePaymentId: string | null = null) =>
    ({ status, stripePaymentId, amount: 50 }) as BookingConversionCandidate["payment"];

  const paidCases: Array<[string, string | null]> = [
    ["SUCCEEDED", null],
    ["PARTIALLY_REFUNDED", null],
    ["PROCESSING", "pi_123"],
  ];
  const unpaidCases: Array<[string, string | null]> = [
    ["PROCESSING", null],
    ["PROCESSING", "  "],
    ["PENDING", null],
    ["FAILED", "pi_123"],
    ["REFUNDED", "pi_123"],
  ];

  it.each(paidCases)("accepte %s (stripePaymentId=%s)", (status, stripePaymentId) => {
    expect(
      isBookingPaidForConversion({ totalPrice: 50, depositPaid: false, payment: payment(status, stripePaymentId) })
    ).toBe(true);
  });

  it("accepte un acompte réglé quel que soit le statut du paiement", () => {
    expect(
      isBookingPaidForConversion({ totalPrice: 50, depositPaid: true, payment: payment("REFUNDED") })
    ).toBe(true);
  });

  it.each(unpaidCases)("refuse %s (stripePaymentId=%s) sans acompte", (status, stripePaymentId) => {
    expect(
      isBookingPaidForConversion({ totalPrice: 50, depositPaid: false, payment: payment(status, stripePaymentId) })
    ).toBe(false);
  });

  it("refuse une réservation sans paiement ni acompte", () => {
    expect(isBookingPaidForConversion({ totalPrice: 50, depositPaid: false, payment: null })).toBe(false);
  });
});

describe("getBookingConversionValue", () => {
  it("utilise totalPrice, puis payment.amount à défaut", () => {
    expect(getBookingConversionValue({ totalPrice: 72.456, depositPaid: false, payment: null })).toBe(72.46);
    expect(
      getBookingConversionValue({
        totalPrice: 0,
        depositPaid: true,
        payment: { status: "SUCCEEDED", stripePaymentId: "pi_1", amount: 40 },
      })
    ).toBe(40);
    expect(getBookingConversionValue({ totalPrice: 0, depositPaid: true, payment: null })).toBeNull();
  });
});
