import { describe, expect, it } from "vitest";
import { metadata } from "@/app/not-found";
import { translateFrenchText } from "@/lib/i18n";

describe("metadata de la page 404", () => {
  it("a un titre absolu, sans doublon du template du layout", () => {
    expect(metadata.title).toEqual({ absolute: "Page introuvable | La Patte Dorée" });
  });

  it("a sa propre description", () => {
    expect(metadata.description).toBe(
      "Cette page n'existe pas ou a été déplacée. Retrouvez la garde d'animaux de La Patte Dorée depuis l'accueil.",
    );
  });

  it("n'hérite pas de l'OpenGraph ni du Twitter de l'accueil (aucun og:url)", () => {
    expect(metadata.openGraph).toBeNull();
    expect(metadata.twitter).toBeNull();
  });

  it("garde le noindex injecté par Next seul et aucun canonical", () => {
    // robots: null retire le « index, follow » du layout ; Next ajoute le
    // seul <meta name="robots" content="noindex"> des réponses 404.
    expect(metadata.robots).toBeNull();
    expect(metadata.alternates).toEqual({ canonical: null });
  });

  it("titre traduit côté client en EN/ES", () => {
    expect(translateFrenchText("Page introuvable | La Patte Dorée", "en")).toBe("Page not found | La Patte Dorée");
    expect(translateFrenchText("Page introuvable | La Patte Dorée", "es")).toBe("Página no encontrada | La Patte Dorée");
  });
});
