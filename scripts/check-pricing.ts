import { calculateBookingPrice, calculateDogCareQuote, calculateSameDayDurationMinutes, isValidDayCareSchedule } from "../src/lib/pricing";
import { buildCatVisitQuoteText, calculateCatVisitQuote, getQuoteValidUntil } from "../src/lib/cat-visit-quote";
import {
  calculatePremiumSubscriptionPlan,
  getPremiumCommitmentEnd,
  getPremiumCommitmentMonths,
  STANDARD_FREE_CANCELLATION_HOURS,
} from "../src/lib/subscription-pricing";
import { calculatePawsEarned, calculatePremiumDiscount, LOYALTY_REWARDS } from "../src/lib/loyalty";
import { calculateCouponDiscount } from "../src/lib/coupon-pricing";
import { selectBestBookingDiscount } from "../src/lib/booking-discounts";
import { translateFrenchText } from "../src/lib/i18n";
import {
  addCalendarDays,
  buildDateRange,
  getCalendarDayDifference,
  getInclusiveCalendarDayCount,
  getNextWeekendRange,
  getTodayDateKey,
  isPositiveSameDayTimeRange,
} from "../src/lib/booking-dates";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const dog = { id: "dog-1", species: "DOG" as const, age: 4 };
const secondDog = { id: "dog-2", species: "DOG" as const, age: 3 };
const cat = { id: "cat-1", species: "CAT" as const, age: 2 };
const secondCat = { ...cat, id: "cat-2" };
const thirdCat = { ...cat, id: "cat-3" };
const fourthCat = { ...cat, id: "cat-4" };
const catVisitDates = [17, 19, 22, 24, 26, 29].map((day) => `2026-09-${day}`);
const catVisitInput = {
  catCount: 2, dates: catVisitDates, visitsPerDay: 1, durationMinutes: 30, travelFeePerVisit: 0,
};
const catVisitQuote = calculateCatVisitQuote(catVisitInput);
assert(catVisitQuote?.total === 90 && catVisitQuote.quantity === 6, "Deux chats aux six dates de septembre doivent coûter 90€, sans facturer les jours intermédiaires");
assert(catVisitQuote?.totalMinutes === 180, "La durée de présence doit être de 3 heures pour les deux chats ensemble");
assert(calculateCatVisitQuote({ ...catVisitInput, catCount: 3 })?.total === 108, "Le troisième chat doit ajouter 3€ par passage, soit 108€ pour six visites");
assert(calculateCatVisitQuote({ ...catVisitInput, catCount: 4 })?.total === 126, "Le supplément doit s'appliquer à chaque chat au-delà de deux");
assert(calculateCatVisitQuote({ ...catVisitInput, visitsPerDay: 2 })?.total === 180, "Deux passages par jour doivent compter douze visites pour les six dates");
assert(calculateCatVisitQuote({ ...catVisitInput, durationMinutes: 60 })?.total === 138, "Le supplément de durée doit être partagé par les deux chats : 6 × 23€");
assert(calculateCatVisitQuote({ ...catVisitInput, travelFeePerVisit: 2.5 })?.total === 105, "Les frais de déplacement doivent être appliqués à chaque passage");
assert(calculateCatVisitQuote({ ...catVisitInput, dates: [...catVisitDates].reverse().concat(catVisitDates[0]) })?.total === 90, "Des dates dupliquées ne doivent pas créer de double facturation");
for (const invalidInput of [
  { catCount: 0 }, { catCount: 1.5 }, { catCount: 21 }, { dates: [] },
  { dates: ["2026-02-30"] }, { dates: ["incorrect"] },
  { visitsPerDay: 0 }, { visitsPerDay: 1.5 }, { durationMinutes: 45 },
  { travelFeePerVisit: -1 }, { travelFeePerVisit: Number.NaN },
]) {
  assert(calculateCatVisitQuote({ ...catVisitInput, ...invalidInput }) === null, "Un devis invalide doit être refusé");
}
if (catVisitQuote) {
  const text = buildCatVisitQuoteText(catVisitQuote, { clientName: "Client test", address: "", notes: "", issuedOn: "2026-09-10", reference: "DEV-20260910-EXEMPLE", validUntil: "2026-09-17", petNames: "" });
  assert(catVisitDates.every((date) => text.includes(`${Number(date.slice(-2))} septembre 2026`)), "Le devis doit lister les six dates exactes");
  assert(!text.includes("18 septembre 2026") && text.includes("TOTAL À PAYER : 90"), "Le devis doit afficher le montant calculé et seulement les dates sélectionnées");
  assert(text.includes("À confirmer") && text.includes("Horaires à convenir"), "Le devis ne doit pas inventer une adresse ou un horaire");
  assert(text.includes("PROJET") && text.includes("DEV-20260910-EXEMPLE") && text.includes("Valable jusqu’au 17 septembre 2026"), "Un devis incomplet doit être identifié comme projet et garder sa référence et sa validité");
}
assert(getQuoteValidUntil("2026-09-10", "2026-09-17", 30) === "2026-09-17", "La validité ne doit pas dépasser la première visite");
assert(getQuoteValidUntil("2026-09-10", "2026-10-20", 7) === "2026-09-17", "Une validité courte doit respecter le nombre de jours choisi");

