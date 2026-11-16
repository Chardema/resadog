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

const leadMarkerKey = (bookingId: string) => `lpd_ga_lead_${bookingId}`;
const adsMarkerKey = (bookingId: string) => `lpd_ads_conv_${bookingId}`;

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

  result.lead = sendOnce(leadMarkerKey(bookingId), storage, () => {
    gtag("event", "generate_lead", {
      currency: "EUR",
      value: resolvedValue,
      transaction_id: bookingId,
    });
  });

  if (sendTo) {
    result.ads = sendOnce(adsMarkerKey(bookingId), storage, () => {
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

// ── Conversions en attente de consentement ──────────────────────────────
// Sur /booking/success sans consentement « accepted », seul le bookingId est
// mémorisé (jamais de montant). La conversion part dès que le visiteur
// accepte, sur n'importe quelle page (CookieConsent est dans le layout
// racine), après vérification serveur de la réservation.

export const PENDING_BOOKING_CONVERSIONS_KEY = "lpd_pending_booking_conversions";
const PENDING_CONVERSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PENDING_CONVERSIONS = 10;
const BOOKING_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type PendingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PendingEntry = { bookingId: string; createdAt: number };

export function isValidConversionBookingId(bookingId: unknown): bookingId is string {
  return typeof bookingId === "string" && BOOKING_ID_PATTERN.test(bookingId);
}

function readPendingEntries(storage: PendingStorage | null, now: number): PendingEntry[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PENDING_BOOKING_CONVERSIONS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PendingEntry =>
        isValidConversionBookingId(entry?.bookingId) &&
        typeof entry?.createdAt === "number" &&
        now - entry.createdAt < PENDING_CONVERSION_TTL_MS
    );
  } catch {
    return [];
  }
}

function writePendingEntries(storage: PendingStorage | null, entries: PendingEntry[]) {
  if (!storage) return;
  try {
    if (entries.length === 0) {
      storage.removeItem(PENDING_BOOKING_CONVERSIONS_KEY);
    } else {
      storage.setItem(
        PENDING_BOOKING_CONVERSIONS_KEY,
        JSON.stringify(entries.slice(-MAX_PENDING_CONVERSIONS))
      );
    }
  } catch {
    // Stockage inaccessible : la conversion ne pourra pas être reprise plus tard.
  }
}

export function getPendingBookingConversions(storage: PendingStorage | null, now = Date.now()) {
  return readPendingEntries(storage, now).map((entry) => entry.bookingId);
}

export function rememberPendingBookingConversion(
  bookingId: string,
  storage: PendingStorage | null,
  now = Date.now()
) {
  if (!isValidConversionBookingId(bookingId)) return;
  const entries = readPendingEntries(storage, now);
  if (entries.some((entry) => entry.bookingId === bookingId)) return;
  writePendingEntries(storage, [...entries, { bookingId, createdAt: now }]);
}

export function forgetPendingBookingConversion(
  bookingId: string,
  storage: PendingStorage | null,
  now = Date.now()
) {
  const entries = readPendingEntries(storage, now);
  writePendingEntries(storage, entries.filter((entry) => entry.bookingId !== bookingId));
}

// Refus ou retrait du consentement : on oublie ce qui est en attente, mais
// les marqueurs « déjà envoyé » restent (aucun renvoi ultérieur).
export function forgetPendingBookingConversions(storage: PendingStorage | null) {
  writePendingEntries(storage, []);
}

export function isBookingConversionSent(
  bookingId: string,
  storage: Pick<Storage, "getItem"> | null,
  sendTo: string
) {
  const keys = [leadMarkerKey(bookingId), ...(sendTo ? [adsMarkerKey(bookingId)] : [])];
  return keys.every((key) => {
    if (sentInThisPage.has(key)) return true;
    try {
      return Boolean(storage?.getItem(key));
    } catch {
      return false;
    }
  });
}

// ── Vérification serveur ────────────────────────────────────────────────

export type BookingConversionVerification =
  | { status: "paid"; value: number | null }
  // 401/403/404 ou toujours non payée après les réessais : ne rien envoyer.
  | { status: "rejected" }
  // Réseau ou erreur serveur : on pourra retenter plus tard.
  | { status: "unavailable" };

export type VerifyBookingConversionOptions = {
  fetchImpl?: typeof fetch;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Le retour Stripe sur /booking/success peut précéder le webhook
// checkout.session.completed qui pose le stripePaymentId : en cas de 409
// (pas encore payée) ou d'erreur transitoire, on réessaie quelques fois.
export async function verifyBookingConversion(
  bookingId: string,
  {
    fetchImpl = typeof fetch === "function" ? (input, init) => fetch(input, init) : undefined,
    attempts = 4,
    delayMs = 1500,
    sleep = defaultSleep,
  }: VerifyBookingConversionOptions = {}
): Promise<BookingConversionVerification> {
  if (!isValidConversionBookingId(bookingId) || !fetchImpl) return { status: "rejected" };

  let last: BookingConversionVerification = { status: "unavailable" };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(
        `/api/bookings/${encodeURIComponent(bookingId)}/conversion`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (response.ok) {
        const data = (await response.json()) as { paid?: unknown; value?: unknown };
        if (data?.paid !== true) return { status: "rejected" };
        const value =
          typeof data.value === "number" && Number.isFinite(data.value) && data.value > 0
            ? data.value
            : null;
        return { status: "paid", value };
      }
      if ([401, 403, 404].includes(response.status)) return { status: "rejected" };
      last = response.status === 409 ? { status: "rejected" } : { status: "unavailable" };
    } catch {
      last = { status: "unavailable" };
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return last;
}

// ── Orchestration ───────────────────────────────────────────────────────

export type BookingConversionOutcome =
  | "invalid"
  | "already-sent"
  | "pending"
  | "sent"
  | "rejected"
  | "unavailable";

export type ProcessBookingConversionDeps = {
  storage: PendingStorage | null;
  hasConsent: () => boolean;
  getGtag: () => ((...args: unknown[]) => void) | undefined;
  sendTo: string;
  verify: (bookingId: string) => Promise<BookingConversionVerification>;
  now?: () => number;
};

// Une seule vérification à la fois par réservation (page success + bandeau
// cookies peuvent déclencher le même traitement au même moment).
const inFlight = new Map<string, Promise<BookingConversionOutcome>>();

export function processBookingConversion(
  bookingId: string,
  deps: ProcessBookingConversionDeps
): Promise<BookingConversionOutcome> {
  if (!isValidConversionBookingId(bookingId)) return Promise.resolve("invalid");
  const running = inFlight.get(bookingId);
  if (running) return running;

  const task = runBookingConversion(bookingId, deps).finally(() => {
    inFlight.delete(bookingId);
  });
  inFlight.set(bookingId, task);
  return task;
}

async function runBookingConversion(
  bookingId: string,
  { storage, hasConsent, getGtag, sendTo, verify, now = Date.now }: ProcessBookingConversionDeps
): Promise<BookingConversionOutcome> {
  if (isBookingConversionSent(bookingId, storage, sendTo)) {
    forgetPendingBookingConversion(bookingId, storage, now());
    return "already-sent";
  }

  // Mémorisé avant la vérification : si le réseau échoue, on retentera.
  rememberPendingBookingConversion(bookingId, storage, now());
  if (!hasConsent()) return "pending";

  const verification = await verify(bookingId);
  if (verification.status === "unavailable") return "unavailable";
  if (verification.status === "rejected") {
    forgetPendingBookingConversion(bookingId, storage, now());
    return "rejected";
  }

  // Le consentement a pu être retiré pendant la vérification (la conversion
  // en attente a alors déjà été oubliée par le bandeau cookies).
  if (!hasConsent()) return "pending";

  sendBookingConversion(
    { bookingId, value: verification.value ?? undefined },
    { gtag: getGtag(), storage, hasConsent: true, sendTo }
  );
  const sent = isBookingConversionSent(bookingId, storage, sendTo);
  if (sent) forgetPendingBookingConversion(bookingId, storage, now());
  return sent ? "sent" : "unavailable";
}

export function resetBookingConversionInFlight() {
  inFlight.clear();
}

// ── Points d'entrée navigateur ──────────────────────────────────────────

function getBrowserStorage(): PendingStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserConversionDeps(): ProcessBookingConversionDeps {
  return {
    storage: getBrowserStorage(),
    hasConsent: hasGoogleConsent,
    getGtag: () => (typeof window === "undefined" ? undefined : window.gtag),
    sendTo: GOOGLE_ADS_CONVERSION_SEND_TO,
    verify: (bookingId) => verifyBookingConversion(bookingId),
  };
}

// Appelé sur /booking/success : envoie après vérification si le consentement
// est déjà accordé, sinon mémorise la conversion en attente.
export function trackBookingConversion(bookingId: string) {
  if (typeof window === "undefined") return Promise.resolve<BookingConversionOutcome>("invalid");
  return processBookingConversion(bookingId, browserConversionDeps());
}

// Appelé par le bandeau cookies (chargement de page et « Tout accepter »).
export async function flushPendingBookingConversions() {
  if (typeof window === "undefined" || !hasGoogleConsent()) return;
  const deps = browserConversionDeps();
  const pending = getPendingBookingConversions(deps.storage);
  await Promise.all(pending.map((bookingId) => processBookingConversion(bookingId, deps)));
}

export function discardPendingBookingConversions() {
  forgetPendingBookingConversions(getBrowserStorage());
}
