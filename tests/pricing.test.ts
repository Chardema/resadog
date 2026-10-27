import { describe, expect, it } from "vitest";
import {
  LAST_MINUTE_FEE,
  calculateBookingPrice,
  calculateDogCareQuote,
  getHouseSittingDurationTier,
  getLastMinuteFee,
  getServiceDisplayPrice,
  getServiceDisplayPriceForDuration,
  isValidDayCareSchedule,
} from "@/lib/pricing";

// Demande faite bien avant les dates de test : aucun supplément dernière minute.
const requestedAt = new Date("2026-01-01T00:00:00.000Z");

const dog = { id: "dog-1", species: "DOG" as const, age: 4 };
const puppy = { id: "dog-2", species: "DOG" as const, age: 0.5 };
const cat = { id: "cat-1", species: "CAT" as const, age: 2 };
const secondCat = { ...cat, id: "cat-2" };
const thirdCat = { ...cat, id: "cat-3" };

describe("calculateDogCareQuote", () => {
  it("facture une garderie jusqu'à 10 h le même jour", () => {
    const quote = calculateDogCareQuote({
      startDate: "2026-03-10", endDate: "2026-03-10", startTime: "08:00", endTime: "18:00",
    });
    expect(quote).toMatchObject({ priceType: "DAY_CARE", periods: 1, total: 35 });
  });

  it("ajoute le supplément chiot", () => {
    const quote = calculateDogCareQuote({
      startDate: "2026-03-10", endDate: "2026-03-10", startTime: "08:00", endTime: "18:00", isPuppy: true,
    });
    expect(quote?.total).toBe(40);
  });

  it("passe en période de 24 h au-delà de 10 h", () => {
    const quote = calculateDogCareQuote({
      startDate: "2026-03-10", endDate: "2026-03-10", startTime: "08:00", endTime: "18:01",
    });
    expect(quote).toMatchObject({ priceType: "24_HOUR_PERIOD", periods: 1, total: 45 });
  });

  it("entame une deuxième période à 24 h 01", () => {
    const quote = calculateDogCareQuote({
      startDate: "2026-03-10", endDate: "2026-03-11", startTime: "10:00", endTime: "10:01",
    });
    expect(quote).toMatchObject({ periods: 2, total: 90, hasPartialLastPeriod: true });
  });

  it("refuse une durée nulle ou négative", () => {
    expect(calculateDogCareQuote({
      startDate: "2026-03-10", endDate: "2026-03-10", startTime: "10:00", endTime: "10:00",
    })).toBeNull();
    expect(calculateDogCareQuote({
      startDate: "2026-03-11", endDate: "2026-03-10", startTime: "10:00", endTime: "10:00",
    })).toBeNull();
  });
});

