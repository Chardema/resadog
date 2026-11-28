import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syncPetConfigs } from "@/lib/booking-pet-configs";
import {
  NETWORK_ERROR,
  RATE_LIMIT_ERROR,
  SIGNIN_GENERIC_ERROR,
  SIGNUP_GENERIC_ERROR,
  extractApiError,
  parseApiResponse,
} from "@/lib/auth/api-error";
import { registerSchema } from "@/lib/auth/register-schema";
import { translateFrenchText } from "@/lib/i18n";

type Config = { startDate: string };
const makeDefault = () => ({ startDate: "2026-12-01" });

describe("syncPetConfigs", () => {
  it("renvoie la même référence quand les ids n'ont pas changé (non-régression de la boucle /booking)", () => {
    const current: Record<string, Config> = {
      "sim-adult-dog-1": { startDate: "2026-12-01" },
      "sim-kitten-1": { startDate: "2026-12-02" },
    };
    expect(syncPetConfigs(current, ["sim-adult-dog-1", "sim-kitten-1"], makeDefault)).toBe(current);
    // Un nouveau tableau (même contenu) ne doit pas non plus produire un nouvel objet.
    expect(syncPetConfigs(current, ["sim-kitten-1", "sim-adult-dog-1"].slice(), makeDefault)).toBe(current);
  });

  it("renvoie la même référence pour une liste vide sur un état vide", () => {
    const current: Record<string, Config> = {};
    expect(syncPetConfigs(current, [], makeDefault)).toBe(current);
  });

  it("conserve les configs existantes et ajoute les nouveaux ids", () => {
    const existing = { startDate: "2026-12-24" };
    const current: Record<string, Config> = { a: existing };
    const next = syncPetConfigs(current, ["a", "b"], makeDefault);
    expect(next).not.toBe(current);
    expect(next.a).toBe(existing);
    expect(next.b).toEqual({ startDate: "2026-12-01" });
  });

  it("retire les ids qui ne sont plus actifs", () => {
    const current: Record<string, Config> = { a: { startDate: "x" }, b: { startDate: "y" } };
    const next = syncPetConfigs(current, ["b"], makeDefault);
    expect(Object.keys(next)).toEqual(["b"]);
    expect(next.b).toBe(current.b);
  });

  it("converge : un second appel sur le résultat renvoie la même référence", () => {
    const first = syncPetConfigs<Config>({}, ["a", "b"], makeDefault);
    expect(syncPetConfigs(first, ["a", "b"], makeDefault)).toBe(first);
  });
});

function fakeResponse(status: number, body: string) {
  return new Response(body || null, { status });
}

