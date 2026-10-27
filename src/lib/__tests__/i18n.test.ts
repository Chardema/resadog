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


  it("translates all Chantier 2 booking simulation, stepper, mobile sticky bar and homepage CTA strings into EN and ES", () => {
    const chantier2Strings = [
      "1. Compagnon & Service",
      "2. Dates & Disponibilités",
      "3. Récapitulatif",
      "Simulation & disponibilités en accès libre",
      "Simuler un tarif rapide",
      "Mes compagnons enregistrés",
      "Chien adulte",
      "Chiot",
      "Chat adulte",
      "Chaton",
      "1 an et +",
      "Moins d'1 an (+5 €/période)",
      "Choisir les dates →",
      "Voir le récapitulatif →",
      "Payer & confirmer",
      "Continuer & réserver →",
      "Vos dates sont disponibles",
      "Créez votre compte gratuit en 1 minute pour enregistrer votre compagnon et confirmer ces dates",
      "Créer mon compte & continuer →",
      "J'ai déjà un compte",
      "Prêt à planifier le séjour de votre compagnon ?",
      "Vérifiez nos disponibilités en temps réel et simulez votre tarif exact selon vos horaires en moins d'une minute, avant même de créer votre compte.",
      "Vérifier les disponibilités & tarifs",
    ];

    for (const s of chantier2Strings) {
      const en = translateFrenchText(s, "en");
      const es = translateFrenchText(s, "es");
      expect(en, `Missing EN for: ${s}`).not.toBe(s);
      expect(es, `Missing ES for: ${s}`).not.toBe(s);
    }
  });

  it("passes scripts/generate-translations.mjs --check with 100% coverage", () => {
    const output = execFileSync("node", ["scripts/generate-translations.mjs", "--check"], {
      encoding: "utf8",
    });
    expect(output).toMatch(/Translation coverage OK: \d+\/\d+ source strings\./);
  });

  it("translates all Chantier 3 home services, SSR reviews, local SEO and loyalty strings into EN and ES", () => {
    const chantier3Strings = [
      "Nos prestations & tarifs",
      "Une garde familiale attentive, sans box ni chenil. Choisissez un service pour simuler votre tarif exact selon vos dates et horaires.",
      "Chez nous · Nuit incluse",
      "-10 % dès 14 périodes",
      "Hébergement familial (24 h)",
      "Votre compagnon vit à la maison avec nous et profite du jardin clos, des sorties et d’une présence rassurante jour et nuit, avec photos chaque jour.",
      "Compteur 24 h dès l’heure de dépôt",
      "Simuler un séjour →",
      "Chez nous · Journée jusqu’à 10 h",
      "Idéal journée Disneyland Paris",
      "Accueil dès 6h30 à 10 minutes des parcs Disney : jeux au jardin, repos au calme et compagnie continue jusqu’à 10 h de garde en journée.",
      "Dépose dès 6h30 · Retour jusqu’à 20h30",
      "Réserver une journée →",
      "Chez vous · Présence prolongée",
      "Dès 40 € / jour",
      "Nous veillons sur vos animaux directement chez vous pour préserver toutes leurs habitudes (paliers jusqu’à 6 h, 10 h ou +10 h).",
      "Choisir mes horaires →",
      "Chez vous · 30 min à 2 h",
      "Chien 16 € · Chat 15 €",
      "Repas, eau fraîche, litière, câlins et nouvelles en photo à chaque passage (2 chats inclus au tarif de base).",
      "Composer mes visites →",
      "Autour de chez vous · 30 min à 2 h",
      "Dès 15 € / 30 min",
      "Promenades chien",
      "Balade attentive au rythme de votre chien autour de votre domicile, avec compte-rendu et photo au retour.",
      "Planifier une balade →",
      "Tarif calculé à la durée réelle : le compteur démarre à l’heure de dépôt (aucune double facturation au passage de minuit). Supplément chiot/chaton (< 1 an) : +5 €.",
      "Détail des tarifs & remises",
      "Simuler mon prix",
      "avis vérifiés",
      "Communes desservies autour de Bussy-Saint-Georges & Val d’Europe",
      "Nos gardes par besoin en Seine-et-Marne (77)",
      "Fidélité & Avantages Premium",
      "Chaque séjour récompense votre fidélité",
      "Gagnez gratuitement 1 Patte par euro dépensé dès votre première garde (jusqu’à 24 € de remise fidélité). Besoin de gardes régulières ? L’abonnement Premium offre -10 % jusqu’à 20 € par réservation, les Pattes doublées et la priorité vacances.",
      "Découvrir le programme Pattes",
      "Voir les avantages Premium",
      "-10 % Bienvenue",
      "Code BIENVENUE10 sur votre 1re réservation",
      "1 € = 1 Patte",
      "Jusqu’à 24 € de remise fidélité cumulable",
      "Premium -10 %",
      "Jusqu’à 20 € de remise par réservation",
      "Pattes doublées & accès prioritaire aux périodes fortes",
    ];

    for (const s of chantier3Strings) {
      const en = translateFrenchText(s, "en");
      const es = translateFrenchText(s, "es");
      expect(en, `Missing EN for: ${s}`).not.toBe(s);
      expect(es, `Missing ES for: ${s}`).not.toBe(s);
    }
  });
});