for (const [pets, expected] of [
  [[cat], 15], [[cat, secondCat], 15], [[cat, secondCat, thirdCat], 18],
  [[fourthCat, thirdCat, secondCat, cat], 21], [[dog, cat, secondCat], 31],
] as const) {
  const result = calculateBookingPrice({ serviceType: "DROP_IN", pets: [...pets], startDate: "2026-09-17", endDate: "2026-09-17", visitSlots: [{ date: "2026-09-17", startTime: "09:00", duration: 30 }] });
  assert(result.total === expected, "Le moteur de réservation doit appliquer la grille multi-chats au groupe réellement réservé");
  assert(result.pets.reduce((sum, pet) => sum + pet.total, result.durationExtra) === result.total, "La ventilation par animal doit correspondre au total");
}
assert(calculateBookingPrice({
  serviceType: "DROP_IN", pets: [secondCat], pricingContextPets: [cat, secondCat],
  startDate: "2026-09-17", endDate: "2026-09-17",
  visitSlots: [{ date: "2026-09-17", startTime: "09:00", duration: 30 }],
}).total === 15, "Un chat réservé seul doit payer 15€, même si le contexte client contient un autre chat non réservé");
assert(calculateBookingPrice({
  serviceType: "BOARDING", pets: [cat, secondCat], startDate: "2026-09-17", endDate: "2026-09-18", startTime: "09:00", endTime: "09:00",
}).total === 46, "L'inclusion du deuxième chat ne doit pas s'étendre à l'hébergement");
const visitSlots = [
  { date: "2026-09-10", startTime: "09:00", duration: 30 },
  { date: "2026-09-11", startTime: "18:00", duration: 60 },
];

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    visitSlots,
  }).total === 40,
  "Deux visites de 30 et 60 minutes doivent coûter 40€ pour un chien"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [
      { date: "2026-09-10", startTime: "08:00", duration: 30 },
      { date: "2026-09-10", startTime: "13:00", duration: 30 },
      { date: "2026-09-10", startTime: "19:00", duration: 60 },
    ],
  }).total === 56,
  "Trois passages le même jour doivent inclure chaque passage et le supplément de 60 minutes"
);