describe("extractApiError / parseApiResponse", () => {
  it("renvoie le champ error d'une réponse JSON", async () => {
    const response = fakeResponse(400, JSON.stringify({ error: "Ajoutez un chiffre" }));
    expect(await extractApiError(response, SIGNUP_GENERIC_ERROR)).toBe("Ajoutez un chiffre");
  });

  it("utilise le message générique pour un JSON sans error", async () => {
    const response = fakeResponse(400, JSON.stringify({ message: "nope" }));
    expect(await extractApiError(response, SIGNUP_GENERIC_ERROR)).toBe(SIGNUP_GENERIC_ERROR);
  });

  it("n'expose jamais une SyntaxError pour une page HTML 500", async () => {
    const response = fakeResponse(500, "<!DOCTYPE html><html><body>Internal Server Error</body></html>");
    expect(await extractApiError(response, SIGNUP_GENERIC_ERROR)).toBe(SIGNUP_GENERIC_ERROR);
  });

  it("utilise le message générique pour un texte brut ou un corps vide", async () => {
    expect(await extractApiError(fakeResponse(502, "Bad Gateway"), SIGNUP_GENERIC_ERROR)).toBe(SIGNUP_GENERIC_ERROR);
    expect(await extractApiError(fakeResponse(500, ""), SIGNUP_GENERIC_ERROR)).toBe(SIGNUP_GENERIC_ERROR);
  });

  it("gère les 429 avec ou sans corps JSON", async () => {
    const withBody = fakeResponse(429, JSON.stringify({ error: "Trop de tentatives. Réessayez plus tard." }));
    expect(await extractApiError(withBody, SIGNUP_GENERIC_ERROR)).toBe("Trop de tentatives. Réessayez plus tard.");
    expect(await extractApiError(fakeResponse(429, "Too Many Requests"), SIGNUP_GENERIC_ERROR)).toBe(RATE_LIMIT_ERROR);
  });

  it("parseApiResponse renvoie les données en cas de succès, même avec un corps vide", async () => {
    const ok = await parseApiResponse<{ requiresTwoFactor?: boolean }>(
      fakeResponse(200, JSON.stringify({ requiresTwoFactor: true })),
      SIGNIN_GENERIC_ERROR
    );
    expect(ok).toEqual({ ok: true, status: 200, data: { requiresTwoFactor: true } });
    const empty = await parseApiResponse(fakeResponse(201, ""), SIGNUP_GENERIC_ERROR);
    expect(empty).toEqual({ ok: true, status: 201, data: {} });
  });

  it("parseApiResponse renvoie un message affichable en cas d'échec HTML", async () => {
    const result = await parseApiResponse(fakeResponse(500, "<html></html>"), SIGNUP_GENERIC_ERROR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(SIGNUP_GENERIC_ERROR);
  });
});

describe("registerSchema", () => {
  const base = { name: "Anna Schmidt", email: "anna@example.de", password: "Sommerferien2026" };

  it.each(["+49 1515 0000000", "+4915150000000"])("accepte le numéro international %s", (phone) => {
    const result = registerSchema.safeParse({ ...base, phone });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe(phone);
  });

  it("accepte l'absence de téléphone", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejette un nom d'un seul caractère", () => {
    const result = registerSchema.safeParse({ ...base, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Le nom doit contenir au moins 2 caractères");
    }
  });
});

describe("traductions des erreurs du parcours d'inscription", () => {
  const SIGNUP_ERROR_MESSAGES = [
    // src/lib/auth/password.ts
    "Le mot de passe doit contenir au moins 12 caractères",
    "Le mot de passe est trop long",
    "Ajoutez une lettre minuscule",
    "Ajoutez une lettre majuscule",
    "Ajoutez un chiffre",
    "Choisissez un mot de passe moins courant",
    // src/lib/auth/register-schema.ts
    "Le nom doit contenir au moins 2 caractères",
    "Email invalide",
    // src/app/api/auth/register/route.ts
    "Trop de tentatives. Réessayez plus tard.",
    "Impossible de créer le compte. Vérifiez vos informations.",
    "Une erreur est survenue lors de la création du compte",
    // src/lib/auth/api-error.ts
    SIGNUP_GENERIC_ERROR,
    SIGNIN_GENERIC_ERROR,
    NETWORK_ERROR,
    RATE_LIMIT_ERROR,
  ];

  it.each(SIGNUP_ERROR_MESSAGES)("« %s » est traduit en anglais et en espagnol", (message) => {
    const en = translateFrenchText(message, "en");
    const es = translateFrenchText(message, "es");
    expect(en).not.toBe(message);
    expect(es).not.toBe(message);
    expect(en.trim()).not.toBe("");
    expect(es.trim()).not.toBe("");
  });
});

describe("/booking : identifiants d'animaux stables", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/booking/page.tsx"), "utf8");

  it("activePetIds et simulatedPets sont mémoïsés", () => {
    expect(source).toMatch(/const simulatedPets = useMemo\(/);
    expect(source).toMatch(/const activePetIds = useMemo\(/);
    expect(source).not.toMatch(/const activePetIds = isSimulationMode \?/);
  });

  it("la synchronisation des configs passe par syncPetConfigs", () => {
    expect(source).toMatch(/setPetConfigs\(\(currentConfigs\) =>\s*syncPetConfigs/);
  });

  it("les liens d'authentification utilisent AuthLink", () => {
    expect(source).not.toMatch(/<Link\s+href="\/auth\/sign(up|in)/);
    expect(source.match(/<AuthLink\s+href="\/auth\/sign(up|in)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
