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
import { calculateDirectPrice, directBookingSchema } from "@/lib/direct-booking";
import { translateFrenchText } from "@/lib/i18n";
import {
  calculateBookingPrice,
  calculateDogCareQuote,
  EXTENDED_DAY_CARE_NOTICE,
  isValidDayCareSchedule,
  LAST_MINUTE_FEE,
} from "@/lib/pricing";
import { getServicePetLimitError } from "@/lib/services";

const adultDog = { id: "dog-1", species: "DOG" as const, birthDate: "2020-05-10T00:00:00.000Z" };
const puppy = { id: "puppy-1", species: "DOG" as const, birthDate: "2026-09-01T00:00:00.000Z" };
const adultCat = { id: "cat-1", species: "CAT" as const, birthDate: "2020-05-10T00:00:00.000Z" };
// Demande faite bien avant la garde : pas de supplément de dernière minute.
const requestedAt = new Date("2026-11-27T12:00:00.000Z");

const longDay = { startDate: "2027-01-06", endDate: "2027-01-06", startTime: "09:00", endTime: "21:45" };
const standardDay = { ...longDay, endTime: "17:00" };

function dayCarePrice(pets: Parameters<typeof calculateBookingPrice>[0]["pets"], schedule = longDay, at = requestedAt) {
  return calculateBookingPrice({ serviceType: "DAY_CARE", pets, ...schedule, requestedAt: at });
}

describe("garderie de plus de 10 h le même jour", () => {
  it("accepte une journée de 9 h à 21 h 45 sans la transformer en nuit", () => {
    expect(isValidDayCareSchedule(longDay)).toBe(true);
    const price = dayCarePrice([adultDog]);
    expect(price.quantity).toBe(1);
    expect(price.serviceDurationMinutes).toBe(12 * 60 + 45);
  });

  it("facture 9 h – 21 h 45 au tarif 24 h pour un chien adulte (45 €)", () => {
    const price = dayCarePrice([adultDog]);
    expect(price.total).toBe(45);
    expect(price.lastMinuteFee).toBe(0);
    expect(price.pets[0].lines[0].label).toContain("tarif 24 h");
    // Même résultat que la règle chien centralisée.
    expect(calculateDogCareQuote(longDay)?.total).toBe(45);
  });

  it("garde 35 € pour une journée de 9 h à 17 h", () => {
    expect(dayCarePrice([adultDog], standardDay).total).toBe(35);
    expect(dayCarePrice([adultDog], { ...longDay, startTime: "08:00", endTime: "18:00" }).total).toBe(35);
  });

  it("ajoute le supplément chiot de 5 € au tarif 24 h (50 €)", () => {
    expect(dayCarePrice([puppy]).total).toBe(50);
    expect(calculateDogCareQuote({ ...longDay, isPuppy: true })?.total).toBe(50);
  });

  it("applique le tarif 24 h chat (35 €) au-delà de 10 h et 30 € en deçà", () => {
    expect(dayCarePrice([adultCat]).total).toBe(35);
    expect(dayCarePrice([adultCat]).pets[0].lines[0].label).toContain("tarif 24 h");
    expect(dayCarePrice([adultCat], standardDay).total).toBe(30);
  });

  it("annonce 45 € pour un chien et 35 € pour un chat au-delà de 10 h, en FR, EN et ES", () => {
    expect(EXTENDED_DAY_CARE_NOTICE).toBe("Au-delà de 10 h le même jour, la journée passe au tarif 24 h : 45 € pour un chien, 35 € pour un chat.");
    expect(translateFrenchText(EXTENDED_DAY_CARE_NOTICE, "en")).toBe("Beyond 10 hours on the same day, the day is billed at the 24-hour rate: €45 for a dog, €35 for a cat.");
    expect(translateFrenchText(EXTENDED_DAY_CARE_NOTICE, "es")).toBe("Más allá de 10 h el mismo día, la jornada pasa a la tarifa de 24 h: 45 € para un perro, 35 € para un gato.");
  });

  it("garde la majoration de dernière minute inchangée (+10 €)", () => {
    const price = dayCarePrice([adultDog], longDay, new Date("2027-01-05T20:00:00.000Z"));
    expect(price.lastMinuteFee).toBe(LAST_MINUTE_FEE);
    expect(price.total).toBe(45 + LAST_MINUTE_FEE);
  });

  it("facture chaque journée de plus de 10 h au tarif 24 h sur plusieurs dates", () => {
    const price = dayCarePrice([adultDog], { ...longDay, endDate: "2027-01-08" });
    expect(price.quantity).toBe(3);
    expect(price.total).toBe(135);
    expect(dayCarePrice([adultDog], { ...standardDay, endDate: "2027-01-08" }).total).toBe(105);
  });

  it("ne compte pas comme une nuit : pas de limite d'un animal", () => {
    expect(getServicePetLimitError("DAY_CARE", 2)).toBeNull();
    expect(dayCarePrice([adultDog, { ...adultDog, id: "dog-2" }]).total).toBe(90);
  });

  it("refuse toujours une fin avant le début", () => {
    expect(isValidDayCareSchedule({ ...longDay, startTime: "21:45", endTime: "09:00" })).toBe(false);
  });

  it("accepte aussi la journée longue en création admin", () => {
    // La création admin refuse les dates passées : on utilise une date future.
    const day = futureDate(30);
    const parsed = directBookingSchema.safeParse({
      requestId: "bff3cbf5-5c51-4b68-840c-63dc5d7f536a",
      clientId: "client-1",
      petIds: ["dog-1"],
      serviceType: "DAY_CARE",
      ...longDay,
      startDate: day,
      endDate: day,
      agreementEvidence: "Accord du client par téléphone le 27/11",
      paymentMethod: "DIRECT_CASH",
      paid: false,
      expectedTotal: 45,
    });
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    expect(calculateDirectPrice({ serviceType: "DAY_CARE", ...longDay }, [adultDog], requestedAt).total).toBe(45);
  });
});

