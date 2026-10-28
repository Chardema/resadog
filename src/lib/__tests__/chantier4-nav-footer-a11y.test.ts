import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_BUG_REPORT_EVENT } from "@/components/layout/BetaBanner";
import { GOOGLE_MAPS_PLACE_URL } from "@/lib/google-reviews";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { getLocalBusinessJsonLd } from "@/lib/seo";

const rootDir = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(rootDir, relPath), "utf8");

describe("Chantier 4 UI/UX: Navigation, visitor footer, mobile floating pills, NAP/JSON-LD & WCAG AA", () => {
  it("enriches getLocalBusinessJsonLd with email, hasMap, addressRegion and openingHoursSpecification", () => {
    const jsonLd = getLocalBusinessJsonLd();

    expect(jsonLd.email).toBe(LEGAL_INFORMATION.contactEmail);
    expect(jsonLd.hasMap).toBe(GOOGLE_MAPS_PLACE_URL);
    expect(jsonLd.address.addressRegion).toBe("Île-de-France");
    expect(jsonLd.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "07:00",
        closes: "21:00",
      },
    ]);
  });

  it("hides floating LanguageSwitcher on mobile (< 768px) and supports inline mode", () => {
    const source = readSource("src/components/layout/LanguageSwitcher.tsx");

    expect(source).toContain("{ inline = false }: { inline?: boolean }");
    expect(source).toContain("inline-flex shadow-sm");
    expect(source).toContain(
      "hidden md:flex fixed bottom-6 left-6 z-[55] shadow-xl shadow-gray-900/10"
    );
    expect(source).not.toContain("bottom-20 left-4");
  });

  it("exports OPEN_BUG_REPORT_EVENT and hides BetaBanner floating button on mobile (< 768px)", () => {
    expect(OPEN_BUG_REPORT_EVENT).toBe("resadog:open-bug-report");

    const source = readSource("src/components/layout/BetaBanner.tsx");
    expect(source).toContain("window.addEventListener(OPEN_BUG_REPORT_EVENT");
    expect(source).toContain("window.removeEventListener(OPEN_BUG_REPORT_EVENT");
    expect(source).toContain("hidden md:block fixed bottom-6 right-6 z-40");
    expect(source).not.toContain("bottom-20 right-3");
  });

  it("updates AppNav visitor primary CTA to /booking, embeds inline LanguageSwitcher in mobile menu and enforces WCAG AA contrast", () => {
    const source = readSource("src/components/layout/AppNav.tsx");

    expect(source).toContain(
      `? { href: "/booking", label: "Réserver" }`
    );
    expect(source).toContain("<LanguageSwitcher inline />");
    expect(source).toContain("text-[11px] font-semibold");
    expect(source).not.toContain("text-[10px]");
  });

  it("hides /dashboard and /pets in Footer for unauthenticated visitors and displays full NAP + bug report trigger", () => {
    const source = readSource("src/components/layout/Footer.tsx");

    expect(source).toContain("useSession");
    expect(source).toContain(`status === "authenticated"`);
    expect(source).toContain("77600 Bussy-Saint-Georges · Val d’Europe");
    expect(source).toContain("LEGAL_INFORMATION.phone");
    expect(source).toContain("LEGAL_INFORMATION.contactEmail");
    expect(source).toContain("LEGAL_INFORMATION.acaced.number");
    expect(source).toContain("<LanguageSwitcher inline />");
    expect(source).toContain("/auth/signin");
    expect(source).toContain("Connexion client");
    expect(source).toContain("OPEN_BUG_REPORT_EVENT");
    expect(source).toContain("Signaler un problème");
    expect(source).toContain("/garde-chien-disneyland-paris");
    expect(source).toContain("/pension-chien-77");
    expect(source).toContain("/garde-chien-77");
    expect(source).toContain("/garde-chat-77");
    expect(source).toContain("/visite-chat-domicile-77");
    expect(source).toContain("/garde-animaux-seine-et-marne");
    expect(source).toContain("/en/dog-boarding-disneyland-paris");
    expect(source).toContain("border-t border-gray-200");
    expect(source).not.toContain("text-gray-400");
  });

  it("displays explicit NAP line in LocationSection and enforces prefers-reduced-motion in globals.css", () => {
    const locSource = readSource("src/components/home/LocationSection.tsx");
    expect(locSource).toContain(
      "77600 Bussy-Saint-Georges (à 10 min de Disneyland Paris &amp; Val d’Europe) · Accueil 7j/7 sur réservation"
    );

    const cssSource = readSource("src/app/globals.css");
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssSource).toContain("animation-duration: 0.01ms !important;");
    expect(cssSource).toContain("transition-duration: 0.01ms !important;");
  });
});