describe("calculateBookingPrice", () => {
  it("facture l'hébergement par période de 24 h entamée", () => {
    const price = calculateBookingPrice({
      serviceType: "BOARDING", pets: [dog], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-12", startTime: "10:00", endTime: "10:00",
    });
    expect(price).toMatchObject({ total: 90, quantity: 2, lastMinuteFee: 0 });
  });

  it("applique le supplément chiot à chaque période d'hébergement", () => {
    const price = calculateBookingPrice({
      serviceType: "BOARDING", pets: [puppy], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-11", startTime: "10:00", endTime: "10:00",
    });
    expect(price.total).toBe(50);
  });

  it("applique la remise long séjour à partir de 14 périodes", () => {
    const price = calculateBookingPrice({
      serviceType: "BOARDING", pets: [dog], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-24", startTime: "10:00", endTime: "10:00",
    });
    expect(price.quantity).toBe(14);
    expect(price.total).toBe(567);
  });

  it("renvoie un total nul pour un hébergement sans horaires", () => {
    const price = calculateBookingPrice({
      serviceType: "BOARDING", pets: [dog], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-12",
    });
    expect(price).toMatchObject({ total: 0, quantity: 0 });
  });

  it("facture la garderie par jour calendaire", () => {
    const price = calculateBookingPrice({
      serviceType: "DAY_CARE", pets: [dog], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-12", startTime: "08:00", endTime: "18:00",
    });
    expect(price).toMatchObject({ total: 105, quantity: 3 });
  });

  it("inclut deux chats dans une visite puis facture les suivants", () => {
    const visitSlots = [{ date: "2026-03-10", startTime: "10:00", duration: 30 }];
    const base = {
      serviceType: "DROP_IN", requestedAt, startDate: "2026-03-10", endDate: "2026-03-10", visitSlots,
    };
    expect(calculateBookingPrice({ ...base, pets: [cat, secondCat] }).total).toBe(15);
    expect(calculateBookingPrice({ ...base, pets: [cat, secondCat, thirdCat] }).total).toBe(18);
  });

  it("ne compte qu'une fois le supplément de durée d'une visite partagée", () => {
    const price = calculateBookingPrice({
      serviceType: "DROP_IN", pets: [cat, secondCat], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-10",
      visitSlots: [{ date: "2026-03-10", startTime: "10:00", duration: 60 }],
    });
    expect(price).toMatchObject({ total: 23, durationExtra: 8 });
  });

  it("facture la promenade avec son supplément de durée", () => {
    const price = calculateBookingPrice({
      serviceType: "DOG_WALKING", pets: [dog], requestedAt,
      startDate: "2026-03-10", endDate: "2026-03-10",
      visitSlots: [{ date: "2026-03-10", startTime: "10:00", duration: 60 }],
    });
    expect(price).toMatchObject({ total: 22, quantity: 1 });
  });

  it("applique les paliers de durée de la garde à domicile", () => {
    const base = {
      serviceType: "HOUSE_SITTING", requestedAt, startDate: "2026-03-10", endDate: "2026-03-10",
    };
    expect(calculateBookingPrice({ ...base, pets: [dog], startTime: "09:00", endTime: "15:00" }).total).toBe(45);
    expect(calculateBookingPrice({ ...base, pets: [dog], startTime: "09:00", endTime: "17:00" }).total).toBe(60);
    expect(calculateBookingPrice({ ...base, pets: [cat], startTime: "08:00", endTime: "19:00" }).total).toBe(70);
    expect(calculateBookingPrice({ ...base, pets: [dog] }).total).toBe(0);
  });

  it("ajoute le supplément dernière minute une seule fois", () => {
    const price = calculateBookingPrice({
      serviceType: "BOARDING", pets: [dog],
      startDate: "2026-03-10", endDate: "2026-03-11", startTime: "10:00", endTime: "10:00",
      requestedAt: new Date("2026-03-09T20:00:00.000Z"),
    });
    expect(price).toMatchObject({ total: 55, lastMinuteFee: LAST_MINUTE_FEE });
  });
});

describe("getLastMinuteFee", () => {
  // 10:00 à Paris le 10 mars 2026 (heure d'hiver) = 09:00 UTC.
  const booking = { serviceType: "BOARDING", startDate: "2026-03-10", startTime: "10:00" };

  it("s'applique à moins de 24 h du début", () => {
    expect(getLastMinuteFee({ ...booking, requestedAt: new Date("2026-03-09T09:00:01.000Z") })).toBe(LAST_MINUTE_FEE);
  });

  it("ne s'applique pas à 24 h ou plus", () => {
    expect(getLastMinuteFee({ ...booking, requestedAt: new Date("2026-03-09T09:00:00.000Z") })).toBe(0);
  });

  it("ne s'applique pas à une prestation déjà commencée", () => {
    expect(getLastMinuteFee({ ...booking, requestedAt: new Date("2026-03-10T09:00:01.000Z") })).toBe(0);
  });
});

describe("paliers et affichage", () => {
  it("choisit le palier de garde à domicile aux bornes", () => {
    expect(getHouseSittingDurationTier(0)).toBeNull();
    expect(getHouseSittingDurationTier(360)?.prices.DOG).toBe(45);
    expect(getHouseSittingDurationTier(361)?.prices.DOG).toBe(60);
    expect(getHouseSittingDurationTier(601)?.prices.DOG).toBe(80);
  });

  it("valide les horaires de garderie", () => {
    const days = { startDate: "2026-03-10", endDate: "2026-03-12" };
    expect(isValidDayCareSchedule({ ...days, startTime: "08:00", endTime: "18:00" })).toBe(true);
    expect(isValidDayCareSchedule({ ...days, startTime: "08:00", endTime: "18:30" })).toBe(false);
    expect(isValidDayCareSchedule({
      startDate: "2026-03-12", endDate: "2026-03-10", startTime: "08:00", endTime: "18:00",
    })).toBe(false);
  });

  it("expose les tarifs affichés", () => {
    expect(getServiceDisplayPrice("BOARDING")).toMatchObject({ dogPrice: 45, catPrice: 23 });
    expect(getServiceDisplayPrice("DOG_WALKING").catRequestOnly).toBe(true);
    expect(getServiceDisplayPriceForDuration("DROP_IN", "CAT", 60)).toBe(23);
    expect(getServiceDisplayPriceForDuration("DOG_WALKING", "CAT", 30)).toBeNull();
  });
});
