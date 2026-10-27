export const GOOGLE_CONSENT_STORAGE_KEY = "la-patte-doree-google-consent-v2";
export const GOOGLE_CONSENT_EVENT = "la-patte-doree-google-consent-change";
export const OPEN_COOKIE_SETTINGS_EVENT = "la-patte-doree-open-cookie-settings";

export const GOOGLE_DEFAULT_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

// Le stockage Analytics/Ads reste refusé par défaut partout tant que le
// visiteur n'a pas explicitement accepté.
export const GOOGLE_CONSENT_REQUIRED_REGIONS = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU",
  "LV", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

export function isGoogleConsentRequiredRegion(countryCode?: string | null) {
  void countryCode;
  return true;
}

export type GoogleConsentChoice = "accepted" | "rejected";
