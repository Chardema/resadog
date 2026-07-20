import { calculateBookingPrice, calculateSameDayDurationMinutes } from "../src/lib/pricing";
import { calculatePremiumSubscriptionPlan } from "../src/lib/subscription-pricing";
import { calculatePawsEarned, calculatePremiumDiscount } from "../src/lib/loyalty";
import { calculateCouponDiscount } from "../src/lib/coupon-pricing";
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
  }).total === 51,
  "Deux visites de 30 et 60 minutes doivent coûter 51€ pour un chien"
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
  }).total === 67,
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
    endTime: "15:00",
  }).total === 58,
  "Un hébergement chat de deux nuits avec départ après 12h doit inclure une demi-journée"
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
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-06-30",
    endDate: "2026-07-02",
    endTime: "10:00",
  }).total === 56,
  "Deux nuits d'hébergement chien doivent appliquer la nouvelle grille"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-08-31",
    endDate: "2026-09-02",
    endTime: "15:00",
  }).total === 70,
  "La demi-journée de départ doit utiliser le tarif du jour de départ"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog, secondDog],
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    visitSlots,
  }).total === 83,
  "Le supplément de durée ne doit être facturé qu'une fois sur une visite partagée"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [{ date: "2026-09-10", startTime: "14:00", duration: 120 }],
  }).total === 35,
  "Une visite à domicile de 2h doit coûter 35€ pour un chien"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [cat],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [{ date: "2026-09-10", startTime: "14:00", duration: 120 }],
  }).total === 30,
  "Une visite à domicile jusqu'à 2h doit coûter 30€ pour un chat"
);

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

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    endTime: "10:00",
  }).total === 352.8,
  "Quatorze nuits d'hébergement doivent appliquer la remise de 10%"
);

const premiumPlan = calculatePremiumSubscriptionPlan();
assert(premiumPlan.monthlyPrice === 9.99, "Premium doit rester à 9,99€/mois");
assert(premiumPlan.pointsMultiplier === 2, "Premium doit doubler les Pattes");
assert(
  calculatePremiumDiscount(100).finalAmount === 90,
  "Premium doit appliquer 10% de remise"
);
assert(calculatePawsEarned(100, false) === 100, "Fidélité gratuite : 1 euro = 1 Patte");
assert(calculatePawsEarned(100, true) === 200, "Premium : 1 euro = 2 Pattes");

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
  calculatePremiumDiscount(welcomeOffer.finalAmount).finalAmount === 81,
  "L'offre de bienvenue et Premium doivent se cumuler en appliquant 19% de remise effective"
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
  translateFrenchText("Un supplément peut être appliqué les jours fériés et pour les demandes de dernière minute.", "es")
    === "Puede aplicarse un suplemento los días festivos y para las solicitudes de última hora.",
  "Les mentions tarifaires doivent être traduites en espagnol"
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
