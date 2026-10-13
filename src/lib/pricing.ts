/**
 * Système de tarification centralisé.
 *
 * Variables de prix :
 * 1. Type de service (BOARDING, HOUSE_SITTING, DAY_CARE, DROP_IN, DOG_WALKING)
 * 2. Espèce (DOG / CAT)
 * 3. Premier animal vs animal supplémentaire
 * 4. Suppléments centralisés
 * 5. Durée (extra temps pour visites/promenades)
 */

import { isHourlyServiceType, isOvernightServiceType, SERVICE_UNITS } from "@/lib/services";
import { parisAppointment } from "@/lib/booking-dates";
import { isPetUnderOneYearOn } from "@/lib/pets";

// --- GRILLE TARIFAIRE ---

export type Species = "DOG" | "CAT";

interface PriceEntry {
  base: number;           // Premier animal
  additional: number;     // Animal supplémentaire
  durationMinutes?: number;
  durationPrices?: Record<number, number>;
  requestOnly?: boolean;
}

export interface DurationPriceTier {
  label: string;
  maxMinutes: number | null;
  prices: Record<Species, number>;
}

export const LAST_MINUTE_FEE = 10;
export const LAST_MINUTE_LABEL = "Supplément réservation de dernière minute";
export const LAST_MINUTE_DESCRIPTION = "Toutes les prestations : supplément unique de 10 € par réservation demandée moins de 24 h avant son début, quel que soit le nombre d’animaux ou de passages. Aucun supplément à partir de 24 h. Horaires de Paris, sous réserve de disponibilité.";

export function getLastMinuteFee(input: {
  serviceType: string; startDate: string; startTime?: string;
  visitSlots?: { date: string; startTime: string }[];
  requestedAt?: Date;
}) {
  const appointments = isHourlyServiceType(input.serviceType)
    ? (input.visitSlots || []).map(slot => parisAppointment(slot.date, slot.startTime))
    : [parisAppointment(input.startDate, input.startTime)];
  const starts = appointments.flatMap(date => date ? [date.getTime()] : []);
  if (!starts.length || appointments.some(date => !date)) return 0;
  const delay = Math.min(...starts) - (input.requestedAt || new Date()).getTime();
  return delay >= 0 && delay < 24 * 60 * 60 * 1000 ? LAST_MINUTE_FEE : 0;
}

export const DOG_DAY_CARE_RATE = 35;
export const DOG_24_HOUR_RATE = 45;
export const YOUNG_ANIMAL_SURCHARGE = 5;
export const DOG_DAY_CARE_MAX_MINUTES = 10 * 60;
export const DOG_CARE_PERIOD_MINUTES = 24 * 60;
export const LONG_BOARDING_MIN_PERIODS = 14;
export const LONG_BOARDING_DISCOUNT_RATE = 0.1;
export const CAT_VISIT_INCLUDED_CATS = 2;
export const CAT_VISIT_ADDITIONAL_RATE = 3;
export const CAT_VISIT_PRICING_DESCRIPTION = `Visites de chats au même domicile : ${CAT_VISIT_INCLUDED_CATS} chats inclus, puis +${CAT_VISIT_ADDITIONAL_RATE} € par chat supplémentaire et par visite. La durée est commune à tous les chats.`;
export const OTHER_ANIMAL_PRICING_DESCRIPTION = "Pour les autres prestations, chaque animal est facturé au tarif complet. Le supplément de durée d’une visite ou promenade partagée n’est compté qu’une fois.";

export interface DogCareQuote {
  durationMinutes: number;
  priceType: "DAY_CARE" | "24_HOUR_PERIOD";
  periods: number;
  unitPrice: number;
  baseTotal: number;
  isPuppy: boolean;
  puppySurchargePerPeriod: number;
  puppySurchargeTotal: number;
  total: number;
  hasPartialLastPeriod: boolean;
}

export const HOUSE_SITTING_DURATION_TIERS: readonly DurationPriceTier[] = [
  { label: "Jusqu’à 6 h", maxMinutes: 6 * 60, prices: { DOG: 45, CAT: 40 } },
  { label: "Plus de 6 h et jusqu’à 10 h", maxMinutes: 10 * 60, prices: { DOG: 60, CAT: 55 } },
  { label: "Plus de 10 h", maxMinutes: null, prices: { DOG: 80, CAT: 70 } },
] as const;

