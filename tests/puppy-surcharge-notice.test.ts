import { describe, expect, it } from "vitest";
import { translateFrenchText } from "@/lib/i18n";
import { PUPPY_SURCHARGE_NOTICE, YOUNG_ANIMAL_SURCHARGE } from "@/lib/pricing";
import { SIMULATOR_PET_CARDS } from "@/components/booking/simulatorPetCards";

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

describe("SIMULATOR_PET_CARDS", () => {
  const card = (key: string) => {
    const found = SIMULATOR_PET_CARDS.find((item) => item.key === key);
    if (!found) throw new Error(`Carte ${key} introuvable`);
    return found;
  };

  it("n'affiche aucun supplément sur la carte chaton, en FR, EN et ES", () => {
    const subtitle = card("kitten").subtitle;
    const en = translateFrenchText(subtitle, "en");
    const es = translateFrenchText(subtitle, "es");
    for (const text of [subtitle, en, es]) {
      expect(text).not.toContain(`+${YOUNG_ANIMAL_SURCHARGE}`);
      expect(text).not.toContain(`+€${YOUNG_ANIMAL_SURCHARGE}`);
      expect(text).not.toMatch(/€/);
    }
    expect(en).toBe("Under 1 year");
    expect(es).toBe("Menos de 1 año");
  });

  it("affiche le supplément YOUNG_ANIMAL_SURCHARGE sur la carte chiot, en FR, EN et ES", () => {
    const subtitle = card("puppy").subtitle;
    expect(subtitle).toBe(
      `Moins d'1 an (+${YOUNG_ANIMAL_SURCHARGE} € en garderie et hébergement)`
    );
    expect(translateFrenchText(subtitle, "en")).toBe(
      `Under 1 year (+€${YOUNG_ANIMAL_SURCHARGE} for day care and boarding)`
    );
    expect(translateFrenchText(subtitle, "es")).toBe(
      `Menos de 1 año (+${YOUNG_ANIMAL_SURCHARGE} € en guardería y alojamiento)`
    );
  });
});
