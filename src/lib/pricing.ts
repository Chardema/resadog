/**
 * Système de tarification centralisé.
 *
 * Variables de prix :
 * 1. Type de service (BOARDING, DAY_CARE, DROP_IN, DOG_WALKING)
 * 2. Espèce (DOG / CAT)
 * 3. Premier animal vs animal supplémentaire
 * 4. Jeune animal (< 1 an)
 * 5. Haute saison
 * 6. Durée (extra temps pour visites/promenades)
 */

// --- HAUTE SAISON ---
// Périodes de haute saison (mois/jour début -> mois/jour fin)
const HIGH_SEASON_PERIODS = [
  { startMonth: 7, startDay: 1, endMonth: 8, endDay: 31 },   // Juillet-Août
  { startMonth: 12, startDay: 20, endMonth: 12, endDay: 31 }, // Noël
  { startMonth: 1, startDay: 1, endMonth: 1, endDay: 5 },     // Nouvel An
];

export function isHighSeason(date: Date): boolean {
  const m = date.getMonth() + 1; // 1-indexed
  const d = date.getDate();
  return HIGH_SEASON_PERIODS.some((p) => {
    if (p.startMonth === p.endMonth) {
      return m === p.startMonth && d >= p.startDay && d <= p.endDay;
    }
    if (p.startMonth < p.endMonth) {
      return (m > p.startMonth || (m === p.startMonth && d >= p.startDay)) &&
             (m < p.endMonth || (m === p.endMonth && d <= p.endDay));
    }
    // Cross-year (ex: Dec -> Jan) — not needed for current config but safe
    return (m > p.startMonth || (m === p.startMonth && d >= p.startDay)) ||
           (m < p.endMonth || (m === p.endMonth && d <= p.endDay));
  });
}

export function isHighSeasonRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);
  while (current <= end) {
    if (isHighSeason(current)) return true;
    current.setDate(current.getDate() + 1);
  }
  return false;
}

// --- GRILLE TARIFAIRE ---

export type Species = "DOG" | "CAT";

interface PriceEntry {
  base: number;           // Premier animal
  additional: number;     // Animal supplémentaire
  young: number;          // Jeune animal (< 1 an, premier)
  highSeason: number;     // Premier animal en haute saison
}

// Tarifs par service et espèce
const PRICING: Record<string, Record<Species, PriceEntry>> = {
  BOARDING: {
    DOG: { base: 24, additional: 18, young: 27, highSeason: 29 },
    CAT: { base: 20, additional: 14, young: 23, highSeason: 25 },
  },
  DAY_CARE: {
    DOG: { base: 25, additional: 20, young: 28, highSeason: 30 },
    CAT: { base: 22, additional: 17, young: 25, highSeason: 27 },
  },
  DROP_IN: {
    DOG: { base: 15, additional: 10, young: 17, highSeason: 18 },
    CAT: { base: 14, additional: 8, young: 16, highSeason: 17 },
  },
  DOG_WALKING: {
    DOG: { base: 12, additional: 9, young: 14, highSeason: 15 },
    CAT: { base: 12, additional: 9, young: 14, highSeason: 15 },
  },
};

// Extra durée (pour visites et promenades)
export const EXTRA_DURATION = {
  DROP_IN: { baseDuration: 30, extraRate: 9, increment: 30 },
  DOG_WALKING: { baseDuration: 30, extraRate: 7, increment: 30 },
};

// --- CALCUL DE PRIX ---

export interface PetPriceInput {
  species: Species;
  isYoung: boolean;       // < 1 an
  isAdditional: boolean;  // 2e animal ou plus du même type
  isHighSeason: boolean;
}

