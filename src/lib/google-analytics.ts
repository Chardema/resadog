import { GOOGLE_CONSENT_STORAGE_KEY } from "@/lib/google-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __lpdLoadGoogleTag?: () => void;
    __lpdRevokeGoogleTag?: () => void;
  }
}

export const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || "G-6HN68EFFPH";

// Valeur send_to complète de la conversion Google Ads (ex. AW-XXXX/libellé).
// Vide → aucune conversion Ads n'est envoyée.
export const GOOGLE_ADS_CONVERSION_SEND_TO =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO?.trim() || "";

export function getGoogleAdsIdFromSendTo(sendTo: string) {
  const prefix = sendTo.split("/")[0]?.trim() ?? "";
  return prefix.startsWith("AW-") ? prefix : "";
}

// Utilisé pour gtag('config', AW-...) ; à défaut, dérivé du préfixe de send_to.
export const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ||
  getGoogleAdsIdFromSendTo(GOOGLE_ADS_CONVERSION_SEND_TO);

export const DEFAULT_BOOKING_CONVERSION_VALUE = 45;

const GOOGLE_TAG_IDS = [GOOGLE_ANALYTICS_ID, GOOGLE_ADS_ID].filter(Boolean);

// Stub dataLayer + Consent Mode v2 : aucune requête réseau ici. Le script
// gtag.js n'est injecté que par window.__lpdLoadGoogleTag(), appelé
// uniquement si le visiteur a choisi « Tout accepter ».
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

  window.__lpdLoadGoogleTag = function () {
    var tagIds = ${JSON.stringify(GOOGLE_TAG_IDS)};
    for (var i = 0; i < tagIds.length; i++) {
      window['ga-disable-' + tagIds[i]] = false;
    }
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    if (window.__lpdGoogleTagLoaded) return;
    window.__lpdGoogleTagLoaded = true;

    gtag('js', new Date());
    gtag('config', ${JSON.stringify(GOOGLE_ANALYTICS_ID)}, {
      cookie_expires: 34128000
    });
    ${GOOGLE_ADS_ID ? `gtag('config', ${JSON.stringify(GOOGLE_ADS_ID)});` : ""}

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(${JSON.stringify(GOOGLE_ANALYTICS_ID)});
    document.head.appendChild(script);
  };

  window.__lpdRevokeGoogleTag = function () {
    gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    var tagIds = ${JSON.stringify(GOOGLE_TAG_IDS)};
    for (var i = 0; i < tagIds.length; i++) {
      window['ga-disable-' + tagIds[i]] = true;
    }
  };

  var storedGoogleConsent = null;
  try {
    storedGoogleConsent = window.localStorage.getItem('${GOOGLE_CONSENT_STORAGE_KEY}');
  } catch (error) {}

  if (storedGoogleConsent === 'accepted') {
    window.__lpdLoadGoogleTag();
  }
`;

export function hasGoogleConsent() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GOOGLE_CONSENT_STORAGE_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function loadGoogleTag() {
  if (typeof window === "undefined") return;
  window.__lpdLoadGoogleTag?.();
}

export function revokeGoogleTag() {
  if (typeof window === "undefined") return;
  window.__lpdRevokeGoogleTag?.();
}

export function resolveBookingConversionValue(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : DEFAULT_BOOKING_CONVERSION_VALUE;
}

type ConversionStorage = Pick<Storage, "getItem" | "setItem">;

export type BookingConversionDeps = {
  gtag: ((...args: unknown[]) => void) | undefined;
  storage: ConversionStorage | null;
  hasConsent: boolean;
  sendTo: string;
};

// Garde en mémoire pour la page courante (double effet React, stockage
// indisponible) en plus du marqueur persistant en localStorage.
const sentInThisPage = new Set<string>();

export function resetBookingConversionMemory() {
  sentInThisPage.clear();
}

function sendOnce(
  key: string,
  storage: ConversionStorage | null,
  send: () => void
) {
  if (sentInThisPage.has(key)) return false;
  try {
    if (storage?.getItem(key)) return false;
  } catch {
    // Stockage inaccessible (navigation restreinte) : garde mémoire seule.
  }
  send();
  sentInThisPage.add(key);
  try {
    storage?.setItem(key, "1");
  } catch {
    // Ignore storage access errors in restricted browsing modes
  }
  return true;
}

export function sendBookingConversion(
  { bookingId, value }: { bookingId: string; value?: number },
  { gtag, storage, hasConsent, sendTo }: BookingConversionDeps
) {
  const result = { lead: false, ads: false };
  if (!bookingId || !hasConsent || typeof gtag !== "function") return result;

  const resolvedValue = resolveBookingConversionValue(value);

  result.lead = sendOnce(`lpd_ga_lead_${bookingId}`, storage, () => {
    gtag("event", "generate_lead", {
      currency: "EUR",
      value: resolvedValue,
      transaction_id: bookingId,
    });
  });

  if (sendTo) {
    result.ads = sendOnce(`lpd_ads_conv_${bookingId}`, storage, () => {
      gtag("event", "conversion", {
        send_to: sendTo,
        value: resolvedValue,
        currency: "EUR",
        transaction_id: bookingId,
      });
    });
  }

  return result;
}

export function trackBookingConversion({
  bookingId,
  value,
}: {
  bookingId: string;
  value?: number;
}) {
  if (typeof window === "undefined") return;

  let storage: ConversionStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }

  sendBookingConversion(
    { bookingId, value },
    {
      gtag: window.gtag,
      storage,
      hasConsent: hasGoogleConsent(),
      sendTo: GOOGLE_ADS_CONVERSION_SEND_TO,
    }
  );
}