assert(
  calculateBookingPrice({
    serviceType: "DOG_WALKING",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [{ date: "2026-09-10", startTime: "09:00", duration: 60 }],
  }).total === 22,
  "Une promenade de 60 minutes doit inclure le supplément de durée"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [cat],
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    startTime: "09:00",
    endTime: "15:00",
  }).total === 69,
  "Un hébergement chat de 54 h doit compter trois périodes de 24 h commencées"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog],
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    visitSlots: [{ date: "2026-07-10", startTime: "09:00", duration: 30 }],
  }).total === 16,
  "Une visite en juillet doit rester au tarif de base"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog],
    startDate: "2026-06-30",
    endDate: "2026-07-01",
    visitSlots: [
      { date: "2026-06-30", startTime: "09:00", duration: 30 },
      { date: "2026-07-01", startTime: "09:00", duration: 30 },
    ],
  }).total === 32,
  "Une visite sur deux jours doit facturer chaque passage au tarif de base"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [dog],
    startDate: "2026-06-30",
    endDate: "2026-07-01",
  }).total === 70,
  "Deux jours de garderie doivent appliquer la nouvelle grille"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [dog],
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    startTime: "08:00",
    endTime: "18:00",
  }).total === 105,
  "Trois jours de garderie doivent être regroupés dans une réservation à 105€"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [{ id: "pricing-simulator-puppy", species: "DOG", birthDate: "2026-03-15T00:00:00.000Z" }],
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    startTime: "08:00",
    endTime: "18:00",
  }).total === 120,
  "Le simulateur doit facturer trois journées chiot à 120€"
);

assert(
  calculateCouponDiscount({
    totalAmount: 105,
    discountType: "PERCENTAGE",
    discountValue: 10,
    quantity: 3,
  }).finalAmount === 94.5,
  "BIENVENUE10 doit s'appliquer au total des trois jours de garderie"
);

assert(
  isValidDayCareSchedule({
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    startTime: "08:00",
    endTime: "18:00",
  }),
  "Une plage de trois garderies de 10 h par jour doit être valide"
);

assert(
  !isValidDayCareSchedule({
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    startTime: "08:00",
    endTime: "18:01",
  }),
  "Une plage de garderie dépassant 10 h par jour doit être refusée"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-06-30",
    endDate: "2026-07-02",
    startTime: "18:00",
    endTime: "18:00",
  }).total === 90,
  "Vendredi 18 h à dimanche 18 h doit compter deux périodes de 24 h"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-08-31",
    endDate: "2026-09-02",
    startTime: "18:00",
    endTime: "18:01",
  }).total === 135,
  "Une minute au-delà de 48 h doit démarrer une troisième période"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [{ id: "puppy-boarding", species: "DOG", birthDate: "2026-01-15T00:00:00.000Z" }],
    startDate: "2026-09-11",
    endDate: "2026-09-12",
    startTime: "18:00",
    endTime: "18:01",
  }).total === 100,
  "Une garde de 24 h 01 pour un chiot doit facturer deux périodes à 50 €"
);

const dogCareQuoteCases = [
  {
    input: { startDate: "2026-09-10", endDate: "2026-09-10", startTime: "08:00", endTime: "18:00" },
    total: 35,
    periods: 1,
    priceType: "DAY_CARE",
    label: "10 h en journée",
  },
  {
    input: { startDate: "2026-09-10", endDate: "2026-09-10", startTime: "08:00", endTime: "18:01" },
    total: 45,
    periods: 1,
    priceType: "24_HOUR_PERIOD",
    label: "10 h 01 sans nuit",
  },
  {
    input: { startDate: "2026-09-11", endDate: "2026-09-12", startTime: "18:00", endTime: "18:00" },
    total: 45,
    periods: 1,
    priceType: "24_HOUR_PERIOD",
    label: "vendredi 18 h à samedi 18 h",
  },
  {
    input: { startDate: "2026-09-11", endDate: "2026-09-12", startTime: "18:00", endTime: "18:01" },
    total: 90,
    periods: 2,
    priceType: "24_HOUR_PERIOD",
    label: "24 h 01",
  },
  {
    input: { startDate: "2026-09-11", endDate: "2026-09-13", startTime: "18:00", endTime: "18:00" },
    total: 90,
    periods: 2,
    priceType: "24_HOUR_PERIOD",
    label: "vendredi 18 h à dimanche 18 h",
  },
] as const;

