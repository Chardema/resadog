import { GOOGLE_CONSENT_STORAGE_KEY } from "@/lib/google-consent";

export const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || "G-6HN68EFFPH";

export const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";

export const GOOGLE_ADS_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim() || "";

export const GOOGLE_CONSENT_BOOTSTRAP = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  gtag('set', 'url_passthrough', true);
  gtag('set', 'ads_data_redaction', true);

  var storedGoogleConsent = null;
  try {
    storedGoogleConsent = window.localStorage.getItem('${GOOGLE_CONSENT_STORAGE_KEY}');
  } catch (error) {}

  if (storedGoogleConsent === 'accepted' || storedGoogleConsent === 'rejected') {
    var storedGoogleConsentValue = storedGoogleConsent === 'accepted' ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: storedGoogleConsentValue,
      ad_storage: storedGoogleConsentValue,
      ad_user_data: storedGoogleConsentValue,
      ad_personalization: storedGoogleConsentValue
    });
  }
`;

export const GOOGLE_ANALYTICS_BOOTSTRAP = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', '${GOOGLE_ANALYTICS_ID}', {
    cookie_expires: 34128000
  });
  ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ""}
`;

export const GOOGLE_TAG_CONFIGURATION = GOOGLE_ANALYTICS_BOOTSTRAP;

export function trackBookingConversion({
  bookingId,
  value,
}: {
  bookingId: string;
  value?: number;
}) {
  if (!bookingId) return;
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const storageKey = `lpd_conv_${bookingId}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) {
      return;
    }
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // Ignore storage access errors in restricted browsing modes
  }

  const resolvedValue =
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 35;

  window.gtag("event", "generate_lead", {
    currency: "EUR",
    value: resolvedValue,
    transaction_id: bookingId,
  });

  if (GOOGLE_ADS_ID && GOOGLE_ADS_CONVERSION_LABEL) {
    window.gtag("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`,
      value: resolvedValue,
      currency: "EUR",
      transaction_id: bookingId,
    });
  }
}
