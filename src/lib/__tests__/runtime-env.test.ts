import { afterEach, describe, expect, it, vi } from "vitest";
import { isProductionDeployment } from "@/lib/runtime-env";

describe("isProductionDeployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("côté serveur (VERCEL_ENV)", () => {
    it("vrai uniquement pour VERCEL_ENV=production", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      expect(isProductionDeployment()).toBe(true);
    });

    it.each(["preview", "development", "", "Production"])("faux pour VERCEL_ENV=%j", (value) => {
      vi.stubEnv("VERCEL_ENV", value);
      expect(isProductionDeployment()).toBe(false);
    });

    it("faux si VERCEL_ENV est absente", () => {
      vi.stubEnv("VERCEL_ENV", undefined);
      expect(isProductionDeployment()).toBe(false);
    });

    it("ignore NODE_ENV=production (aperçus Vercel)", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(isProductionDeployment()).toBe(false);
    });

    it("ignore NEXT_PUBLIC_VERCEL_ENV côté serveur", () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
      expect(isProductionDeployment()).toBe(false);
    });
  });

  describe("côté navigateur (NEXT_PUBLIC_VERCEL_ENV)", () => {
    it("vrai uniquement pour NEXT_PUBLIC_VERCEL_ENV=production", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
      expect(isProductionDeployment()).toBe(true);
    });

    it.each([["preview"], ["development"], [undefined]])("faux pour %j", (value) => {
      vi.stubGlobal("window", {});
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", value);
      expect(isProductionDeployment()).toBe(false);
    });
  });
});
