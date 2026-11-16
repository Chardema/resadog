import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetPendingBookingConversions,
  getGoogleAdsIdFromSendTo,
  getPendingBookingConversions,
  PENDING_BOOKING_CONVERSIONS_KEY,
  processBookingConversion,
  rememberPendingBookingConversion,
  resetBookingConversionInFlight,
  resetBookingConversionMemory,
  resolveBookingConversionValue,
  sendBookingConversion,
  verifyBookingConversion,
  type BookingConversionVerification,
  type ProcessBookingConversionDeps,
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

function createPendingStorage() {
  const storage = createStorage();
  return {
    ...storage,
    removeItem: (key: string) => {
      storage.values.delete(key);
    },
  };
}

type PendingStorageMock = ReturnType<typeof createPendingStorage>;

function createFlowDeps({
  consent = { value: false },
  storage = createPendingStorage(),
  verify = vi
    .fn<(bookingId: string) => Promise<BookingConversionVerification>>()
    .mockResolvedValue({ status: "paid", value: 120 }),
}: {
  consent?: { value: boolean };
  storage?: PendingStorageMock;
  verify?: ProcessBookingConversionDeps["verify"];
} = {}) {
  const gtag = vi.fn();
  const deps: ProcessBookingConversionDeps = {
    storage,
    hasConsent: () => consent.value,
    getGtag: () => gtag,
    sendTo: SEND_TO,
    verify,
    now: () => 1_000_000,
  };
  return { deps, consent, gtag, storage, verify };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("conversion en attente de consentement", () => {
  beforeEach(() => {
    resetBookingConversionMemory();
    resetBookingConversionInFlight();
  });

  it("mémorise uniquement le bookingId sans consentement, sans vérifier ni envoyer", async () => {
    const { deps, gtag, storage, verify } = createFlowDeps();
    await expect(processBookingConversion("b10", deps)).resolves.toBe("pending");

    expect(gtag).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(getPendingBookingConversions(storage, 1_000_000)).toEqual(["b10"]);
    const raw = storage.values.get(PENDING_BOOKING_CONVERSIONS_KEY) ?? "";
    expect(raw).not.toContain("value");
    expect(JSON.parse(raw)).toEqual([{ bookingId: "b10", createdAt: 1_000_000 }]);
  });

  it("envoie une seule fois après un consentement tardif, sur une autre page", async () => {
    // Même localStorage, nouvelle « page » (dashboard) : mémoire de page perdue.
    const storage = createPendingStorage();
    const first = createFlowDeps({ storage });
    await processBookingConversion("b11", first.deps);
    expect(first.gtag).not.toHaveBeenCalled();

    resetBookingConversionMemory();
    const later = createFlowDeps({ storage, consent: { value: true } });
    for (const bookingId of getPendingBookingConversions(storage, 1_000_000)) {
      await expect(processBookingConversion(bookingId, later.deps)).resolves.toBe("sent");
    }

    expect(later.verify).toHaveBeenCalledWith("b11");
    expect(adsCalls(later.gtag)).toHaveLength(1);
    expect(getPendingBookingConversions(storage, 1_000_000)).toEqual([]);

    // Rechargement suivant : rien en attente, marqueur persistant posé.
    resetBookingConversionMemory();
    await expect(processBookingConversion("b11", later.deps)).resolves.toBe("already-sent");
    expect(adsCalls(later.gtag)).toHaveLength(1);
  });

  it("n'envoie qu'une fois si la page success et le bandeau traitent en même temps", async () => {
    const { deps, gtag, verify } = createFlowDeps({ consent: { value: true } });
    await Promise.all([processBookingConversion("b12", deps), processBookingConversion("b12", deps)]);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(adsCalls(gtag)).toHaveLength(1);
  });

  it("utilise la valeur renvoyée par le serveur, transaction_id = bookingId, EUR", async () => {
    const { deps, gtag } = createFlowDeps({
      consent: { value: true },
      verify: vi.fn().mockResolvedValue({ status: "paid", value: 87.5 }),
    });
    await processBookingConversion("b13", deps);
    expect(adsCalls(gtag)[0][2]).toEqual({
      send_to: SEND_TO,
      value: 87.5,
      currency: "EUR",
      transaction_id: "b13",
    });
    expect(gtag).toHaveBeenCalledWith("event", "generate_lead", {
      currency: "EUR",
      value: 87.5,
      transaction_id: "b13",
    });
  });

  it("oublie la conversion en attente en cas de refus et n'envoie rien ensuite", async () => {
    const { deps, consent, gtag, storage } = createFlowDeps();
    await processBookingConversion("b14", deps);
    forgetPendingBookingConversions(storage);
    expect(getPendingBookingConversions(storage, 1_000_000)).toEqual([]);

    // Acceptation ultérieure sur une autre page : plus rien à envoyer.
    consent.value = true;
    for (const bookingId of getPendingBookingConversions(storage, 1_000_000)) {
      await processBookingConversion(bookingId, deps);
    }
    expect(gtag).not.toHaveBeenCalled();
  });

  it("un retrait du consentement garde les marqueurs « déjà envoyé »", async () => {
    const { deps, gtag, storage } = createFlowDeps({ consent: { value: true } });
    await processBookingConversion("b15", deps);
    forgetPendingBookingConversions(storage);

    expect(storage.values.get("lpd_ads_conv_b15")).toBe("1");
    resetBookingConversionMemory();
    await expect(processBookingConversion("b15", deps)).resolves.toBe("already-sent");
    expect(adsCalls(gtag)).toHaveLength(1);
  });

  it("n'envoie pas de second envoi si un marqueur existant est présent", async () => {
    const storage = createPendingStorage();
    storage.setItem("lpd_ga_lead_b16", "1");
    storage.setItem("lpd_ads_conv_b16", "1");
    const { deps, gtag, verify } = createFlowDeps({ storage, consent: { value: true } });

    await expect(processBookingConversion("b16", deps)).resolves.toBe("already-sent");
    expect(verify).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("n'envoie rien et oublie la conversion si la vérification serveur échoue", async () => {
    const { deps, gtag, storage } = createFlowDeps({
      consent: { value: true },
      verify: vi.fn().mockResolvedValue({ status: "rejected" }),
    });
    await expect(processBookingConversion("b17", deps)).resolves.toBe("rejected");
    expect(gtag).not.toHaveBeenCalled();
    expect(getPendingBookingConversions(storage, 1_000_000)).toEqual([]);
  });

  it("garde la conversion en attente si le serveur est injoignable", async () => {
    const { deps, gtag, storage } = createFlowDeps({
      consent: { value: true },
      verify: vi.fn().mockResolvedValue({ status: "unavailable" }),
    });
    await expect(processBookingConversion("b18", deps)).resolves.toBe("unavailable");
    expect(gtag).not.toHaveBeenCalled();
    expect(getPendingBookingConversions(storage, 1_000_000)).toEqual(["b18"]);
  });

  it("n'envoie rien si le consentement est retiré pendant la vérification", async () => {
    const consent = { value: true };
    const { deps, gtag } = createFlowDeps({
      consent,
      verify: vi.fn().mockImplementation(async () => {
        consent.value = false;
        return { status: "paid", value: 50 };
      }),
    });
    await expect(processBookingConversion("b19", deps)).resolves.toBe("pending");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("ignore les identifiants invalides et les entrées expirées", () => {
    const storage = createPendingStorage();
    rememberPendingBookingConversion("../evil", storage, 0);
    rememberPendingBookingConversion("b20", storage, 0);
    expect(getPendingBookingConversions(storage, 0)).toEqual(["b20"]);
    expect(getPendingBookingConversions(storage, 31 * 24 * 60 * 60 * 1000)).toEqual([]);
  });
});

describe("verifyBookingConversion", () => {
  const sleep = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    sleep.mockClear();
  });

  it("renvoie la valeur serveur quand la réservation est payée", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { paid: true, value: 99 }));
    await expect(verifyBookingConversion("b30", { fetchImpl, sleep })).resolves.toEqual({
      status: "paid",
      value: 99,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/bookings/b30/conversion", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("réessaie tant que le webhook Stripe n'a pas posé l'empreinte", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(409, { paid: false }))
      .mockResolvedValueOnce(jsonResponse(409, { paid: false }))
      .mockResolvedValueOnce(jsonResponse(200, { paid: true, value: 64 }));
    await expect(
      verifyBookingConversion("b31", { fetchImpl, sleep, attempts: 4, delayMs: 1000 })
    ).resolves.toEqual({ status: "paid", value: 64 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("abandonne après un nombre limité d'essais si la réservation reste non payée", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(409, { paid: false }));
    await expect(verifyBookingConversion("b32", { fetchImpl, sleep, attempts: 3 })).resolves.toEqual({
      status: "rejected",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404])("refuse immédiatement sur %i", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, { error: "x" }));
    await expect(verifyBookingConversion("b33", { fetchImpl, sleep })).resolves.toEqual({
      status: "rejected",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("signale une indisponibilité après des erreurs réseau répétées", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(verifyBookingConversion("b34", { fetchImpl, sleep, attempts: 2 })).resolves.toEqual({
      status: "unavailable",
    });
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
