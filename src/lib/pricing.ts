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

export const HOUSE_SITTING_DURATION_TIERS: readonly DurationPriceTier[] = [
  { label: "Jusqu’à 6 h", maxMinutes: 6 * 60, prices: { DOG: 45, CAT: 40 } },
  { label: "De 6 h à 10 h", maxMinutes: 10 * 60, prices: { DOG: 60, CAT: 55 } },
  { label: "Plus de 10 h", maxMinutes: null, prices: { DOG: 80, CAT: 70 } },
] as const;

// Tarifs par service et espèce
const PRICING: Record<string, Record<Species, PriceEntry>> = {
  BOARDING: {
    DOG: { base: 28, additional: 28 },
    CAT: { base: 23, additional: 23 },
  },
  HOUSE_SITTING: {
    DOG: { base: 45, additional: 45 },
    CAT: { base: 40, additional: 40 },
  },
  DAY_CARE: {
    DOG: { base: 35, additional: 35 },
    CAT: { base: 30, additional: 30 },
  },
  DROP_IN: {
    DOG: { base: 16, additional: 16, durationMinutes: 30, durationPrices: { 30: 16, 60: 35, 90: 35, 120: 35 } },
    CAT: { base: 15, additional: 15, durationMinutes: 30, durationPrices: { 30: 15, 60: 30, 90: 30, 120: 30 } },
  },
  DOG_WALKING: {
    DOG: { base: 15, additional: 15, durationMinutes: 30 },
    CAT: { base: 0, additional: 0, durationMinutes: 30, requestOnly: true },
  },
};

const PRICING_ADJUSTMENTS = {
  youngAnimalUnderOneYear: 5,
  medication: 4,
  publicHoliday: 5,
  lastMinuteUnder24h: 8,
  secondWalkSameDay: 5,
  longBoarding: {
    minNights: 14,
    discountRate: 0.1,
  },
} as const;

// Extra durée (pour visites et promenades)
export const EXTRA_DURATION = {
  DROP_IN: { baseDuration: 30, extraRate: 9, increment: 30 },
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
  durationMinutes?: number
): { price: number; lines: PriceLine[] } {
  const prices = PRICING[serviceType]?.[pet.species];
  if (!prices || prices.requestOnly) return { price: 0, lines: [{ label: "Sur demande", amount: 0, type: "info" }] };

  const lines: PriceLine[] = [];

  const durationTier = serviceType === "HOUSE_SITTING" && typeof durationMinutes === "number"
    ? getHouseSittingDurationTier(durationMinutes)
    : null;
  const baseLabel = pet.isAdditional ? "Animal supplémentaire" : `Tarif ${pet.species === "CAT" ? "chat" : "chien"}`;
  let price = durationTier
    ? durationTier.prices[pet.species]
    : (pet.isAdditional ? prices.additional : prices.base);
  lines.push({
    label: durationTier ? `${baseLabel} · ${durationTier.label}` : baseLabel,
    amount: price,
    type: "base",
  });

  if (pet.isYoung) {
    lines.push({
      label: "Supplément chiot/chaton (< 1 an)",
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
};

type BookingVisitSlot = {
  date: string;
  startTime: string;
  duration: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BOARDING_CHECKOUT_MINUTES = 10 * 60;

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
}) {
  const contextPets = input.pricingContextPets?.length ? input.pricingContextPets : input.pets;
  const hourly = isHourlyServiceType(input.serviceType);
  const slots = input.visitSlots || [];
  const serviceDurationMinutes = input.serviceType === "HOUSE_SITTING"
    ? calculateSameDayDurationMinutes(input)
    : 0;
  const durationTier = input.serviceType === "HOUSE_SITTING"
    ? getHouseSittingDurationTier(serviceDurationMinutes)
    : null;

  if (input.serviceType === "HOUSE_SITTING" && !durationTier) {
    return { total: 0, quantity: 0, durationExtra: 0, serviceDurationMinutes, durationTier: null, pets: [] };
  }

  let quantity = 0;
  if (hourly) {
    quantity = slots.length;
  } else if (isOvernightServiceType(input.serviceType)) {
    quantity = calendarDayDifference(input.startDate, input.endDate);
  } else {
    quantity = calendarDayDifference(input.startDate, input.endDate) + 1;
  }

  let total = 0;
  const pets = input.pets.map((pet) => {
    const sameSpecies = contextPets.filter((candidate) => candidate.species === pet.species);
    const isAdditional = sameSpecies.findIndex((candidate) => candidate.id === pet.id) > 0;
    const petInput = {
      species: pet.species,
      isYoung: typeof pet.age === "number" && pet.age < 1,
      isAdditional,
    };

    const rateGroups: PriceRateGroup[] = [];

    if (hourly) {
      slots.forEach((slot) => {
        const unit = getUnitPrice(input.serviceType, {
          ...petInput,
        }, serviceDurationMinutes);
        addRateGroup(rateGroups, getRateLabel(unit.lines), unit.price, "base", slot.date);
      });
    } else {
      const dateKeys = isOvernightServiceType(input.serviceType)
        ? calendarDateKeys(input.startDate, input.endDate, false)
        : calendarDateKeys(input.startDate, input.endDate, true);

      dateKeys.forEach((dateKey) => {
        const unit = getUnitPrice(input.serviceType, {
          ...petInput,
        }, serviceDurationMinutes);
        addRateGroup(rateGroups, getRateLabel(unit.lines), unit.price, "base", dateKey);
      });
    }

    let petTotal = rateGroups.reduce((sum, group) => sum + group.total, 0);

    if (isOvernightServiceType(input.serviceType)) {
      const checkoutOverrunMinutes = timeToMinutes(input.endTime) - BOARDING_CHECKOUT_MINUTES;
      const checkoutUnit = getUnitPrice(input.serviceType, {
        ...petInput,
      });
      if (checkoutOverrunMinutes > 8 * 60) {
        petTotal += checkoutUnit.price;
        addRateGroup(rateGroups, `Journée supplémentaire (${getRateLabel(checkoutUnit.lines)})`, checkoutUnit.price, "surcharge", input.endDate);
      } else if (checkoutOverrunMinutes > 2 * 60) {
        const halfDayPrice = Math.round(checkoutUnit.price * 0.5);
        petTotal += halfDayPrice;
        addRateGroup(rateGroups, `Demi-journée (${getRateLabel(checkoutUnit.lines)})`, halfDayPrice, "surcharge", input.endDate);
      }
    }

    if (
      isOvernightServiceType(input.serviceType) &&
      quantity >= PRICING_ADJUSTMENTS.longBoarding.minNights
    ) {
      const discount = Math.round(petTotal * PRICING_ADJUSTMENTS.longBoarding.discountRate * 100) / 100;
      if (discount > 0) {
        petTotal = Math.round((petTotal - discount) * 100) / 100;
        addRateGroup(
          rateGroups,
          `Remise ${PRICING_ADJUSTMENTS.longBoarding.minNights} nuits et +`,
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

  return {
    total: Math.round(total * 100) / 100,
    quantity,
      durationExtra,
      serviceDurationMinutes,
      durationTier,
      pets,
  };
}
