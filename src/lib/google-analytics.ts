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

export const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";

export const GOOGLE_ADS_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim() || "";

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

export function trackBookingConversion({
  bookingId,
  value,
}: {
  bookingId: string;
  value?: number;
}) {
  if (!bookingId) return;
  if (!hasGoogleConsent()) return;
  if (typeof window.gtag !== "function") return;

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