// Tarifs par service et espèce
const PRICING: Record<string, Record<Species, PriceEntry>> = {
  BOARDING: {
    DOG: { base: DOG_24_HOUR_RATE, additional: DOG_24_HOUR_RATE },
    CAT: { base: 23, additional: 23 },
  },
  HOUSE_SITTING: {
    DOG: { base: 45, additional: 45 },
    CAT: { base: 40, additional: 40 },
  },
  DAY_CARE: {
    DOG: { base: DOG_DAY_CARE_RATE, additional: DOG_DAY_CARE_RATE },
    CAT: { base: 30, additional: 30 },
  },
  DROP_IN: {
    DOG: { base: 16, additional: 16, durationMinutes: 30 },
    CAT: { base: 15, additional: CAT_VISIT_ADDITIONAL_RATE, durationMinutes: 30 },
  },
  DOG_WALKING: {
    DOG: { base: 15, additional: 15, durationMinutes: 30 },
    CAT: { base: 0, additional: 0, durationMinutes: 30, requestOnly: true },
  },
};

const PRICING_ADJUSTMENTS = {
  youngAnimalUnderOneYear: YOUNG_ANIMAL_SURCHARGE,
  longBoarding: {
    minPeriods: LONG_BOARDING_MIN_PERIODS,
    discountRate: LONG_BOARDING_DISCOUNT_RATE,
  },
} as const;

// Extra durée (pour visites et promenades)
export const EXTRA_DURATION = {
  DROP_IN: { baseDuration: 30, extraRate: 8, increment: 30 },
  DOG_WALKING: { baseDuration: 30, extraRate: 7, increment: 30 },
};

export const MAX_VISIT_DURATION_MINUTES = 120;

// --- CALCUL DE PRIX ---

export interface PetPriceInput {
  species: Species;
  isYoung: boolean;       // < 1 an
  isAdditional: boolean;  // 2e animal ou plus du même type
}

export interface PriceLine {
  label: string;
  amount: number;
  type: "base" | "surcharge" | "discount" | "info";
}

export interface PriceRateGroup {
  label: string;
  unitPrice: number;
  quantity: number;
  total: number;
  type: PriceLine["type"];
  dateKeys: string[];
}

function getUnitPrice(
  serviceType: string,
  pet: PetPriceInput,
  durationMinutes?: number,
  catVisitIndex?: number
): { price: number; lines: PriceLine[] } {
  const prices = PRICING[serviceType]?.[pet.species];
  if (!prices || prices.requestOnly) return { price: 0, lines: [{ label: "Sur demande", amount: 0, type: "info" }] };

  const lines: PriceLine[] = [];

  const durationTier = serviceType === "HOUSE_SITTING" && typeof durationMinutes === "number"
    ? getHouseSittingDurationTier(durationMinutes)
    : null;
  let baseLabel = pet.isAdditional ? "Animal supplémentaire" : `Tarif ${pet.species === "CAT" ? "chat" : "chien"}`;
  let price = durationTier
    ? durationTier.prices[pet.species]
    : (pet.isAdditional ? prices.additional : prices.base);
  if (serviceType === "DROP_IN" && pet.species === "CAT" && catVisitIndex !== undefined) {
    price = catVisitIndex === 0 ? prices.base : catVisitIndex < CAT_VISIT_INCLUDED_CATS ? 0 : prices.additional;
    baseLabel = catVisitIndex === 0 ? "Tarif visite chats"
      : catVisitIndex < CAT_VISIT_INCLUDED_CATS ? "Chat inclus dans la visite"
      : "Chat supplémentaire par visite";
  }
  lines.push({
    label: durationTier ? `${baseLabel} · ${durationTier.label}` : baseLabel,
    amount: price,
    type: "base",
  });

  const hasPuppyCareSurcharge = pet.species === "DOG"
    && pet.isYoung
    && (serviceType === "DAY_CARE" || serviceType === "BOARDING");

  if (hasPuppyCareSurcharge) {
    lines.push({
      label: "Supplément chiot (< 1 an)",
      amount: PRICING_ADJUSTMENTS.youngAnimalUnderOneYear,
      type: "surcharge",
    });
    price += PRICING_ADJUSTMENTS.youngAnimalUnderOneYear;
  }

  return { price, lines };
}

