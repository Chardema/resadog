import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { metadata as aboutPageMetadata } from "@/app/a-propos/page";
import {
  ABOUT_PAGE_PATH,
  MEGANE_PERSONAL_TEXT,
  MEGANE_PHOTO,
  filterAboutPageLinks,
  filterAboutPageRoutes,
  getAboutPageRobotsOptions,
  getPublishedAboutPageContent,
  isAboutPagePublished,
  type AboutPagePhoto,
} from "@/lib/about-page";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

const rootDir = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(rootDir, relPath), "utf8");

const validPhoto: AboutPagePhoto = {
  src: "/images/megane.webp",
  alt: "Mégane avec un chien dans son appartement",
  width: 800,
  height: 1000,
};
const validText = ["Bonjour, je suis Mégane."];

const sampleRoutes = [{ path: "/" }, { path: "/tarifs" }, { path: ABOUT_PAGE_PATH }, { path: "/concept" }];
const sampleNavLinks = [
  { href: "/#services", label: "Services" },
  { href: ABOUT_PAGE_PATH, label: "À propos" },
  { href: "/#nous-trouver", label: "Contact" },
];
const sampleFooterLinks = [{ href: ABOUT_PAGE_PATH, label: "À propos de Mégane" }];
const aboutUrl = absoluteUrl(ABOUT_PAGE_PATH);

describe("Page /a-propos : publication conditionnée à la photo ET au texte de Mégane", () => {
  it("état non publié (constantes null) : noindex, hors sitemap, sans liens ni pastille « à valider »", () => {
    // État actuel du dépôt.
    expect(MEGANE_PHOTO).toBeNull();
    expect(MEGANE_PERSONAL_TEXT).toBeNull();
    expect(isAboutPagePublished()).toBe(false);
    expect(getPublishedAboutPageContent()).toBeNull();

    // Une seule des deux constantes renseignée (ou texte vide) ne suffit pas.
    expect(isAboutPagePublished(validPhoto, null)).toBe(false);
    expect(isAboutPagePublished(null, validText)).toBe(false);
    expect(isAboutPagePublished(validPhoto, [])).toBe(false);
    expect(isAboutPagePublished(validPhoto, ["   "])).toBe(false);
    expect(isAboutPagePublished({ ...validPhoto, src: "" }, validText)).toBe(false);

    // Sitemap réel : aucune URL /a-propos.
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).not.toContain(aboutUrl);
    expect(urls.some((url) => url.includes("/a-propos"))).toBe(false);
    expect(urls).toContain(absoluteUrl("/tarifs"));
    expect(filterAboutPageRoutes(sampleRoutes, false).map((route) => route.path)).toEqual(["/", "/tarifs", "/concept"]);

    // Menu et pied de page : liens filtrés par le helper.
    expect(filterAboutPageLinks(sampleNavLinks).map((link) => link.href)).toEqual(["/#services", "/#nous-trouver"]);
    expect(filterAboutPageLinks(sampleFooterLinks)).toEqual([]);
    const appNav = readSource("src/components/layout/AppNav.tsx");
    const footer = readSource("src/components/layout/Footer.tsx");
    expect(appNav).toMatch(/const publicLinks: NavLink\[\] = filterAboutPageLinks\(\[[\s\S]*?\{ href: ABOUT_PAGE_PATH, label: "À propos" \}[\s\S]*?\]\);/);
    expect(appNav).not.toContain('href: "/a-propos"');
    expect(footer).toContain(
      'const aboutPageFooterLinks = filterAboutPageLinks([{ href: ABOUT_PAGE_PATH, label: "À propos de Mégane" }]);'
    );
    expect(footer).toContain("{aboutPageFooterLinks.map(");
    expect(footer).not.toContain('href="/a-propos"');

    // Metadata réelle de la page : noindex, canonical conservé.
    expect(getAboutPageRobotsOptions()).toEqual({ noIndex: true });
    expect(aboutPageMetadata.robots).toMatchObject({ index: false, follow: true });
    expect(aboutPageMetadata.alternates?.canonical).toBe(ABOUT_PAGE_PATH);

    // Source de la page : aucun placeholder inachevé.
    const page = readSource("src/app/a-propos/page.tsx");
    for (const forbidden of ["à valider", "data-a-valider", "Emplacement réservé", "border-dashed"]) {
      expect(page).not.toContain(forbidden);
    }
    expect(page).toContain("...getAboutPageRobotsOptions()");
    expect(page).toContain("const content = getPublishedAboutPageContent();");
    expect(page).toMatch(/\{content && \(\s*<section/);
    expect(page).toContain("Diplômée ACACED");
  });

  it("état publié (photo et texte valides) : index, dans le sitemap, liens menu et pied de page présents", () => {
    expect(isAboutPagePublished(validPhoto, validText)).toBe(true);
    expect(getPublishedAboutPageContent(validPhoto, ["", ...validText])).toEqual({
      photo: validPhoto,
      paragraphs: validText,
    });

    const published = isAboutPagePublished(validPhoto, validText);

    // Sitemap : même filtrage que src/app/sitemap.ts, /a-propos conservée.
    expect(readSource("src/app/sitemap.ts")).toContain("...filterAboutPageRoutes(publicRoutes).map(");
    expect(filterAboutPageRoutes(sampleRoutes, published).map((route) => route.path)).toContain(ABOUT_PAGE_PATH);

    // Menu et pied de page : lien /a-propos présent.
    expect(filterAboutPageLinks(sampleNavLinks, published)).toEqual(sampleNavLinks);
    expect(filterAboutPageLinks(sampleFooterLinks, published)).toEqual(sampleFooterLinks);

    // Robots : noIndex false → index/follow, canonical conservé.
    const robotsOptions = getAboutPageRobotsOptions(published);
    expect(robotsOptions).toEqual({ noIndex: false });
    const publishedMetadata = buildMetadata({
      title: "À propos de Mégane",
      description: "Test",
      path: ABOUT_PAGE_PATH,
      ...robotsOptions,
    });
    expect(publishedMetadata.robots).toMatchObject({ index: true, follow: true });
    expect(publishedMetadata.alternates?.canonical).toBe(ABOUT_PAGE_PATH);
  });
});
