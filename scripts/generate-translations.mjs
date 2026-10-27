import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoots = ["src/app", "src/components"];
const extraFiles = [
  "src/lib/pets.ts",
  "src/lib/pricing.ts",
  "src/lib/seo.ts",
  "src/lib/services.ts",
  "src/lib/subscription-pricing.ts",
];

// The admin interface is internal. Public API messages are included because
// validation and booking errors are rendered in customer-facing screens.
const ignoredSegments = ["/admin/", "/en/"];
const ignoredAttributes = new Set([
  "className", "href", "src", "type", "name", "value", "method", "action",
  "rel", "target", "role", "id", "htmlFor", "content", "property", "key",
  "sizes", "strategy", "aria-live", "translate",
]);
const frenchSignal = /[àâçéèêëîïôùûüÿœæ]|\b(accueil|accepter|actif|âge|ajouter|animal|animaux|annuler|aucun|avec|avis|besoin|bienvenue|carte|chat|chien|choisir|collecte|compte|conditions|confidentialité|confirmer|connexion|cookies|créer|date|début|déconnexion|depuis|description|disponible|données|droits|durée|éditeur|email|enregistrer|envoyer|erreur|famille|fermer|fidélité|garde|garderie|gratuit|hébergement|historique|identification|informations|jour|médical|médicaments|merci|mois|mot|niveau|nom|nouveau|nuit|objet|paiement|partage|passage|pattes|poids|politique|pour|premium|prénom|prix|profil|promenade|race|récompense|réservation|réserver|responsabilité|retour|santé|sécurité|séjour|service|statut|supprimer|terminé|total|utilisation|utiliser|vaccin|vente|vétérinaire|visite|votre|vous)\b/i;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [absolute] : [];
  });
}

function decodeJsx(value) {
  return value
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeCode(value) {
  if (!value || value.length < 2 || value.length > 700) return true;
  if (/^(https?:|\/|#|\.|[A-Z0-9_]{3,}|[a-z]+\/[a-z]|\d{4}-\d{2})/.test(value)) return true;
  if (/^G-[A-Z0-9]+$|^_ga\b|window\.dataLayer|\bgtag\(/.test(value)) return true;
  if (/^[\w.-]+@[\w.-]+\.[a-z]+$/i.test(value)) return true;
  const tokens = value.split(/\s+/);
  const utilityTokens = tokens.filter((token) => /[:\[\]{}]|^(bg|text|flex|grid|p[trblxy]?|m[trblxy]?|w|h|min|max|rounded|border|shadow|hover|focus|sm|md|lg|xl)-/.test(token));
  return tokens.length > 2 && utilityTokens.length / tokens.length > 0.35;
}

function shouldKeep(value, force = false) {
  return !looksLikeCode(value) && (force ? /[A-Za-zÀ-ÿ]/.test(value) : frenchSignal.test(value));
}

const strings = new Set();
const files = [
  ...sourceRoots.flatMap((root) => walk(path.join(projectRoot, root))),
  ...extraFiles.map((file) => path.join(projectRoot, file)),
].filter((file) => !ignoredSegments.some((segment) => file.includes(segment)));

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function add(value, force = false) {
    const normalized = decodeJsx(value);
    if (shouldKeep(normalized, force)) strings.add(normalized);
  }

  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      ["script", "Script"].includes(node.openingElement.tagName.getText(sourceFile))
    ) {
      return;
    }

    if (ts.isJsxText(node)) add(node.text, true);

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (!ignoredAttributes.has(name) && ts.isStringLiteral(node.initializer)) add(node.initializer.text, true);
    }

    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      const isImport = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
      const isIgnoredAttribute = ts.isJsxAttribute(parent) && ignoredAttributes.has(parent.name.getText(sourceFile));
      if (!isImport && !isIgnoredAttribute) add(node.text);
    }

    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) add(node.text);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const orderedStrings = [...strings].sort((a, b) => a.localeCompare(b, "fr"));

if (process.argv.includes("--check")) {
  const generatedPath = path.join(projectRoot, "src/lib/i18n.generated.ts");
  const generatedSource = fs.readFileSync(generatedPath, "utf8");
  const generatedFile = ts.createSourceFile(generatedPath, generatedSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const generatedKeys = new Set();
  function collectKeys(node) {
    if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name))) {
      generatedKeys.add(node.name.text);
    }
    ts.forEachChild(node, collectKeys);
  }
  collectKeys(generatedFile);
  const missing = orderedStrings.filter((source) => !generatedKeys.has(source));
  if (missing.length > 0) {
    console.error(`Missing ${missing.length} translations:\n${missing.join("\n")}`);
    process.exit(1);
  }
  console.log(`Translation coverage OK: ${orderedStrings.length}/${orderedStrings.length} source strings.`);
  process.exit(0);
}

