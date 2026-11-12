// Critère RGPD de l'accueil : aucune requête Google avant un choix explicite.
//
// Prérequis (une fois) : npm i -D @playwright/test@1.65   (navigateurs déjà
// présents dans ~/Library/Caches/ms-playwright, sinon npx playwright install chromium)
//
// Usage :
//   npm run build
//   node scripts/check-maps-consent.mjs
//
// Le script lance lui-même `next start -p 3102` puis l'arrête à la fin.
// Pour viser un serveur déjà démarré : BASE_URL=http://localhost:3102 node scripts/check-maps-consent.mjs

import { spawn } from "node:child_process";
import path from "node:path";

async function loadChromium() {
  for (const name of ["@playwright/test", "playwright"]) {
    try {
      const mod = await import(name);
      return mod.chromium ?? mod.default.chromium;
    } catch {
      // Essai suivant.
    }
  }
  console.error("Playwright introuvable : npm i -D @playwright/test@1.65");
  process.exit(1);
}

const PORT = 3102;
const externalBaseUrl = process.env.BASE_URL?.replace(/\/$/, "");
const baseUrl = externalBaseUrl || `http://localhost:${PORT}`;

const GOOGLE_HOST =
  /(^|\.)(google(\.[a-z]{2,3}){1,2}|gstatic\.com|googleapis\.com|googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|googleusercontent\.com|ggpht\.com|gvt1\.com|gvt2\.com)$/i;
const TAG_HOST = /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com)$/i;
const MAPS_EMBED = /^https:\/\/www\.google\.[a-z.]+\/maps\b.*output=embed/i;

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

async function startServer() {
  const nextBin = path.join(process.cwd(), "node_modules/next/dist/bin/next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => (output += chunk));
  server.stderr.on("data", (chunk) => (output += chunk));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`next start s'est arrêté :\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.status < 500) return server;
    } catch {
      // Serveur pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill("SIGTERM");
  throw new Error(`next start ne répond pas sur ${baseUrl} :\n${output}`);
}

const failures = [];
function check(condition, message, details = []) {
  console.log(`${condition ? "OK  " : "FAIL"} ${message}`);
  if (!condition) {
    for (const line of details.slice(0, 15)) console.log(`       ${line}`);
    failures.push(message);
  }
}

async function openHome(browser) {
  const context = await browser.newContext({ locale: "fr-FR" });
  const requests = [];
  context.on("request", (request) => {
    requests.push({ url: request.url() });
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  return { context, page, requests };
}

async function revealMapSection(page) {
  await page.locator("#nous-trouver").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
}

const googleRequests = (requests) => requests.filter((r) => GOOGLE_HOST.test(hostOf(r.url)));
const tagRequests = (requests) => requests.filter((r) => TAG_HOST.test(hostOf(r.url)));
const urls = (requests) => requests.map((r) => r.url);
const mapsIframe = (page) => page.locator('iframe[src*="google."][src*="/maps"]');
const gtagInDom = (page) =>
  page.evaluate(() => Boolean(window.__lpdGoogleTagLoaded || document.querySelector('script[src*="googletagmanager.com"]')));

const server = externalBaseUrl ? null : await startServer();
const chromium = await loadChromium();
const browser = await chromium.launch();

try {
  // a) Aucun choix de cookies.
  {
    const { context, page, requests } = await openHome(browser);
    await revealMapSection(page);
    await page.waitForTimeout(1000);
    check(await page.getByRole("button", { name: "Refuser" }).isVisible(), "a) bannière cookies affichée");
    check(await page.getByRole("button", { name: "Afficher la carte", exact: true }).isVisible(), "a) aperçu statique + bouton « Afficher la carte »");
    check((await mapsIframe(page).count()) === 0, "a) pas d'iframe Maps");
    check(googleRequests(requests).length === 0, "a) aucun choix : 0 requête Google", urls(googleRequests(requests)));
    await context.close();
  }

  // b) Après « Refuser » (puis rechargement).
  {
    const { context, page, requests } = await openHome(browser);
    await page.getByRole("button", { name: "Refuser" }).click();
    await revealMapSection(page);
    await page.reload({ waitUntil: "load" });
    await revealMapSection(page);
    check((await mapsIframe(page).count()) === 0, "b) refus : pas d'iframe Maps");
    check(googleRequests(requests).length === 0, "b) refus : 0 requête Google (y compris après rechargement)", urls(googleRequests(requests)));
    await context.close();
  }

  // c) « Afficher la carte » sans accepter les cookies.
  {
    const { context, page, requests } = await openHome(browser);
    // La bannière cookies (fixe, en bas) reste ouverte : on centre le bouton pour qu'elle ne le recouvre pas.
    const showMapButton = page.getByRole("button", { name: "Afficher la carte", exact: true });
    await showMapButton.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const mapsRequest = page.waitForRequest((request) => MAPS_EMBED.test(request.url()), { timeout: 15_000 }).catch(() => null);
    await showMapButton.click();
    await mapsIframe(page).waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
    check((await mapsIframe(page).count()) === 1, "c) iframe Maps insérée");
    check(Boolean(await mapsRequest), "c) iframe Maps chargée (requête google.com/maps?output=embed)");
    await page.waitForTimeout(3000);
    const consent = await page.evaluate(() => localStorage.getItem("la-patte-doree-google-consent-v2"));
    check(consent === null, "c) aucun consentement enregistré par le bouton carte");
    check(!(await gtagInDom(page)), "c) gtag.js non injecté");
    check(tagRequests(requests).length === 0, "c) 0 requête Analytics/Ads", urls(tagRequests(requests)));
    await page.reload({ waitUntil: "load" });
    await revealMapSection(page);
    check((await mapsIframe(page).count()) === 1, "c) carte conservée pour la session après rechargement");
    check(tagRequests(requests).length === 0, "c) toujours 0 requête Analytics/Ads après rechargement", urls(tagRequests(requests)));
    await context.close();
  }

  // d) « Tout accepter » sur une nouvelle visite (stockage vide).
  {
    const { context, page, requests } = await openHome(browser);
    await page.getByRole("button", { name: "Tout accepter" }).click();
    await page.locator("#nous-trouver").scrollIntoViewIfNeeded();
    await mapsIframe(page).waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3000);
    check((await mapsIframe(page).count()) === 1, "d) acceptation : iframe Maps affichée sans clic");
    check(requests.some((r) => MAPS_EMBED.test(r.url)), "d) iframe Maps chargée");
    const gaLoaded = requests.some((r) => /googletagmanager\.com\/gtag\/js/.test(r.url));
    console.log(`INFO d) gtag.js ${gaLoaded ? "chargé" : "non chargé"} après acceptation (autorisé)`);
    await context.close();
  }
} finally {
  await browser.close();
  if (server) {
    server.kill("SIGTERM");
    console.log(`Serveur next start (port ${PORT}) arrêté.`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} critère(s) en échec.`);
  process.exit(1);
}
console.log("\nCritères RGPD carte/consentement OK.");
