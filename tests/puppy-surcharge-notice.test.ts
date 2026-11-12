import { describe, expect, it } from "vitest";
import { translateFrenchText } from "@/lib/i18n";
import { PUPPY_SURCHARGE_NOTICE, YOUNG_ANIMAL_SURCHARGE } from "@/lib/pricing";

describe("PUPPY_SURCHARGE_NOTICE", () => {
  it("affiche le montant issu de YOUNG_ANIMAL_SURCHARGE", () => {
    expect(PUPPY_SURCHARGE_NOTICE).toContain(`+${YOUNG_ANIMAL_SURCHARGE} €`);
  });

  it("ne concerne que les chiots, en garderie et en hébergement", () => {
    expect(PUPPY_SURCHARGE_NOTICE).toMatch(/chiot/i);
    expect(PUPPY_SURCHARGE_NOTICE).toMatch(/garderie/i);
    expect(PUPPY_SURCHARGE_NOTICE).toMatch(/hébergement/i);
    expect(PUPPY_SURCHARGE_NOTICE).not.toMatch(/chaton/i);
  });

  it("est traduit en anglais et en espagnol avec le même montant, sans chaton", () => {
    const en = translateFrenchText(PUPPY_SURCHARGE_NOTICE, "en");
    const es = translateFrenchText(PUPPY_SURCHARGE_NOTICE, "es");
    expect(en).toContain(`+€${YOUNG_ANIMAL_SURCHARGE}`);
    expect(en).toMatch(/puppy/i);
    expect(en).not.toMatch(/kitten/i);
    expect(es).toContain(`+${YOUNG_ANIMAL_SURCHARGE} €`);
    expect(es).toMatch(/cachorro/i);
    expect(es).not.toMatch(/gatito/i);
  });
});