export interface PriceDetail {
  unitPrice: number;
  total: number;
  quantity: number;
  breakdown: string; // "nuits", "jours", "visites"
  lines: PriceLine[];
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

export function getUnitPrice(
  serviceType: string,
  pet: PetPriceInput
): { price: number; lines: PriceLine[] } {
  const prices = PRICING[serviceType]?.[pet.species];
  if (!prices) return { price: 0, lines: [] };

  const lines: PriceLine[] = [];

  // Déterminer le tarif de base
  let price: number;

  if (pet.isYoung) {
    price = prices.young;
    lines.push({
      label: `Tarif jeune animal (< 1 an)`,
      amount: price,
      type: "base",
    });
  } else if (pet.isAdditional) {
    price = prices.additional;
    lines.push({
      label: `Animal supplémentaire`,
      amount: price,
      type: "base",
    });
  } else if (pet.isHighSeason) {
    price = prices.highSeason;
    lines.push({
      label: `Tarif haute saison`,
      amount: price,
      type: "surcharge",
    });
  } else {
    price = prices.base;
    lines.push({
      label: `Tarif ${pet.species === "CAT" ? "chat" : "chien"}`,
      amount: price,
      type: "base",
    });
  }

  // Si haute saison ET pas déjà en tarif haute saison (jeune animal ou additionnel)
  if (pet.isHighSeason && !pet.isAdditional && !pet.isYoung) {
    // Already handled above
  } else if (pet.isHighSeason && (pet.isAdditional || pet.isYoung)) {
    const surcharge = Math.round((prices.highSeason - prices.base) * 0.5); // Demi-surcharge haute saison
    if (surcharge > 0) {
      price += surcharge;
      lines.push({
        label: `Majoration haute saison`,
        amount: surcharge,
        type: "surcharge",
      });
    }
  }

  return { price, lines };
}

export function getServiceDisplayPrice(serviceType: string): {
  dogPrice: number;
  catPrice: number;
  unit: string;
} {
  const dog = PRICING[serviceType]?.DOG;
  const cat = PRICING[serviceType]?.CAT;
  const units: Record<string, string> = {
    BOARDING: "nuit",
    DAY_CARE: "jour",
    DROP_IN: "visite",
    DOG_WALKING: "promenade",
  };
  return {
    dogPrice: dog?.base || 0,
    catPrice: cat?.base || 0,
    unit: units[serviceType] || "unité",
  };
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
  const hourly = input.serviceType === "DROP_IN" || input.serviceType === "DOG_WALKING";
  const slots = input.visitSlots || [];

  let quantity = 0;
  if (hourly) {
    quantity = slots.length;
  } else if (input.serviceType === "DAY_CARE") {
    quantity = calendarDayDifference(input.startDate, input.endDate) + 1;
  } else {
    quantity = calendarDayDifference(input.startDate, input.endDate);
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
          isHighSeason: isHighSeasonRange(slot.date, slot.date),
        });
        addRateGroup(rateGroups, getRateLabel(unit.lines), unit.price, "base", slot.date);
      });
    } else {
      const dateKeys = input.serviceType === "DAY_CARE"
        ? calendarDateKeys(input.startDate, input.endDate, true)
        : calendarDateKeys(input.startDate, input.endDate, false);

      dateKeys.forEach((dateKey) => {
        const unit = getUnitPrice(input.serviceType, {
          ...petInput,
          isHighSeason: isHighSeasonRange(dateKey, dateKey),
        });
        addRateGroup(rateGroups, getRateLabel(unit.lines), unit.price, "base", dateKey);
      });
    }

    let petTotal = rateGroups.reduce((sum, group) => sum + group.total, 0);

    if (input.serviceType === "BOARDING") {
      const checkoutOverrunMinutes = timeToMinutes(input.endTime) - BOARDING_CHECKOUT_MINUTES;
      const checkoutUnit = getUnitPrice(input.serviceType, {
        ...petInput,
        isHighSeason: isHighSeasonRange(input.endDate, input.endDate),
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
    const extra = EXTRA_DURATION[input.serviceType as keyof typeof EXTRA_DURATION];
    durationExtra = slots.reduce((sum, slot) => {
      const extraMinutes = Math.max(0, slot.duration - extra.baseDuration);
      return sum + Math.ceil(extraMinutes / extra.increment) * extra.extraRate;
    }, 0);
    total += durationExtra;
  }

  return {
    total: Math.round(total * 100) / 100,
    quantity,
    durationExtra,
    pets,
  };
}
