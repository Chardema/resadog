// Module pur (aucune API Node) : importable depuis les composants client
// (AppNav, Footer) comme depuis la page, le sitemap et les tests.

export const ABOUT_PAGE_PATH = "/a-propos";

export type AboutPagePhoto = { src: string; alt: string; width: number; height: number };

// ─────────────────────────────────────────────────────────────────────────────
// CONTENU À VALIDER PAR CHRISTOPHER
// Tant que l'une de ces deux constantes vaut `null`, la page /a-propos n'est pas
// publiée : noindex, absente du sitemap, aucun lien dans le menu ni le pied de
// page, et ni photo ni texte personnel affichés (aucun emplacement réservé).
// Dès que LES DEUX sont renseignées, tout se réactive sans autre modification.
// - Photo : déposer le fichier dans /public/images/ puis renseigner src, alt,
//   width et height (ex. { src: "/images/megane.webp", alt: "…", width: 800, height: 1000 }).
// - Texte : un paragraphe par entrée du tableau, en français. Penser ensuite à
//   ajouter les traductions EN/ES (npm run check:translations).
// ─────────────────────────────────────────────────────────────────────────────
// `as` évite que TypeScript réduise le type à `null` tant que rien n'est renseigné.
export const MEGANE_PHOTO = null as AboutPagePhoto | null;
export const MEGANE_PERSONAL_TEXT = null as string[] | null;

const isValidPhoto = (photo: AboutPagePhoto | null | undefined): photo is AboutPagePhoto =>
  !!photo &&
  photo.src.trim().length > 0 &&
  photo.alt.trim().length > 0 &&
  Number.isFinite(photo.width) && photo.width > 0 &&
  Number.isFinite(photo.height) && photo.height > 0;

/**
 * Contenu personnel de la page, ou `null` tant que la photo ET le texte
 * (au moins un paragraphe non vide) ne sont pas tous deux renseignés.
 */
export function getPublishedAboutPageContent(
  photo: AboutPagePhoto | null = MEGANE_PHOTO,
  text: string[] | null = MEGANE_PERSONAL_TEXT,
): { photo: AboutPagePhoto; paragraphs: string[] } | null {
  const paragraphs = (text ?? []).filter((paragraph) => paragraph.trim().length > 0);
  if (!isValidPhoto(photo) || paragraphs.length === 0) return null;
  return { photo, paragraphs };
}

export function isAboutPagePublished(
  photo: AboutPagePhoto | null = MEGANE_PHOTO,
  text: string[] | null = MEGANE_PERSONAL_TEXT,
): boolean {
  return getPublishedAboutPageContent(photo, text) !== null;
}

/** Options robots à passer à buildMetadata pour la page /a-propos. */
export function getAboutPageRobotsOptions(published = isAboutPagePublished()): { noIndex: boolean } {
  return { noIndex: !published };
}

/** Retire /a-propos d'une liste de routes (sitemap) tant que la page n'est pas publiée. */
export function filterAboutPageRoutes<T extends { path: string }>(
  routes: readonly T[],
  published = isAboutPagePublished(),
): T[] {
  return published ? [...routes] : routes.filter((route) => route.path !== ABOUT_PAGE_PATH);
}

/** Retire les liens vers /a-propos (menu, pied de page) tant que la page n'est pas publiée. */
export function filterAboutPageLinks<T extends { href: string }>(
  links: readonly T[],
  published = isAboutPagePublished(),
): T[] {
  return published ? [...links] : links.filter((link) => link.href !== ABOUT_PAGE_PATH);
}