describe("pension multi-nuits", () => {
  it("facture 2 nuits (48 h) à 2 × 45 € pour un chien, 2 × 35 € pour un chat, et 24 h 01 à 2 périodes", () => {
    const base = { serviceType: "BOARDING", pets: [adultDog], startTime: "18:00", requestedAt };
    expect(calculateBookingPrice({ ...base, startDate: "2027-01-06", endDate: "2027-01-08", endTime: "18:00" }).total).toBe(90);
    expect(calculateBookingPrice({ ...base, startDate: "2027-01-06", endDate: "2027-01-07", endTime: "18:01" }).total).toBe(90);
    expect(calculateBookingPrice({ ...base, pets: [adultCat], startDate: "2027-01-06", endDate: "2027-01-08", endTime: "18:00" }).total).toBe(70);
    expect(getServicePetLimitError("BOARDING", 2)).not.toBeNull();
  });
});

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

describe("POST /api/bookings — garderie de plus de 10 h", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "client-1", email: "client@example.com" } });
    // Aucun animal trouvé : la requête s'arrête juste après le contrôle de propriété.
    mockPetFindMany.mockResolvedValue([]);
  });

  it("accepte 9 h – 21 h 45 le même jour et poursuit jusqu'au contrôle des animaux", async () => {
    const day = futureDate(20);
    const response = await postBooking(bookingRequest({
      serviceType: "DAY_CARE",
      petIds: ["pet-1"],
      startDate: day,
      endDate: day,
      startTime: "09:00",
      endTime: "21:45",
    }));

    // La validation des horaires est passée : seul le contrôle des animaux (mocké vide) répond.
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Certains animaux n'existent pas ou ne vous appartiennent pas" });
    expect(mockPetFindMany).toHaveBeenCalled();
  });

  it("refuse une garderie dont la fin précède le début", async () => {
    const day = futureDate(20);
    const response = await postBooking(bookingRequest({
      serviceType: "DAY_CARE",
      petIds: ["pet-1"],
      startDate: day,
      endDate: day,
      startTime: "21:45",
      endTime: "09:00",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "La garderie doit se terminer le même jour, avec une heure de fin après l’heure de début",
    });
    expect(mockPetFindMany).not.toHaveBeenCalled();
  });
});
