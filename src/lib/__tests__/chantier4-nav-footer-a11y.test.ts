import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_BUG_REPORT_EVENT } from "@/components/layout/BetaBanner";
import { GOOGLE_MAPS_PLACE_URL } from "@/lib/google-reviews";
import { LEGAL_INFORMATION } from "@/lib/legal";
import {
  absoluteUrl,
  getLocalBusinessJsonLd,
  getLocalServiceJsonLd,
  localSeoPages,
} from "@/lib/seo";

const rootDir = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(rootDir, relPath), "utf8");

describe("Chantier 4 UI/UX: Navigation, visitor footer, mobile floating pills, NAP/JSON-LD, WCAG AA & real GBP photos", () => {
  it("enriches getLocalBusinessJsonLd with email, hasMap, og-image.jpg, addressRegion, openingHoursSpecification and removes knowsAbout", () => {
    const jsonLd = getLocalBusinessJsonLd();

    expect(jsonLd.email).toBe(LEGAL_INFORMATION.contactEmail);
    expect(jsonLd.hasMap).toBe(GOOGLE_MAPS_PLACE_URL);
    expect(jsonLd.image).toBe(absoluteUrl("/og-image.jpg"));
    expect(jsonLd.logo).toBe(absoluteUrl("/logo-mark.png"));
    expect(jsonLd.address.addressRegion).toBe("Île-de-France");
    expect("knowsAbout" in jsonLd).toBe(false);
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

  it("includes og-image.jpg on Service and provider in getLocalServiceJsonLd for all 6 French local SEO pages", () => {
    expect(localSeoPages).toHaveLength(6);
    for (const page of localSeoPages) {
      const serviceJsonLd = getLocalServiceJsonLd(page);
      expect(serviceJsonLd.image).toBe(absoluteUrl("/og-image.jpg"));
      expect(serviceJsonLd.provider.image).toBe(absoluteUrl("/og-image.jpg"));
    }
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

  it("integrates real GBP hero photo, og-image.jpg and 6-photo PhotoGallerySection on home page and local/Disney SEO pages", () => {
    const homeSource = readSource("src/components/home/HomePageClient.tsx");
    expect(homeSource).toContain(`const HERO_PHOTO_SRC = "/images/hero-famille.webp";`);
    expect(homeSource).toContain(
      `alt="Cavalier King Charles endormi paisiblement dans un fauteuil chez La Patte Dorée à Bussy-Saint-Georges"`
    );
    expect(homeSource).toContain("<PhotoGallerySection />");

    const gallerySource = readSource("src/components/home/PhotoGallerySection.tsx");
    expect(gallerySource).toContain("Nos pensionnaires comme à la maison");
    expect(gallerySource).toContain("grid-cols-2 md:grid-cols-3 gap-4");
    expect(gallerySource).toContain("@lapatte_doree");

    const localSeoSource = readSource("src/app/(local-seo)/[slug]/page.tsx");
    expect(localSeoSource).toContain("/images/hero-famille.webp");
    expect(localSeoSource).toContain("/images/galerie/chat-tigre-canape.webp");
    expect(localSeoSource).toContain("/images/galerie/chat-soleil-jardin.webp");
    expect(localSeoSource).toContain("/images/galerie/salon-chien-chat.webp");
    expect(localSeoSource).toContain("/images/galerie/jardin-golden.webp");
    expect(localSeoSource).toContain("/images/galerie/balade-golden-creme.webp");
    expect(localSeoSource).toContain("/images/galerie/interieur-chien-noir.webp");
    expect(localSeoSource).toContain("grid-cols-1 sm:grid-cols-3 gap-4");

    const englishDisneySource = readSource("src/app/en/dog-boarding-disneyland-paris/page.tsx");
    expect(englishDisneySource).toContain("/images/hero-famille.webp");
    expect(englishDisneySource).toContain(
      "Cavalier King Charles Spaniel sleeping peacefully in an armchair at La Patte Dorée near Disneyland Paris"
    );
    expect(englishDisneySource).toContain("/images/galerie/jardin-golden.webp");
    expect(englishDisneySource).toContain("/images/galerie/balade-golden-creme.webp");
    expect(englishDisneySource).toContain("/images/galerie/interieur-chien-noir.webp");
    expect(englishDisneySource).toContain('absoluteUrl("/og-image.jpg")');
    expect(englishDisneySource).toContain("grid-cols-1 sm:grid-cols-3 gap-4");

    const expectedAssets = [
      "public/og-image.jpg",
      "public/images/hero-famille.webp",
      "public/images/galerie/salon-chien-chat.webp",
      "public/images/galerie/jardin-golden.webp",
      "public/images/galerie/balade-golden-creme.webp",
      "public/images/galerie/chat-soleil-jardin.webp",
      "public/images/galerie/interieur-chien-noir.webp",
      "public/images/galerie/chat-tigre-canape.webp",
    ];
    for (const relAsset of expectedAssets) {
      const fullPath = path.join(rootDir, relAsset);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(10_000);
    }
  });
  it("integrates real gallery photos on /tarifs, /concept and /subscriptions", () => {
    const tarifsSource = readSource("src/app/tarifs/page.tsx");
    expect(tarifsSource).toContain("PRICING_PHOTOS");
    expect(tarifsSource).toContain("/images/galerie/jardin-golden.webp");
    expect(tarifsSource).toContain("/images/galerie/chat-tigre-canape.webp");
    expect(tarifsSource).toContain("/images/galerie/balade-golden-creme.webp");
    expect(tarifsSource).toContain("Pension & Garderie chien");
    expect(tarifsSource).toContain("Pension & Visites chat");
    expect(tarifsSource).toContain("Promenades & Jardin clos");
    expect(tarifsSource).toContain("grid-cols-1 sm:grid-cols-3 gap-4");

    const conceptSource = readSource("src/app/concept/page.tsx");
    expect(conceptSource).toContain("CONCEPT_PHOTOS");
    expect(conceptSource).toContain("/images/hero-famille.webp");
    expect(conceptSource).toContain("/images/galerie/salon-chien-chat.webp");
    expect(conceptSource).toContain("/images/galerie/interieur-chien-noir.webp");
    expect(conceptSource).toContain("Maison familiale · Zéro box");
    expect(conceptSource).toContain("Cohabitation sereine");
    expect(conceptSource).toContain("Repos sans cage");
    expect(conceptSource).toContain("grid-cols-1 sm:grid-cols-3 gap-4");

    const subscriptionsSource = readSource("src/app/subscriptions/page.tsx");
    expect(subscriptionsSource).toContain("SUBSCRIPTION_PHOTOS");
    expect(subscriptionsSource).toContain("/images/galerie/jardin-golden.webp");
    expect(subscriptionsSource).toContain("/images/galerie/salon-chien-chat.webp");
    expect(subscriptionsSource).toContain("/images/galerie/chat-soleil-jardin.webp");
    expect(subscriptionsSource).toContain("Habitués du club");
    expect(subscriptionsSource).toContain("Comme à la maison");
    expect(subscriptionsSource).toContain("Priorité vacances");
    expect(subscriptionsSource).toContain("grid-cols-1 sm:grid-cols-3 gap-4");
  });

  it("wires all business check:* scripts and check:translations in .github/workflows/ci.yml and ignores semver-major in dependabot.yml", () => {
    const ciSource = readSource(".github/workflows/ci.yml");
    const expectedScripts = [
      "npm audit --omit=dev --audit-level=high",
      "npm run check:translations",
      "npm run lint",
      "npm run check:types",
      "npm run check:pricing",
      "npm run check:pets",
      "npm run check:payments",
      "npm run check:finance",
      "npm run check:attendance",
      "npm run check:direct-bookings",
      "npm run check:two-factor",
      "npm run check:quote-email",
      "npm test",
      "npm run build",
    ];
    for (const script of expectedScripts) {
      expect(ciSource).toContain(script);
    }

    const dependabotSource = readSource(".github/dependabot.yml");
    expect(dependabotSource).toContain("version-update:semver-major");
    expect(dependabotSource).not.toContain("npm-major");
  });
  it("configures Google Search Console verification meta tag in layout.tsx and static HTML file in public/", () => {
    const layoutSource = readSource("src/app/layout.tsx");
    expect(layoutSource).toContain("verification:");
    expect(layoutSource).toContain(`google: "sDOJLIyeftnYcYjz2Sh_Oa_-NajprtUwAmtlWfiI8Gk"`);

    const gscHtml = readSource("public/google742954b21c94a53b.html");
    expect(gscHtml.trim()).toBe("google-site-verification: google742954b21c94a53b.html");
  });
});