export function getServiceDisplayPrice(serviceType: string): {
  dogPrice: number;
  catPrice: number;
  unit: string;
  durationMinutes?: number;
  dogRequestOnly: boolean;
  catRequestOnly: boolean;
} {
  const dog = PRICING[serviceType]?.DOG;
  const cat = PRICING[serviceType]?.CAT;
  return {
    dogPrice: dog?.base || 0,
    catPrice: cat?.base || 0,
    unit: SERVICE_UNITS[serviceType as keyof typeof SERVICE_UNITS] || "unité",
    durationMinutes: dog?.durationMinutes || cat?.durationMinutes,
    dogRequestOnly: Boolean(dog?.requestOnly),
    catRequestOnly: Boolean(cat?.requestOnly),
  };
}

export function getServiceDisplayPriceForDuration(
  serviceType: string,
  species: Species,
  durationMinutes: number
) {
  const price = PRICING[serviceType]?.[species];
  if (!price || price.requestOnly) return null;

  return price.base + getDurationSurcharge(serviceType, species, durationMinutes);
}

function getDurationSurcharge(serviceType: string, species: Species, durationMinutes: number) {
  const price = PRICING[serviceType]?.[species];
  if (!price || price.requestOnly) return 0;

  if (price.durationPrices) {
    const cappedDuration = Math.min(durationMinutes, MAX_VISIT_DURATION_MINUTES);
    const availableDurations = Object.keys(price.durationPrices).map(Number).sort((a, b) => a - b);
    const selectedDuration = availableDurations.find((duration) => duration >= cappedDuration) || availableDurations[availableDurations.length - 1];
    return Math.max(0, (price.durationPrices[selectedDuration] || price.base) - price.base);
  }

  const extra = EXTRA_DURATION[serviceType as keyof typeof EXTRA_DURATION];
  if (!extra) return 0;

  const baseDuration = price.durationMinutes || extra.baseDuration;
  const extraMinutes = Math.max(0, durationMinutes - baseDuration);
  return Math.ceil(extraMinutes / extra.increment) * extra.extraRate;
}

function getSharedDurationSurcharge(serviceType: string, pets: BookingPet[], durationMinutes: number) {
  return pets.reduce((maxExtra, pet) => {
    const extra = getDurationSurcharge(serviceType, pet.species, durationMinutes);
    return Math.max(maxExtra, extra);
  }, 0);
}

type BookingPet = {
  id: string;
  species: Species;
  age?: number | null;
  birthDate?: Date | string | null;
};

