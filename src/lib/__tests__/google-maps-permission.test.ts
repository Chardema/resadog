import { describe, expect, it } from "vitest";
import { GOOGLE_CONSENT_STORAGE_KEY } from "@/lib/google-consent";
import {
  MAP_SESSION_STORAGE_KEY,
  hasMapPermission,
  rememberMapForSession,
} from "@/lib/google-maps-permission";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function createWindow({
  local = {},
  session = {},
}: { local?: Record<string, string>; session?: Record<string, string> } = {}) {
  return { localStorage: createStorage(local), sessionStorage: createStorage(session) };
}

const unavailableStorage = {
  getItem: (): string | null => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
};

describe("hasMapPermission", () => {
  it("n'affiche pas la carte sans clic, même si la mesure d'audience Google est acceptée", () => {
    const win = createWindow({ local: { [GOOGLE_CONSENT_STORAGE_KEY]: "accepted" } });
    expect(hasMapPermission(win, false)).toBe(false);
  });

  it("n'affiche pas la carte par défaut", () => {
    expect(hasMapPermission(createWindow(), false)).toBe(false);
  });

  it("affiche la carte si la session a mémorisé le clic", () => {
    const win = createWindow({ session: { [MAP_SESSION_STORAGE_KEY]: "1" } });
    expect(hasMapPermission(win, false)).toBe(true);
  });

  it("affiche la carte après un clic dans la page (repli mémoire)", () => {
    expect(hasMapPermission(createWindow(), true)).toBe(true);
  });

  it("n'affiche pas la carte si sessionStorage est inaccessible et sans clic", () => {
    expect(hasMapPermission({ sessionStorage: unavailableStorage }, false)).toBe(false);
  });
});

describe("rememberMapForSession", () => {
  it("mémorise le clic pour la session sous la clé « la-patte-doree-google-maps-session »", () => {
    const win = createWindow();
    rememberMapForSession(win);
    expect(win.sessionStorage.getItem("la-patte-doree-google-maps-session")).toBe("1");
    expect(hasMapPermission(win, false)).toBe(true);
  });

  it("ne lève pas d'erreur si sessionStorage est inaccessible", () => {
    expect(() => rememberMapForSession({ sessionStorage: unavailableStorage })).not.toThrow();
  });
});
