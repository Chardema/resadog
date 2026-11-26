import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadThingError } from "uploadthing/server";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

import { authorizeUpload, UPLOADS_DISABLED_MESSAGE } from "@/app/api/uploadthing/core";
import { isPetBirthDateProofRequired } from "@/lib/pets";

describe("middleware UploadThing", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([["preview"], ["development"], [undefined]])(
    "VERCEL_ENV=%j : refuse l'upload avec un message clair, avant toute session",
    async (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      const attempt = authorizeUpload();
      await expect(attempt).rejects.toBeInstanceOf(UploadThingError);
      await expect(attempt).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: UPLOADS_DISABLED_MESSAGE,
      });
      expect(UPLOADS_DISABLED_MESSAGE).toBe("Téléversement désactivé sur les environnements de test");
      expect(mockAuth).not.toHaveBeenCalled();
    }
  );

  it("production : autorise un utilisateur connecté (inchangé)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(authorizeUpload()).resolves.toEqual({ userId: "user-1" });
  });

  it("production : refuse un visiteur non connecté (inchangé)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    mockAuth.mockResolvedValue(null);
    await expect(authorizeUpload()).rejects.toThrow("Non authentifié");
  });
});

describe("justificatif de naissance selon l'environnement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hors production : jamais exigé (aucun upload possible)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isPetBirthDateProofRequired("CLIENT")).toBe(false);
  });

  it("production : exigé pour les clients, pas pour l'admin (inchangé)", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isPetBirthDateProofRequired("CLIENT")).toBe(true);
    expect(isPetBirthDateProofRequired("ADMIN")).toBe(false);
  });
});