type BookingVisitSlot = {
  date: string;
  startTime: string;
  duration: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function calendarDateKeys(startDate: string, endDate: string, inclusiveEnd: boolean) {
  const days: string[] = [];
  const totalDays = calendarDayDifference(startDate, endDate) + (inclusiveEnd ? 1 : 0);
  const start = parseDateKey(startDate);

  for (let index = 0; index < totalDays; index += 1) {
    days.push(toDateKey(addDays(start, index)));
  }

  return days;
}

function calendarDayDifference(startDate: string, endDate: string) {
  return Math.round((parseDateKey(endDate).getTime() - parseDateKey(startDate).getTime()) / DAY_MS);
}

export function calculateServiceDurationMinutes(input: {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
}) {
  if (!input.startDate || !input.endDate || !input.startTime || !input.endTime) return 0;
  return (
    calendarDayDifference(input.startDate, input.endDate) * 24 * 60
    + timeToMinutes(input.endTime)
    - timeToMinutes(input.startTime)
  );
}

/**
 * Quote for one dog using elapsed time, never calendar-day boundaries.
 * A same-day stay of up to 10 hours is day care. Every other stay is billed
 * in started 24-hour periods, so 24 h 01 starts a second period.
 */
export function calculateDogCareQuote(input: {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isPuppy?: boolean;
}): DogCareQuote | null {
  const durationMinutes = calculateServiceDurationMinutes(input);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

  if (input.startDate === input.endDate && durationMinutes <= DOG_DAY_CARE_MAX_MINUTES) {
    const puppySurchargeTotal = input.isPuppy ? YOUNG_ANIMAL_SURCHARGE : 0;
    return {
      durationMinutes,
      priceType: "DAY_CARE",
      periods: 1,
      unitPrice: DOG_DAY_CARE_RATE,
      baseTotal: DOG_DAY_CARE_RATE,
      isPuppy: Boolean(input.isPuppy),
      puppySurchargePerPeriod: YOUNG_ANIMAL_SURCHARGE,
      puppySurchargeTotal,
      total: DOG_DAY_CARE_RATE + puppySurchargeTotal,
      hasPartialLastPeriod: false,
    };
  }

  const periods = Math.ceil(durationMinutes / DOG_CARE_PERIOD_MINUTES);
  const baseTotal = periods * DOG_24_HOUR_RATE;
  const puppySurchargeTotal = input.isPuppy ? periods * YOUNG_ANIMAL_SURCHARGE : 0;
  return {
    durationMinutes,
    priceType: "24_HOUR_PERIOD",
    periods,
    unitPrice: DOG_24_HOUR_RATE,
    baseTotal,
    isPuppy: Boolean(input.isPuppy),
    puppySurchargePerPeriod: YOUNG_ANIMAL_SURCHARGE,
    puppySurchargeTotal,
    total: baseTotal + puppySurchargeTotal,
    hasPartialLastPeriod: durationMinutes % DOG_CARE_PERIOD_MINUTES !== 0,
  };
}

/**
 * Duration of one daytime occurrence. Used by house sitting when a booking
 * repeats the same hours over several calendar days. A zero or negative value
 * deliberately rejects slots that would cross midnight.
 */
export function calculateSameDayDurationMinutes(input: {
  startTime?: string;
  endTime?: string;
}) {
  if (!input.startTime || !input.endTime) return 0;
  const durationMinutes = timeToMinutes(input.endTime) - timeToMinutes(input.startTime);
  return Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0;
}

/**
 * A day-care booking may span several calendar days, but each occurrence uses
 * the same daytime hours and must stay within the 10-hour daily limit.
 */
export function isValidDayCareSchedule(input: {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
}) {
  if (!input.startDate || !input.endDate || calendarDayDifference(input.startDate, input.endDate) < 0) {
    return false;
  }

  const dailyDurationMinutes = calculateSameDayDurationMinutes(input);
  return dailyDurationMinutes > 0 && dailyDurationMinutes <= DOG_DAY_CARE_MAX_MINUTES;
}

export function getHouseSittingDurationTier(durationMinutes: number) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  return HOUSE_SITTING_DURATION_TIERS.find((tier) =>
    tier.maxMinutes === null || durationMinutes <= tier.maxMinutes
  ) || null;
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getRateLabel(lines: PriceLine[]) {
  return lines.map((line) => line.label).join(" + ");
}

function addRateGroup(
  groups: PriceRateGroup[],
  label: string,
  unitPrice: number,
  type: PriceLine["type"] = "base",
  dateKey?: string
) {
  const existing = groups.find((group) => group.label === label && group.unitPrice === unitPrice && group.type === type);
  if (existing) {
    existing.quantity += 1;
    existing.total += unitPrice;
    if (dateKey) existing.dateKeys.push(dateKey);
    return;
  }

  groups.push({
    label,
    unitPrice,
    quantity: 1,
    total: unitPrice,
    type,
    dateKeys: dateKey ? [dateKey] : [],
  });
}

/**
 * Authoritative booking calculation. The API must use this result instead of
 * trusting a total sent by the browser.
 */
export function calculateBookingPrice(input: {
  serviceType: string;
  pets: BookingPet[];
  pricingContextPets?: BookingPet[];
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  visitSlots?: BookingVisitSlot[];
  requestedAt?: Date;
}) {
  const contextPets = input.pricingContextPets?.length ? input.pricingContextPets : input.pets;
  // Only cats actually booked together share the allowance. Client-supplied
  // pricing context may include other pets with separate dates or bookings.
  const sameVisitCats = input.pets.filter((pet) => pet.species === "CAT");
  const hourly = isHourlyServiceType(input.serviceType);
  const slots = input.visitSlots || [];
  const serviceDurationMinutes = input.serviceType === "HOUSE_SITTING"
    ? calculateSameDayDurationMinutes(input)
    : input.serviceType === "BOARDING"
      ? calculateServiceDurationMinutes(input)
      : 0;
  const durationTier = input.serviceType === "HOUSE_SITTING"
    ? getHouseSittingDurationTier(serviceDurationMinutes)
    : null;

  if (input.serviceType === "HOUSE_SITTING" && !durationTier) {
    return { total: 0, quantity: 0, durationExtra: 0, lastMinuteFee: 0, serviceDurationMinutes, durationTier: null, pets: [] };
  }

  if (input.serviceType === "BOARDING" && serviceDurationMinutes <= 0) {
    return { total: 0, quantity: 0, durationExtra: 0, lastMinuteFee: 0, serviceDurationMinutes, durationTier: null, pets: [] };
  }

  let quantity = 0;
  if (hourly) {
    quantity = slots.length;
  } else if (isOvernightServiceType(input.serviceType)) {
    quantity = Math.ceil(serviceDurationMinutes / DOG_CARE_PERIOD_MINUTES);
  } else {
    quantity = calendarDayDifference(input.startDate, input.endDate) + 1;
  }

  let total = 0;
  const pets = input.pets.map((pet) => {
    const sameSpecies = contextPets.filter((candidate) => candidate.species === pet.species);
    const isAdditional = sameSpecies.findIndex((candidate) => candidate.id === pet.id) > 0;
    const petInput = {
      species: pet.species,
      isYoung: pet.birthDate
        ? isPetUnderOneYearOn(pet.birthDate, `${input.startDate}T12:00:00.000Z`)
        : typeof pet.age === "number" && pet.age < 1,
      isAdditional,
    };

    const rateGroups: PriceRateGroup[] = [];

    if (hourly) {
      slots.forEach((slot) => {
        const unit = getUnitPrice(input.serviceType, {
          ...petInput,
        }, serviceDurationMinutes, sameVisitCats.findIndex((candidate) => candidate.id === pet.id));
        addRateGroup(rateGroups, getRateLabel(unit.lines), unit.price, "base", slot.date);
      });
    } else {
      const dateKeys = isOvernightServiceType(input.serviceType)
        ? Array.from({ length: quantity }, (_, index) => toDateKey(addDays(parseDateKey(input.startDate), index)))
        : calendarDateKeys(input.startDate, input.endDate, true);

      dateKeys.forEach((dateKey) => {
        const unit = getUnitPrice(input.serviceType, {
          ...petInput,
        }, serviceDurationMinutes);
        addRateGroup(rateGroups, getRateLabel(unit.lines), unit.price, "base", dateKey);
      });
    }

    let petTotal = rateGroups.reduce((sum, group) => sum + group.total, 0);

    if (
      isOvernightServiceType(input.serviceType) &&
      quantity >= PRICING_ADJUSTMENTS.longBoarding.minPeriods
    ) {
      const discount = Math.round(petTotal * PRICING_ADJUSTMENTS.longBoarding.discountRate * 100) / 100;
      if (discount > 0) {
        petTotal = Math.round((petTotal - discount) * 100) / 100;
        addRateGroup(
          rateGroups,
          `Remise ${PRICING_ADJUSTMENTS.longBoarding.minPeriods} périodes de 24 h et +`,
          -discount,
          "discount"
        );
      }
    }

    total += petTotal;
    const baseGroups = rateGroups.filter((group) => group.type === "base");
    const baseTotal = baseGroups.reduce((sum, group) => sum + group.total, 0);
    const unitPrice = baseGroups.length === 1
      ? baseGroups[0].unitPrice
      : Math.round((baseTotal / Math.max(1, quantity)) * 100) / 100;
    return {
      petId: pet.id,
      unitPrice,
      quantity,
      total: petTotal,
      lines: rateGroups.map((group) => ({
        label: group.label,
        amount: group.total,
        type: group.type,
      })),
      rateGroups,
    };
  });

  let durationExtra = 0;
  if (hourly && input.pets.length > 0) {
    durationExtra = slots.reduce((sum, slot) => {
      return sum + getSharedDurationSurcharge(input.serviceType, input.pets, slot.duration);
    }, 0);
    total += durationExtra;
  }

  const lastMinuteFee = total > 0 ? getLastMinuteFee(input) : 0;
  total += lastMinuteFee;

  return {
    lastMinuteFee,
    total: Math.round(total * 100) / 100,
    quantity,
      durationExtra,
      serviceDurationMinutes,
      durationTier,
      pets,
  };
}