dogCareQuoteCases.forEach(({ input, total, periods, priceType, label }) => {
  const quote = calculateDogCareQuote(input);
  assert(quote?.total === total, `${label} doit coûter ${total}€`);
  assert(quote?.periods === periods, `${label} doit compter ${periods} période(s)`);
  assert(quote?.priceType === priceType, `${label} doit utiliser la bonne formule`);
});

const puppyDayCareQuote = calculateDogCareQuote({
  startDate: "2026-09-11",
  endDate: "2026-09-11",
  startTime: "08:00",
  endTime: "18:00",
  isPuppy: true,
});
assert(puppyDayCareQuote?.total === 40, "Une journée de 10 h pour un chiot doit coûter 35 € + 5 €");
assert(puppyDayCareQuote?.puppySurchargeTotal === 5, "Le supplément chiot doit être détaillé sur une garde de jour");

const puppyTwoPeriodQuote = calculateDogCareQuote({
  startDate: "2026-09-11",
  endDate: "2026-09-12",
  startTime: "18:00",
  endTime: "18:01",
  isPuppy: true,
});
assert(puppyTwoPeriodQuote?.total === 100, "Une garde de 24 h 01 pour un chiot doit coûter 2 × (45 € + 5 €)");
assert(puppyTwoPeriodQuote?.puppySurchargeTotal === 10, "Le supplément chiot doit s’appliquer à chaque période commencée");

assert(
  calculateDogCareQuote({
    startDate: "2026-09-12",
    endDate: "2026-09-11",
    startTime: "18:00",
    endTime: "18:00",
  }) === null,
  "Une reprise antérieure au dépôt doit être refusée"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog, secondDog],
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    visitSlots,
  }).total === 72,
  "Le supplément de durée ne doit être facturé qu'une fois sur une visite partagée"
);

[
  { duration: 30, dogPrice: 16, catPrice: 15 },
  { duration: 60, dogPrice: 24, catPrice: 23 },
  { duration: 90, dogPrice: 32, catPrice: 31 },
  { duration: 120, dogPrice: 40, catPrice: 39 },
].forEach(({ duration, dogPrice, catPrice }) => {
  assert(
    calculateBookingPrice({
      serviceType: "DROP_IN",
      pets: [dog],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      visitSlots: [{ date: "2026-09-10", startTime: "14:00", duration }],
    }).total === dogPrice,
    `Une visite à domicile de ${duration} min doit coûter ${dogPrice}€ pour un chien`
  );

  assert(
    calculateBookingPrice({
      serviceType: "DROP_IN",
      pets: [cat],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      visitSlots: [{ date: "2026-09-10", startTime: "14:00", duration }],
    }).total === catPrice,
    `Une visite à domicile de ${duration} min doit coûter ${catPrice}€ pour un chat`
  );
});

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
  }).total === 35,
  "Une garderie de jour doit coûter 35€ pour un chien"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [{ id: "puppy-verified", species: "DOG", age: 4, birthDate: "2025-10-01T00:00:00.000Z" }],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
  }).total === 40,
  "La date de naissance doit imposer le supplément chiot même si l'âge déclaratif a été falsifié"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [{ id: "dog-first-birthday", species: "DOG", age: 0.5, birthDate: "2025-09-10T00:00:00.000Z" }],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
  }).total === 35,
  "Le supplément chiot doit cesser le jour du premier anniversaire calculé depuis la date vérifiée"
);

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    startTime: "09:00",
    endTime: "10:00",
  }).total === 45,
  "Une journée de garde au domicile doit coûter 45€ pour un chien"
);

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [dog],
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    startTime: "09:00",
    endTime: "10:00",
  }).total === 45,
  "Une journée de garde au domicile en juillet doit rester au tarif de base"
);

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [cat],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    startTime: "09:00",
    endTime: "18:00",
  }).total === 55,
  "Une garde à domicile de 9h doit coûter 55€ pour un chat"
);

