export const GOOGLE_CONSENT_STORAGE_KEY = "la-patte-doree-google-consent-v2";
export const GOOGLE_CONSENT_EVENT = "la-patte-doree-google-consent-change";
export const OPEN_COOKIE_SETTINGS_EVENT = "la-patte-doree-open-cookie-settings";

// EEE, Royaume-Uni et Suisse : le stockage Analytics/Ads reste refusé tant
// que le visiteur n'a pas explicitement accepté. Ailleurs, Google peut mesurer
// par défaut, tout en laissant le visiteur refuser via les réglages cookies.
export const GOOGLE_CONSENT_REQUIRED_REGIONS = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU",
  "LV", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

export function isGoogleConsentRequiredRegion(countryCode?: string | null) {
  if (!countryCode) return true;
  return GOOGLE_CONSENT_REQUIRED_REGIONS.includes(
    countryCode.toUpperCase() as (typeof GOOGLE_CONSENT_REQUIRED_REGIONS)[number]
  );
}

export type GoogleConsentChoice = "accepted" | "rejected";
