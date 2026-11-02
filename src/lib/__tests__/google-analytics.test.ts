import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGoogleAdsIdFromSendTo,
  resetBookingConversionMemory,
  resolveBookingConversionValue,
  sendBookingConversion,
} from "@/lib/google-analytics";

const SEND_TO = "AW-18330125361/npEsCPa2zLAdELGIvqRE";

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function adsCalls(gtag: ReturnType<typeof vi.fn>) {
  return gtag.mock.calls.filter((call) => call[0] === "event" && call[1] === "conversion");
}

describe("sendBookingConversion", () => {
  beforeEach(() => {
    resetBookingConversionMemory();
  });

  it("n'envoie aucune conversion Ads si send_to est vide", () => {
    const gtag = vi.fn();
    const storage = createStorage();
    const result = sendBookingConversion(
      { bookingId: "b1", value: 60 },
      { gtag, storage, hasConsent: true, sendTo: "" }
    );
    expect(result.ads).toBe(false);
    expect(adsCalls(gtag)).toHaveLength(0);
    expect(storage.values.has("lpd_ads_conv_b1")).toBe(false);
  });

  it("n'envoie rien sans consentement « accepted » et ne pose pas de marqueur", () => {
    const gtag = vi.fn();
    const storage = createStorage();
    const result = sendBookingConversion(
      { bookingId: "b1", value: 60 },
      { gtag, storage, hasConsent: false, sendTo: SEND_TO }
    );
    expect(result).toEqual({ lead: false, ads: false });
    expect(gtag).not.toHaveBeenCalled();
    expect(storage.values.size).toBe(0);
  });

  it("n'envoie la conversion qu'une seule fois par réservation, même après rechargement", () => {
    const gtag = vi.fn();
    const storage = createStorage();
    const deps = { gtag, storage, hasConsent: true, sendTo: SEND_TO };

    sendBookingConversion({ bookingId: "b1", value: 60 }, deps);
    sendBookingConversion({ bookingId: "b1", value: 60 }, deps);
    // Rechargement : la mémoire de page est perdue, le marqueur persistant reste.
    resetBookingConversionMemory();
    sendBookingConversion({ bookingId: "b1", value: 60 }, deps);

    expect(adsCalls(gtag)).toHaveLength(1);
    expect(adsCalls(gtag)[0][2]).toEqual({
      send_to: SEND_TO,
      value: 60,
      currency: "EUR",
      transaction_id: "b1",
    });
    expect(storage.values.get("lpd_ads_conv_b1")).toBe("1");
  });

  it("utilise 45 € par défaut et la même valeur pour generate_lead", () => {
    const gtag = vi.fn();
    sendBookingConversion(
      { bookingId: "b2" },
      { gtag, storage: createStorage(), hasConsent: true, sendTo: SEND_TO }
    );
    expect(gtag).toHaveBeenCalledWith("event", "generate_lead", {
      currency: "EUR",
      value: 45,
      transaction_id: "b2",
    });
    expect(adsCalls(gtag)[0][2]).toMatchObject({ value: 45, transaction_id: "b2" });
  });

  it("envoie une seule fois si le stockage est inaccessible", () => {
    const gtag = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const deps = { gtag, storage, hasConsent: true, sendTo: SEND_TO };
    sendBookingConversion({ bookingId: "b3", value: 80 }, deps);
    sendBookingConversion({ bookingId: "b3", value: 80 }, deps);
    expect(adsCalls(gtag)).toHaveLength(1);
  });
});

describe("helpers de conversion", () => {
  it("résout la valeur de conversion", () => {
    expect(resolveBookingConversionValue(undefined)).toBe(45);
    expect(resolveBookingConversionValue(Number.NaN)).toBe(45);
    expect(resolveBookingConversionValue(0)).toBe(45);
    expect(resolveBookingConversionValue(72.5)).toBe(72.5);
  });

  it("déduit l'ID Google Ads du préfixe de send_to", () => {
    expect(getGoogleAdsIdFromSendTo(SEND_TO)).toBe("AW-18330125361");
    expect(getGoogleAdsIdFromSendTo("")).toBe("");
    expect(getGoogleAdsIdFromSendTo("G-XXXX/abc")).toBe("");
  });
});
