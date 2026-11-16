// Vérifie le SEO de la page 404 et le canonical de l'accueil sur un serveur
// de production local :
//   npm run build && npx next start -p 3102
//   node scripts/check-404-seo.mjs            (BASE_URL=http://localhost:3102 par défaut)
//
// Équivalent curl :
//   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3102/page-inexistante-audit-suivi
//   curl -s http://localhost:3102/page-inexistante-audit-suivi | grep -oE '<meta[^>]*name="robots"[^>]*>|<link[^>]*rel="canonical"[^>]*>'
//   curl -s http://localhost:3102/ | grep -oE '<link[^>]*rel="canonical"[^>]*>'

const baseUrl = (process.env.BASE_URL || "http://localhost:3102").replace(/\/$/, "");
const unknownPath = "/page-inexistante-audit-suivi";

const robotsTags = (html) => html.match(/<meta\b[^>]*name="(?:robots|googlebot)"[^>]*>/gi) ?? [];
const canonicalTags = (html) => html.match(/<link\b[^>]*rel="canonical"[^>]*>/gi) ?? [];

// Racine du site quelle que soit l'origine : « https://x.fr/ », « https://x.fr » ou « / ».
function pointsToRoot(tag) {
  const href = tag.match(/\bhref="([^"]*)"/i)?.[1];
  if (href === undefined) return false;
  try {
    return new URL(href, baseUrl).pathname === "/";
  } catch {
    return false;
  }
}

const failures = [];
function check(condition, message) {
  console.log(`${condition ? "OK  " : "FAIL"} ${message}`);
  if (!condition) failures.push(message);
}

const notFound = await fetch(`${baseUrl}${unknownPath}`, { redirect: "manual" });
const notFoundHtml = await notFound.text();
const notFoundRobots = robotsTags(notFoundHtml);
const notFoundCanonicals = canonicalTags(notFoundHtml);
console.log(`${unknownPath} → HTTP ${notFound.status}`);
console.log(`  robots : ${notFoundRobots.join(" ") || "(aucune)"}`);
console.log(`  canonical : ${notFoundCanonicals.join(" ") || "(aucun)"}`);
check(notFound.status === 404, "URL inconnue en HTTP 404");
check(notFoundRobots.length === 1, "une seule balise robots/googlebot sur la 404");
check(
  notFoundRobots.length === 1 && /noindex/i.test(notFoundRobots[0]) && !/nofollow/i.test(notFoundRobots[0]),
  "balise robots noindex sans nofollow (follow implicite)"
);
check(notFoundCanonicals.length === 0, "aucun <link rel=\"canonical\"> sur la 404");

const home = await fetch(`${baseUrl}/`, { redirect: "manual" });
const homeHtml = await home.text();
const homeCanonicals = canonicalTags(homeHtml);
console.log(`/ → HTTP ${home.status}`);
console.log(`  canonical : ${homeCanonicals.join(" ") || "(aucun)"}`);
check(home.status === 200, "accueil en HTTP 200");
check(
  homeCanonicals.length === 1 && pointsToRoot(homeCanonicals[0]),
  "accueil : un seul canonical vers /"
);
check(!robotsTags(homeHtml).some((tag) => /noindex/i.test(tag)), "accueil indexable");

if (failures.length > 0) {
  console.error(`\n${failures.length} critère(s) en échec.`);
  process.exit(1);
}
console.log("\nSEO 404 OK.");
