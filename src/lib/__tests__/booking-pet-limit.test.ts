import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockPetFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPetFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/rate-limit", () => ({
  distributedRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { pet: { findMany: mockPetFindMany } },
}));

import { POST as postBooking } from "@/app/api/bookings/route";
import {
  BOARDING_MAX_PETS,
  BOARDING_MAX_PETS_ERROR,
  getServicePetLimitError,
  SERVICE_TYPES,
} from "@/lib/services";

function futureDate(daysAhead: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function bookingRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const boardingBody = {
  serviceType: "BOARDING",
  startDate: futureDate(10),
  endDate: futureDate(12),
  startTime: "18:00",
  endTime: "10:00",
};

describe("limite d'animaux par service", () => {
  it("limite l'hébergement à un seul animal et laisse les autres services inchangés", () => {
    expect(BOARDING_MAX_PETS).toBe(1);
    expect(getServicePetLimitError("BOARDING", 1)).toBeNull();
    expect(getServicePetLimitError("BOARDING", 2)).toBe(BOARDING_MAX_PETS_ERROR);
    for (const serviceType of SERVICE_TYPES.filter((type) => type !== "BOARDING")) {
      expect(getServicePetLimitError(serviceType, 3)).toBeNull();
    }
  });
});

describe("POST /api/bookings — nombre d'animaux en hébergement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "client-1", email: "client@example.com" } });
    // Aucun animal trouvé : la requête s'arrête juste après le contrôle de propriété.
    mockPetFindMany.mockResolvedValue([]);
  });

  it("refuse deux animaux en hébergement avec un message en français", async () => {
    const response = await postBooking(bookingRequest({ ...boardingBody, petIds: ["pet-1", "pet-2"] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "L'hébergement est limité à un seul animal par nuit." });
    expect(mockPetFindMany).not.toHaveBeenCalled();
  });

  it("refuse aussi une réservation par animal dont le contexte tarifaire compte deux animaux", async () => {
    const response = await postBooking(bookingRequest({
      ...boardingBody,
      petIds: ["pet-1"],
      pricingPetIds: ["pet-1", "pet-2"],
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: BOARDING_MAX_PETS_ERROR });
  });

  it("accepte un seul animal en hébergement (la requête passe au contrôle suivant)", async () => {
    const response = await postBooking(bookingRequest({ ...boardingBody, petIds: ["pet-1"] }));

    expect(mockPetFindMany).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
  });

  it("n'applique pas la limite à la garderie avec plusieurs animaux", async () => {
    const day = futureDate(10);
    const response = await postBooking(bookingRequest({
      serviceType: "DAY_CARE",
      startDate: day,
      endDate: day,
      startTime: "09:00",
      endTime: "17:00",
      petIds: ["pet-1", "pet-2"],
    }));

    expect(mockPetFindMany).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
  });
});
