import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ADDITIONAL_CHARGES_ENABLED } from "@/lib/additional-charges";

// Plan acompte (spec 07, lot 8) : la carte enregistrée pour le solde
// (Payment.stripePaymentMethodId) ne sert qu'au solde. Aucun supplément ne
// peut la débiter, et le débit hors session de suppléments reste neutralisé.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ADDITIONAL_CHARGES_ROUTE = "src/app/api/admin/additional-charges/route.ts";
const BALANCE_COLLECTION = "src/lib/balance-collection.ts";

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : listSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [relative(ROOT, path)] : [];
  });
}

const sources = listSourceFiles(SRC).map((file) => ({
  file,
  code: readFileSync(join(ROOT, file), "utf8"),
}));
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

describe("carte du solde et suppléments", () => {
  it("garde le débit automatique des suppléments désactivé", () => {
    expect(ADDITIONAL_CHARGES_ENABLED).toBe(false);
  });

  it("ne débite hors session que le solde et la route de supplément neutralisée", () => {
    const offSessionCharges = sources
      .filter(({ code }) => /off_session:\s*true/.test(code))
      .map(({ file }) => file)
      .sort();
    expect(offSessionCharges).toEqual([ADDITIONAL_CHARGES_ROUTE, BALANCE_COLLECTION].sort());
  });

  it("refuse le supplément avant tout appel Stripe dans la route", () => {
    const code = read(ADDITIONAL_CHARGES_ROUTE);
    const gate = code.indexOf("if (!ADDITIONAL_CHARGES_ENABLED)");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(code.indexOf("stripe.paymentIntents.create"));
    expect(gate).toBeLessThan(code.indexOf("prisma.additionalCharge.createMany"));
  });

  it("n'utilise jamais la carte enregistrée pour le solde dans un supplément", () => {
    const route = read(ADDITIONAL_CHARGES_ROUTE);
    expect(route).not.toMatch(/stripePaymentMethodId/);
    expect(route).not.toMatch(/bookingInstallment|balance-collection|booking-balance/);

    const readers = sources
      .filter(({ code }) => /stripePaymentMethodId/.test(code))
      .map(({ file }) => file)
      .sort();
    expect(readers).toEqual(
      ["src/app/api/stripe/webhook/route.ts", BALANCE_COLLECTION, "src/lib/booking-balance.ts"].sort()
    );
  });

  it("ne crée aucun supplément depuis le prélèvement du solde", () => {
    const balance = read(BALANCE_COLLECTION);
    expect(balance).not.toMatch(/additionalCharge|additional_charge/);
    expect(balance).toMatch(/metadata: getBalancePaymentMetadata\(/);
  });

  it("n'expose aucun écran appelant l'API de supplément", () => {
    const callers = sources
      .filter(({ file, code }) => file !== ADDITIONAL_CHARGES_ROUTE && code.includes("/api/admin/additional-charges"))
      .map(({ file }) => file);
    expect(callers).toEqual([]);

    const writers = sources
      .filter(({ code }) => /additionalCharge\.(create|createMany|upsert)\b/.test(code))
      .map(({ file }) => file);
    expect(writers).toEqual([ADDITIONAL_CHARGES_ROUTE]);
  });
});