const houseSittingCases = [
  { startTime: "18:00", endTime: "22:30", expected: 45, label: "4h30" },
  { startTime: "09:30", endTime: "19:30", expected: 60, label: "10h" },
  { startTime: "09:30", endTime: "23:30", expected: 80, label: "14h" },
  { startTime: "09:00", endTime: "15:00", expected: 45, label: "exactement 6h" },
  { startTime: "09:00", endTime: "15:01", expected: 60, label: "6h01" },
  { startTime: "09:00", endTime: "19:00", expected: 60, label: "exactement 10h" },
  { startTime: "09:00", endTime: "19:01", expected: 80, label: "10h01" },
] as const;

houseSittingCases.forEach(({ startTime, endTime, expected, label }) => {
  const result = calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    startTime,
    endTime,
  });
  assert(result.total === expected, `Une garde chien de ${label} doit coûter ${expected}€`);
});

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    startTime: "09:30",
    endTime: "19:30",
  }).total === 180,
  "Trois journées Disneyland de 10h doivent coûter 3 × 60€ pour un chien"
);

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [cat],
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    startTime: "18:00",
    endTime: "22:30",
  }).total === 80,
  "Deux soirées de 4h30 doivent coûter 2 × 40€ pour un chat"
);

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    startTime: "18:00",
    endTime: "08:00",
  }).total === 0,
  "Une plage traversant la nuit doit être refusée, même sur plusieurs dates"
);

assert(calculateSameDayDurationMinutes({ startTime: "09:30", endTime: "19:30" }) === 600, "La durée quotidienne doit être calculée sans inclure les jours de la plage");
assert(calculateSameDayDurationMinutes({ startTime: "18:00", endTime: "08:00" }) === 0, "Une nuitée implicite doit être refusée");

assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [cat],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    startTime: "09:30",
    endTime: "23:30",
  }).total === 70,
  "Une garde chat de 14h doit coûter 70€"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [{ id: "puppy-1", species: "DOG" as const, age: 0.5 }],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
  }).total === 40,
  "Un chiot de moins d'un an doit appliquer le supplément de 5€"
);

const youngCat = { id: "kitten-1", species: "CAT" as const, age: 0.5 };
assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [youngCat],
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    startTime: "18:00",
    endTime: "18:00",
  }).total === 23,
  "Un chat de moins d'un an ne doit pas recevoir le supplément chiot"
);
assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [youngCat],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
  }).total === 30,
  "Un chat de moins d'un an doit rester à 30€ en garderie"
);
assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [{ id: "puppy-visit", species: "DOG" as const, age: 0.5 }],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [{ date: "2026-09-10", startTime: "09:00", duration: 30 }],
  }).total === 16,
  "Le supplément chiot ne doit pas s'appliquer aux visites"
);
assert(
  calculateBookingPrice({
    serviceType: "HOUSE_SITTING",
    pets: [{ id: "puppy-home", species: "DOG" as const, age: 0.5 }],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    startTime: "09:00",
    endTime: "15:00",
  }).total === 45,
  "Le supplément chiot ne doit pas s'appliquer à la garde au domicile du client"
);
assert(
  calculateBookingPrice({
    serviceType: "DOG_WALKING",
    pets: [{ id: "puppy-walk", species: "DOG" as const, age: 0.5 }],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [{ date: "2026-09-10", startTime: "09:00", duration: 30 }],
  }).total === 15,
  "Le supplément chiot ne doit pas s'appliquer aux promenades"
);

[
  { duration: 30, expected: 15 },
  { duration: 60, expected: 22 },
  { duration: 90, expected: 29 },
  { duration: 120, expected: 36 },
].forEach(({ duration, expected }) => {
  assert(
    calculateBookingPrice({
      serviceType: "DOG_WALKING",
      pets: [dog],
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      visitSlots: [{ date: "2026-09-10", startTime: "09:00", duration }],
    }).total === expected,
    `Une promenade de ${duration} minutes doit coûter ${expected}€`
  );
});

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    startTime: "10:00",
    endTime: "10:00",
  }).total === 567,
  "Quatorze périodes de 24 h doivent appliquer la remise de 10%"
);

