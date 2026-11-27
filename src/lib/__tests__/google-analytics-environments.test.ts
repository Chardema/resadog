import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_CONSENT_STORAGE_KEY } from "@/lib/google-consent";
import {
  flushPendingBookingConversions,
  getGoogleAdsConversionSendTo,
  getGoogleAdsId,
  getGoogleAnalyticsId,
  getGoogleConsentBootstrap,
  loadGoogleTag,
  PENDING_BOOKING_CONVERSIONS_KEY,
  resetBookingConversionInFlight,
  resetBookingConversionMemory,
  trackBookingConversion,
} from "@/lib/google-analytics";

const SEND_TO = "AW-18330125361/npEsCPa2zLAdELGIvqRE";

// Exécute le script inline du layout dans un faux navigateur, avec un
// consentement « accepted » déjà enregistré, puis simule « Tout accepter ».
function runBootstrap(source: string) {
  const dataLayer: unknown[][] = [];
  const appended: Array<{ src?: string }> = [];
  const fakeWindow: Record<string, unknown> = {
    dataLayer,
    localStorage: {
      getItem: (key: string) => (key === GOOGLE_CONSENT_STORAGE_KEY ? "accepted" : null),
    },
  };
  const fakeDocument = {
    createElement: () => ({}),
    head: { appendChild: (element: { src?: string }) => appended.push(element) },
  };
  new Function("window", "document", "dataLayer", source)(fakeWindow, fakeDocument, dataLayer);
  (fakeWindow.__lpdLoadGoogleTag as () => void)();
  const commands = dataLayer.map((args) => Array.from(args as ArrayLike<unknown>));
  return { appended, commands, fakeWindow };
}

describe("Google Analytics / Ads hors production", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", "G-PREVIEWSHOULDNOTLEAK");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO", SEND_TO);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-18330125361");
    resetBookingConversionMemory();
    resetBookingConversionInFlight();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([["preview"], ["development"], [undefined]])(
    "VERCEL_ENV=%j : aucun ID GA ni Ads, même si les variables sont définies",
    (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      expect(getGoogleAnalyticsId()).toBe("");
      expect(getGoogleAdsId()).toBe("");
      expect(getGoogleAdsConversionSendTo()).toBe("");
    }
  );

  it("le script inline garde le Consent Mode mais n'injecte jamais gtag.js, même accepté", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const source = getGoogleConsentBootstrap();
    expect(source).not.toContain("googletagmanager");
    expect(source).not.toContain("G-");
    expect(source).not.toContain("AW-");

    const { appended, commands } = runBootstrap(source);
    expect(appended).toHaveLength(0);
    expect(commands.some(([cmd]) => cmd === "config")).toBe(false);
    expect(commands.some(([cmd]) => cmd === "js")).toBe(false);
    expect(commands[0]).toEqual(["consent", "default", expect.objectContaining({ analytics_storage: "denied" })]);
  });

  it("navigateur hors prod : loadGoogleTag ne charge rien", () => {
    const load = vi.fn();
    vi.stubGlobal("window", { __lpdLoadGoogleTag: load });
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    loadGoogleTag();
    expect(load).not.toHaveBeenCalled();
  });

  it("navigateur hors prod : aucune conversion vérifiée ni envoyée après « Tout accepter »", async () => {
    const gtag = vi.fn();
    const storage = new Map<string, string>([
      [GOOGLE_CONSENT_STORAGE_KEY, "accepted"],
      [PENDING_BOOKING_CONVERSIONS_KEY, JSON.stringify([{ bookingId: "b1", createdAt: Date.now() }])],
    ]);
    vi.stubGlobal("window", {
      gtag,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");

    await expect(trackBookingConversion("b2")).resolves.toBe("disabled");
    await flushPendingBookingConversions();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("Google Analytics / Ads en production (inchangé)", () => {
  beforeEach(() => {
    resetBookingConversionMemory();
    resetBookingConversionInFlight();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("utilise G-6HN68EFFPH sans NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", undefined);
    expect(getGoogleAnalyticsId()).toBe("G-6HN68EFFPH");
  });

  it("respecte NEXT_PUBLIC_GOOGLE_ANALYTICS_ID et les variables Ads si définies", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", " G-OTHER ");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO", SEND_TO);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", undefined);
    expect(getGoogleAnalyticsId()).toBe("G-OTHER");
    expect(getGoogleAdsConversionSendTo()).toBe(SEND_TO);
    expect(getGoogleAdsId()).toBe("AW-18330125361");
  });

  it("charge gtag.js et configure GA + Ads après consentement", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", undefined);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO", SEND_TO);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", undefined);

    const { appended, commands, fakeWindow } = runBootstrap(getGoogleConsentBootstrap());

    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe("https://www.googletagmanager.com/gtag/js?id=G-6HN68EFFPH");
    expect(commands).toContainEqual(["config", "G-6HN68EFFPH", { cookie_expires: 34128000 }]);
    expect(commands).toContainEqual(["config", "AW-18330125361"]);
    expect(fakeWindow["ga-disable-G-6HN68EFFPH"]).toBe(false);

    // Second appel (bandeau « Tout accepter ») : pas de seconde injection.
    (fakeWindow.__lpdLoadGoogleTag as () => void)();
    expect(appended).toHaveLength(1);
  });

  it("navigateur en prod : loadGoogleTag délègue au script inline", () => {
    const load = vi.fn();
    vi.stubGlobal("window", { __lpdLoadGoogleTag: load });
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    loadGoogleTag();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("navigateur en prod : sans consentement, la conversion reste en attente", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      gtag: vi.fn(),
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");

    await expect(trackBookingConversion("b3")).resolves.toBe("pending");
    expect(storage.get(PENDING_BOOKING_CONVERSIONS_KEY)).toContain("b3");
  });
});
