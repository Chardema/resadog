import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { translateFrenchText } from "@/lib/i18n";
import { localSeoPages } from "@/lib/seo";

const HERO_STRINGS = [
  "· Avis vérifiés",
  "Garde familiale de chiens & chats près de Disneyland Paris,",
  "comme à la maison.",
  "Hébergement familial",
  "100 % sans box ni cage",
  ", garderie de jour, visites à domicile et promenades en Seine-et-Marne (77). Partez l’esprit tranquille avec des photos et nouvelles chaque jour.",
  "Vérifier mes dates & simuler mon tarif",
  "Accéder à mon espace",
  "Découvrir les services & tarifs",
  "Tarif calculé à la durée réelle",
  "Consignes santé & habitudes vérifiées avant chaque garde",
  "Cadre 100 % familial",
  "Maison & suivi personnalisé",
  "Dès",
  "Dès 35 €",
  "Zéro box, zéro cage",
  "Votre compagnon vit avec nous dans la maison, à son rythme, avec sorties et moments de jeu adaptés.",
  "Photos & nouvelles quotidiennes",
  "Vous suivez son séjour chaque jour pendant votre visite à Disneyland Paris ou vos vacances.",
  "Titulaire ACACED Chien & Chat",
  "Certificat officiel de capacité, vérification du carnet de santé et respect strict des consignes.",
  "Bussy-Saint-Georges · à 10 min des parcs Disney",
  "Lire les avis →",
  "Qualifié ACACED",
  "Chien & chat certifié",
  "100 % sans box",
  "Cadre familial calme",
  "Suivi quotidien",
  "Photos & nouvelles",
  "Note 5,0 / 5",
  "Voir les avis clients →",
];

describe("i18n translations & word boundary safety", () => {
  it("never replaces short catalogue entries inside words (no intra-word corruption)", () => {
    const samples = [
      "Garde familiale",
      "Maison",
      "nouvelles",
      "séjour",
      "parcs",
      "Page introuvable",
      "x-default",
      "unauthenticated",
      "lg:hidden",
      "Garde inconnue dans une Maison avec nouvelles du séjour aux parcs",
    ];

    for (const sample of samples) {
      const en = translateFrenchText(sample, "en");
      const es = translateFrenchText(sample, "es");

      expect(en).not.toMatch(/Garof|Mayson|nOrvelles|séday|bycs|intrOrvable|offAtlt|unAtthenticated|hidofn/);
      expect(es).not.toMatch(/mayoson|nOvelles|sédía|porcs|intrOvable|defEnlt|unEnthenticated/);
    }
  });

  it("translates all Hero strings cleanly into English and Spanish without Franglais", () => {
    for (const source of HERO_STRINGS) {
      const en = translateFrenchText(source, "en");
      const es = translateFrenchText(source, "es");

      expect(en).not.toBe(source);
      expect(es).not.toBe(source);
      expect(en).not.toMatch(/Garof|Mayson|nOrvelles|séday|bycs|guardrie|habituofs|ofs\b/);
      expect(es).not.toMatch(/mayoson|nOvelles|sédía|porcs|guardiarie/);
    }

    expect(translateFrenchText("Dès", "en")).toBe("From");
    expect(translateFrenchText("Dès", "es")).toBe("Desde");
    expect(translateFrenchText("Note 5,0 / 5", "en")).toBe("Rated 5.0 / 5");
    expect(translateFrenchText("Note 5,0 / 5", "es")).toBe("Nota 5,0 / 5");
  });

  it("translates all localSeoPages strings cleanly into English and Spanish", () => {
    for (const page of localSeoPages) {
      const fields = [
        page.title,
        page.metaTitle,
        page.description,
        page.eyebrow,
        page.lead,
        page.intent,
        page.ctaLabel,
        ...page.proofPoints,
        ...page.services.flatMap((s) => [s.title, s.text]),
        ...page.sections.flatMap((sec) => [sec.title, sec.body, ...sec.bullets]),
        ...page.faqs.flatMap((f) => [f.question, f.answer]),
      ];

      for (const field of fields) {
        const en = translateFrenchText(field, "en");
        const es = translateFrenchText(field, "es");

        expect(en, `Missing EN translation for SEO field: ${field}`).not.toBe(field);
        expect(es, `Missing ES translation for SEO field: ${field}`).not.toBe(field);
        expect(en).not.toMatch(/Garof|Mayson|nOrvelles|séday|bycs|animAtx/);
        expect(es).not.toMatch(/mayoson|nOvelles|sédía|porcs|animEnx/);
      }
    }
  });

  it("passes scripts/generate-translations.mjs --check with 100% coverage", () => {
    const output = execFileSync("node", ["scripts/generate-translations.mjs", "--check"], {
      encoding: "utf8",
    });
    expect(output).toMatch(/Translation coverage OK: \d+\/\d+ source strings\./);
  });
});
