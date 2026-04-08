/**
 * Système de tarification centralisé — aligné sur les tarifs Rover.
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
  let current = new Date(start);
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
    DOG: { base: 20, additional: 17, young: 22, highSeason: 24 },
    CAT: { base: 18, additional: 12, young: 20, highSeason: 22 },
  },
  DAY_CARE: {
    DOG: { base: 23, additional: 20, young: 26, highSeason: 28 },
    CAT: { base: 20, additional: 16, young: 22, highSeason: 24 },
  },
  DROP_IN: {
    DOG: { base: 13, additional: 11, young: 15, highSeason: 17 },
    CAT: { base: 12, additional: 6, young: 14, highSeason: 15 },
  },
  DOG_WALKING: {
    DOG: { base: 10, additional: 8, young: 11, highSeason: 13 },
    CAT: { base: 10, additional: 8, young: 11, highSeason: 13 }, // Promenade chat = même tarif
  },
};

// Extra durée (pour visites et promenades)
export const EXTRA_DURATION = {
  DROP_IN: { baseDuration: 30, extraRate: 8, increment: 30 },     // +8€ par 30 min
  DOG_WALKING: { baseDuration: 30, extraRate: 6, increment: 30 }, // +6€ par 30 min
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
