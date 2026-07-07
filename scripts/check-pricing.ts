import { calculateBookingPrice } from "../src/lib/pricing";
import {
  calculateSubscriptionPlan,
  SUBSCRIPTION_SERVICES,
  type SubscriptionBillingCycle,
  type SubscriptionServiceType,
} from "../src/lib/subscription-pricing";
import { calculateCouponDiscount } from "../src/lib/coupon-pricing";

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
  }).total === 39,
  "Deux visites de 30 et 60 minutes doivent coûter 39€ pour un chien"
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
  }).total === 54,
  "Trois passages le même jour doivent inclure chaque passage et le supplément de 60 minutes"
);

assert(
  calculateBookingPrice({
    serviceType: "DOG_WALKING",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    visitSlots: [{ date: "2026-09-10", startTime: "09:00", duration: 60 }],
  }).total === 19,
  "Une promenade de 60 minutes doit inclure le supplément de durée"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [cat],
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    endTime: "15:00",
  }).total === 50,
  "Un hébergement chat de deux nuits avec départ après 12h doit inclure une demi-journée"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog],
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    visitSlots: [{ date: "2026-07-10", startTime: "09:00", duration: 30 }],
  }).total === 18,
  "Une visite en haute saison doit appliquer le tarif haute saison"
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
  }).total === 33,
  "Une visite à cheval normal/haute saison doit facturer chaque passage à son tarif"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [dog],
    startDate: "2026-06-30",
    endDate: "2026-07-01",
  }).total === 55,
  "Une garderie à cheval normal/haute saison doit facturer chaque jour à son tarif"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-06-30",
    endDate: "2026-07-02",
    endTime: "10:00",
  }).total === 53,
  "Un hébergement à cheval normal/haute saison doit facturer chaque nuit à son tarif"
);

assert(
  calculateBookingPrice({
    serviceType: "BOARDING",
    pets: [dog],
    startDate: "2026-08-31",
    endDate: "2026-09-02",
    endTime: "15:00",
  }).total === 65,
  "La demi-journée de départ doit utiliser le tarif du jour de départ"
);

assert(
  calculateBookingPrice({
    serviceType: "DROP_IN",
    pets: [dog, secondDog],
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    visitSlots,
  }).total === 59,
  "Le supplément de durée ne doit être facturé qu'une fois sur une visite partagée"
);

assert(
  calculateBookingPrice({
    serviceType: "DAY_CARE",
    pets: [dog],
    startDate: "2026-09-10",
    endDate: "2026-09-12",
  }).total === 75,
  "Trois jours de garderie doivent coûter 75€"
);

const services = Object.keys(SUBSCRIPTION_SERVICES) as SubscriptionServiceType[];
const cycles: SubscriptionBillingCycle[] = ["MONTHLY", "YEARLY"];

for (const serviceType of services) {
  for (const billingCycle of cycles) {
    for (let daysPerWeek = 1; daysPerWeek <= 5; daysPerWeek += 1) {
      for (let petCount = 1; petCount <= 3; petCount += 1) {
        const plan = calculateSubscriptionPlan({ serviceType, billingCycle, daysPerWeek, petCount });
        assert(
          plan.effectiveCreditPrice + 0.001 >= plan.service.minimumCreditPrice,
          `${serviceType}: prix par crédit sous le plancher`
        );
        assert(
          plan.effectiveDiscount <= 0.2001,
          `${serviceType}: remise réelle supérieure à 20%`
        );
      }
    }
  }
}

const excessiveCoupon = calculateCouponDiscount({
  totalAmount: 100,
  discountType: "FIXED_AMOUNT",
  discountValue: 80,
});
assert(excessiveCoupon.finalAmount === 80, "Un coupon ne doit jamais dépasser 20% de remise");

console.log("OK - tarifs de réservation et planchers d'abonnement cohérents");
