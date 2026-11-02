export const SERVICE_TYPES = [
  "BOARDING",
  "HOUSE_SITTING",
  "DAY_CARE",
  "DROP_IN",
  "DOG_WALKING",
] as const;

export type AppServiceType = (typeof SERVICE_TYPES)[number];

const SERVICE_LABELS: Record<AppServiceType, string> = {
  BOARDING: "Hébergement",
  HOUSE_SITTING: "Garde à votre domicile",
  DAY_CARE: "Garderie",
  DROP_IN: "Visite à votre domicile",
  DOG_WALKING: "Promenade",
};

export const SERVICE_UNITS: Record<AppServiceType, string> = {
  BOARDING: "période de 24 h",
  HOUSE_SITTING: "jour",
  DAY_CARE: "jour",
  DROP_IN: "visite",
  DOG_WALKING: "promenade",
};

export const HOURLY_SERVICE_TYPES = ["DROP_IN", "DOG_WALKING"] as const;
export const OVERNIGHT_SERVICE_TYPES = ["BOARDING"] as const;

export function isHourlyServiceType(serviceType: string): serviceType is (typeof HOURLY_SERVICE_TYPES)[number] {
  return HOURLY_SERVICE_TYPES.includes(serviceType as (typeof HOURLY_SERVICE_TYPES)[number]);
}

export function isOvernightServiceType(serviceType: string): serviceType is (typeof OVERNIGHT_SERVICE_TYPES)[number] {
  return OVERNIGHT_SERVICE_TYPES.includes(serviceType as (typeof OVERNIGHT_SERVICE_TYPES)[number]);
}

export function getServiceLabel(serviceType: string) {
  return SERVICE_LABELS[serviceType as AppServiceType] || serviceType;
}

// Le logement est un appartement de 45 m² : un seul animal hébergé par nuit.
export const BOARDING_MAX_PETS = 1;
export const BOARDING_MAX_PETS_ERROR = "L'hébergement est limité à un seul animal par nuit.";

export function getServicePetLimitError(serviceType: string, petCount: number) {
  if (serviceType === "BOARDING" && petCount > BOARDING_MAX_PETS) return BOARDING_MAX_PETS_ERROR;
  return null;
}