const premiumPlan = calculatePremiumSubscriptionPlan();
assert(premiumPlan.monthlyPrice === 9.99, "Premium doit rester à 9,99€/mois");
assert(premiumPlan.minimumCommitmentMonths === 3, "Premium doit afficher un engagement initial de trois mois");
assert(premiumPlan.minimumCommitmentTotal === 29.97, "Le montant minimum Premium doit être de 29,97€");
assert(premiumPlan.commitmentLabel.includes("3 mois"), "Le délai d'engagement Premium doit être explicite");
assert(premiumPlan.pointsMultiplier === 2, "Premium doit doubler les Pattes");
assert(
  calculatePremiumDiscount(100).finalAmount === 90,
  "Premium doit appliquer 10% de remise"
);
assert(
  calculatePremiumDiscount(300).discountAmount === 20 && calculatePremiumDiscount(300).finalAmount === 280,
  "La remise Premium doit être plafonnée à 20€ par réservation"
);
assert(STANDARD_FREE_CANCELLATION_HOURS === 48, "La fenêtre de remboursement intégral doit rester de 48h pour tous");
assert(getPremiumCommitmentMonths(null) === 1, "Un abonnement historique sans metadata doit conserver un mois d'engagement");
assert(
  getPremiumCommitmentMonths({ minimumCommitmentMonths: "3" }) === 3,
  "Un nouvel abonnement doit relire ses trois mois d'engagement depuis Stripe"
);
assert(
  getPremiumCommitmentEnd(new Date("2027-01-31T10:00:00.000Z"), 1).toISOString() === "2027-02-28T10:00:00.000Z",
  "La fin d'engagement doit gérer les fins de mois sans dériver"
);
assert(calculatePawsEarned(100, false) === 100, "Fidélité gratuite : 1 euro = 1 Patte");
assert(calculatePawsEarned(100, true) === 200, "Premium : 1 euro = 2 Pattes");
assert(
  LOYALTY_REWARDS.find((reward) => reward.threshold === 1500)?.label === "24 euros de réduction",
  "La récompense de 1500 Pattes doit annoncer exactement la réduction réellement créée"
);

const excessiveCoupon = calculateCouponDiscount({
  totalAmount: 100,
  discountType: "FIXED_AMOUNT",
  discountValue: 80,
});
assert(excessiveCoupon.finalAmount === 80, "Un coupon ne doit jamais dépasser 20% de remise");

const customTotalCoupon = calculateCouponDiscount({
  totalAmount: 81,
  discountType: "CUSTOM_TOTAL",
  discountValue: 40,
});
assert(customTotalCoupon.finalAmount === 40, "Un tarif client personnalisé doit fixer le total final");