async function translate(text, target) {
  const protectedText = text
    .replaceAll("La Patte Dorée", "XQZBRANDXQZ")
    .replace(/\bchats\b/gi, "XQZCATPLURALXQZ")
    .replace(/\bchat\b/gi, "XQZCATSINGULARXQZ")
    .replace(/\bchiens\b/gi, "XQZDOGPLURALXQZ")
    .replace(/\bchien\b/gi, "XQZDOGSINGULARXQZ")
    .replace(/\bPattes?\b/g, "XQZPAWPOINTSXQZ");
  const params = new URLSearchParams({ client: "gtx", sl: "fr", tl: target, dt: "t", q: protectedText });
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const translated = payload[0]
        .map((part) => part[0])
        .join("")
        .replace(/XQZ(?:BRAND|MARCA)XQZ/gi, "La Patte Dorée")
        .replace(/XQZ(?:CAT|GATO)PLURALXQZ/gi, target === "en" ? "cats" : "gatos")
        .replace(/XQZ(?:CAT|GATO)SINGULARXQZ/gi, target === "en" ? "cat" : "gato")
        .replace(/XQZ(?:DOG|PERRO|PERROS)PLURALXQZ/gi, target === "en" ? "dogs" : "perros")
        .replace(/XQZ(?:DOG|PERRO|PERROS)SINGULARXQZ/gi, target === "en" ? "dog" : "perro")
        .replace(/XQZPAWPOINTSXQZ/gi, target === "en" ? "Paw points" : "puntos Patita");
      return target === "es"
        ? translated
            .replace(/doble puntos Patita/gi, "puntos Patita dobles")
            .replace(/\b1 puntos Patita\b/g, "1 punto Patita")
            .replace(/\bMi puntos Patita\b/g, "Mis puntos Patita")
        : translated;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const generatedPath = path.join(projectRoot, "src/lib/i18n.generated.ts");
let existingCatalogue = {};
if (fs.existsSync(generatedPath)) {
  const generatedSource = fs.readFileSync(generatedPath, "utf8");
  const objectMatch = generatedSource.match(/=\s*(\{[\s\S]*\});\s*$/);
  if (!objectMatch) throw new Error("Le catalogue généré existant ne peut pas être lu.");
  existingCatalogue = JSON.parse(objectMatch[1]);
}

const missingStrings = orderedStrings.filter((source) => !existingCatalogue[source]);
if (missingStrings.length === 0) {
  console.log("*** Begin Patch\n*** End Patch");
  process.exit(0);
}

const translated = await mapWithConcurrency(missingStrings, 6, async (source) => {
  const [en, es] = await Promise.all([translate(source, "en"), translate(source, "es")]);
  return [source, { en, es }];
});

const newEntries = Object.fromEntries(translated);
let patch;
if (Object.keys(existingCatalogue).length === 0) {
  const output = `// Generated by scripts/generate-translations.mjs.\n// Curated entries in i18n.ts take precedence over this catalogue.\nexport const generatedCatalogue: Record<string, { en: string; es: string }> = ${JSON.stringify(newEntries, null, 2)};\n`;
  patch = `*** Begin Patch\n*** Add File: ${generatedPath}\n${output.split("\n").map((line) => `+${line}`).join("\n")}\n*** End Patch`;
} else {
  const lastKey = Object.keys(existingCatalogue).at(-1);
  const lastBlock = JSON.stringify(
    { [lastKey]: existingCatalogue[lastKey] },
    null,
    2
  ).split("\n").slice(1, -1).join("\n");
  const additionBlock = JSON.stringify(newEntries, null, 2)
    .split("\n")
    .slice(1, -1)
    .join("\n");
  patch = [
    "*** Begin Patch",
    `*** Update File: ${generatedPath}`,
    "@@",
    ...lastBlock.split("\n").map((line) => `-${line}`),
    "-};",
    ...lastBlock.split("\n").map((line, index, lines) =>
      index === lines.length - 1 ? `+${line},` : `+${line}`
    ),
    ...additionBlock.split("\n").map((line) => `+${line}`),
    "+};",
    "*** End Patch",
  ].join("\n");
}
process.stdout.write(patch);
