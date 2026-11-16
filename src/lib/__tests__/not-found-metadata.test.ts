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

  it("déclare un noindex explicite, sans googleBot, et aucun canonical", () => {
    // Sur Vercel, Next n'injecte pas de noindex dans la 404 : la balise doit
    // venir des metadata. Elle remplace le « index, follow » et le googleBot
    // du layout.
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: null });
  });

  it("titre traduit côté client en EN/ES", () => {
    expect(translateFrenchText("Page introuvable | La Patte Dorée", "en")).toBe("Page not found | La Patte Dorée");
    expect(translateFrenchText("Page introuvable | La Patte Dorée", "es")).toBe("Página no encontrada | La Patte Dorée");
  });

  it("description traduite côté client en EN/ES", () => {
    const description = metadata.description as string;
    expect(translateFrenchText(description, "en")).toBe(
      "This page does not exist or has been moved. Find La Patte Dorée pet care from the home page.",
    );
    expect(translateFrenchText(description, "es")).toBe(
      "Esta página no existe o ha sido movida. Encuentre el cuidado de mascotas de La Patte Dorée desde la página de inicio.",
    );
  });
});