const welcomeOffer = calculateCouponDiscount({
  totalAmount: 100,
  discountType: "PERCENTAGE",
  discountValue: 10,
});
assert(welcomeOffer.finalAmount === 90, "L'offre de bienvenue doit appliquer 10% de remise");
assert(
  selectBestBookingDiscount({
    originalAmount: 100,
    automaticFinalAmount: 100,
    coupon: { code: "BIENVENUE10", discountType: "PERCENTAGE", finalAmount: welcomeOffer.finalAmount },
    isPremium: true,
  }).source === "PREMIUM",
  "À remise égale, Premium doit être retenu sans consommer le code de bienvenue"
);
assert(
  selectBestBookingDiscount({
    originalAmount: 100,
    automaticFinalAmount: 100,
    coupon: { code: "FIDELITE15", discountType: "FIXED_AMOUNT", finalAmount: 85 },
    isPremium: true,
  }).source === "COUPON",
  "Un coupon plus avantageux que Premium doit être retenu sans cumul"
);
assert(
  selectBestBookingDiscount({
    originalAmount: 630,
    automaticFinalAmount: 567,
    isPremium: true,
  }).source === "AUTOMATIC",
  "La remise long séjour plus avantageuse doit remplacer Premium sans cumul"
);
assert(
  translateFrenchText("Offre de bienvenue", "en") === "Welcome offer",
  "L'offre de bienvenue doit être traduite en anglais"
);
assert(
  translateFrenchText("-10 % sur votre première réservation", "es") === "10 % de descuento en su primera reserva",
  "L'offre de bienvenue doit être traduite en espagnol"
);
assert(
  translateFrenchText("Plus de 10 h", "en") === "Over 10 hours",
  "Les tranches de garde à domicile doivent être traduites en anglais"
);
assert(
  translateFrenchText("Les jours fériés et les demandes de dernière minute ne déclenchent aucune majoration automatique dans le calcul en ligne.", "es")
    === "Los días festivos y las solicitudes de última hora no generan ningún recargo automático en el cálculo en línea.",
  "Les mentions tarifaires doivent être traduites en espagnol"
);
const translatedDynamicRate = translateFrenchText("Tarif public : 45 € / période de 24 h", "en");
assert(
  translatedDynamicRate.includes("24-hour period") && !/hOrr|Orr period|hOurs|hOrrs/.test(translatedDynamicRate),
  "Une traduction tarifaire partielle ne doit jamais retraduire ni déformer le texte anglais inséré"
);
assert(
  translateFrenchText("5 € par jour de garderie ou par période de 24 h commencée en hébergement. Aucun supplément jeune animal pour les chats ni pour les autres services.", "en")
    === "€5 per day of day care or per started 24-hour boarding period. No age-related surcharge applies to cats or any other service.",
  "La règle du supplément chiot doit être claire en anglais"
);
assert(translateFrenchText("Chien :", "es") === "Perro:", "Les libellés d’espèce ne doivent jamais exposer un marqueur technique en espagnol");
assert(
  translateFrenchText("Plusieurs jours peuvent être réservés : chaque journée respecte les mêmes horaires et reste limitée à 10 h.", "en")
    === "Several days can be booked: each day uses the same schedule and remains limited to 10 hours.",
  "La durée maximale de garderie doit rester une durée de 10 heures en anglais"
);

assert(addCalendarDays("2026-12-31", 1) === "2027-01-01", "L’ajout d’un jour doit gérer le changement d’année");
assert(getCalendarDayDifference("2026-09-10", "2026-09-17") === 7, "Une semaine de séjour doit compter sept nuits");
assert(buildDateRange("2026-09-10", "2026-09-12").length === 3, "Une plage de passages doit inclure ses deux bornes");
assert(getInclusiveCalendarDayCount("", "") === 0, "Une plage vide ne doit annoncer aucun jour");
assert(getNextWeekendRange("2026-07-18").startDate === "2026-07-18", "Un samedi doit être reconnu comme le début du week-end courant");
assert(getNextWeekendRange("2026-07-20").startDate === "2026-07-25", "Le prochain samedi doit être proposé en semaine");
assert(getTodayDateKey(new Date("2026-07-17T22:30:00.000Z")) === "2026-07-18", "La date minimale doit suivre le fuseau de Paris");
assert(isPositiveSameDayTimeRange("09:30", "19:30"), "Une plage horaire positive doit être acceptée");
assert(!isPositiveSameDayTimeRange("19:30", "09:30"), "Une fin antérieure doit être refusée pour une prestation à la journée");
assert(translateFrenchText("Planifier le séjour", "en") === "Plan your stay", "Le nouveau sélecteur doit être traduit en anglais");
assert(translateFrenchText("Horaires pratiques", "es") === "Horarios prácticos", "Le nouveau sélecteur doit être traduit en espagnol");
assert(translateFrenchText("Journée Disneyland", "en") === "Disneyland day", "Le raccourci Disneyland doit être traduit en anglais");
assert(translateFrenchText("Disney + soirée", "es") === "Disney + tarde-noche", "Le raccourci Disney avec soirée doit être traduit en espagnol");
assert(translateFrenchText("Aucune nuitée incluse.", "en") === "No overnight stay included.", "L’interdiction des nuitées doit être traduite en anglais");

console.log("OK - tarifs de réservation, coupons, fidélité et Premium cohérents");
