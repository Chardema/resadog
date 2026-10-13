import { config } from "dotenv";

if (process.env.CHECK_ENV_FILE) {
  config({ path: process.env.CHECK_ENV_FILE, override: true, quiet: true });
} else {
  config({ path: ".env", quiet: true });
  config({ path: ".env.local", override: true, quiet: true });
}

const target = process.env.CHECK_ENV_TARGET || "production";
const results = [];

const get = (key) => process.env[key]?.trim();

const requireEnv = (key) => {
  if (!get(key)) {
    results.push({ level: "error", message: `${key} est manquant` });
  }
};

const warnEnv = (key) => {
  if (!get(key)) {
    results.push({ level: "warning", message: `${key} est conseille mais absent` });
  }
};

const required = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "UPLOADTHING_TOKEN",
  "UPLOADTHING_APP_ID",
];

if (target === "production") {
  required.push(
    "CRON_SECRET",
    "RESEND_API_KEY",
    "ADMIN_EMAIL",
    "BUSINESS_LEGAL_NAME",
    "BUSINESS_SIRET",
    "BUSINESS_ADDRESS",
    "SUPPORT_EMAIL",
    "CONSUMER_MEDIATOR_NAME",
    "CONSUMER_MEDIATOR_ADDRESS",
    "CONSUMER_MEDIATOR_URL",
    "RESEND_FROM",
    "RESEND_BUG_FROM",
    "DEV_EMAIL",
    "TWO_FACTOR_ENCRYPTION_KEY"
  );
}

required.forEach(requireEnv);

if (!get("AUTH_SECRET") && !get("NEXTAUTH_SECRET")) {
  results.push({ level: "error", message: "AUTH_SECRET ou NEXTAUTH_SECRET est manquant" });
}

const authSecret = get("AUTH_SECRET") || get("NEXTAUTH_SECRET");
if (authSecret && authSecret.length < 32) {
  results.push({ level: "error", message: "AUTH_SECRET/NEXTAUTH_SECRET doit faire au moins 32 caracteres" });
}

const twoFactorKey = get("TWO_FACTOR_ENCRYPTION_KEY");
if (twoFactorKey) {
  const isHexKey = /^[a-f\d]{64}$/i.test(twoFactorKey);
  let isBase64Key = false;
  try {
    isBase64Key = Buffer.from(twoFactorKey, "base64").length === 32;
  } catch {
    isBase64Key = false;
  }
  if (!isHexKey && !isBase64Key) {
    results.push({
      level: "error",
      message: "TWO_FACTOR_ENCRYPTION_KEY doit encoder exactement 32 octets (hex ou base64)",
    });
  }
}

for (const [idKey, secretKey] of [
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ["APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET"],
]) {
  if (Boolean(get(idKey)) !== Boolean(get(secretKey))) {
    results.push({ level: "error", message: `${idKey} et ${secretKey} doivent etre configures ensemble` });
  }
}

if (target !== "production") {
  warnEnv("CRON_SECRET");
  warnEnv("RESEND_API_KEY");
  warnEnv("ADMIN_EMAIL");
  warnEnv("DEV_EMAIL");
  warnEnv("RESEND_FROM");
  warnEnv("RESEND_BUG_FROM");
  warnEnv("CONSUMER_MEDIATOR_ADDRESS");
}

warnEnv("PROFESSIONAL_INSURANCE");

const nextAuthUrl = get("NEXTAUTH_URL");
if (target === "production" && nextAuthUrl) {
  if (!nextAuthUrl.startsWith("https://")) {
    results.push({ level: "error", message: "NEXTAUTH_URL doit commencer par https:// en production" });
  }

  if (nextAuthUrl.includes("localhost") || nextAuthUrl.includes("127.0.0.1")) {
    results.push({ level: "error", message: "NEXTAUTH_URL ne doit pas pointer vers localhost en production" });
  }
}

const stripeSecret = get("STRIPE_SECRET_KEY");
if (target === "production" && stripeSecret && !stripeSecret.startsWith("sk_live_")) {
  results.push({ level: "error", message: "STRIPE_SECRET_KEY doit etre une cle live Stripe (sk_live_)" });
}

const stripeWebhookSecret = get("STRIPE_WEBHOOK_SECRET");
if (stripeWebhookSecret && !stripeWebhookSecret.startsWith("whsec_")) {
  results.push({ level: "error", message: "STRIPE_WEBHOOK_SECRET doit commencer par whsec_" });
}

const cronSecret = get("CRON_SECRET");
if (cronSecret && cronSecret.length < 24) {
  results.push({ level: "error", message: "CRON_SECRET doit faire au moins 24 caracteres" });
}

const adminEmail = get("ADMIN_EMAIL");
if (adminEmail && !adminEmail.includes("@")) {
  results.push({ level: "error", message: "ADMIN_EMAIL ne ressemble pas a une adresse email" });
}

const devEmail = get("DEV_EMAIL");
if (devEmail && !devEmail.includes("@")) {
  results.push({ level: "error", message: "DEV_EMAIL ne ressemble pas a une adresse email" });
}

const siret = get("BUSINESS_SIRET")?.replace(/\s/g, "");
if (siret && !/^\d{14}$/.test(siret)) {
  results.push({ level: "error", message: "BUSINESS_SIRET doit contenir 14 chiffres" });
}

const privacyEmail = get("PRIVACY_EMAIL");
if (privacyEmail && !privacyEmail.includes("@")) {
  results.push({ level: "error", message: "PRIVACY_EMAIL ne ressemble pas a une adresse email" });
}

const businessTaxStatus = get("BUSINESS_TAX_STATUS");
if (businessTaxStatus && !["FRANCHISE_BASE", "VAT_SUBJECT"].includes(businessTaxStatus)) {
  results.push({ level: "error", message: "BUSINESS_TAX_STATUS doit valoir FRANCHISE_BASE ou VAT_SUBJECT" });
}
if (businessTaxStatus === "VAT_SUBJECT" && !get("BUSINESS_VAT_NUMBER")) {
  results.push({ level: "error", message: "BUSINESS_VAT_NUMBER est requis lorsque BUSINESS_TAX_STATUS vaut VAT_SUBJECT" });
}

const mediatorUrl = get("CONSUMER_MEDIATOR_URL");
if (mediatorUrl && !mediatorUrl.startsWith("https://")) {
  results.push({ level: "error", message: "CONSUMER_MEDIATOR_URL doit commencer par https://" });
}

const resendFrom = get("RESEND_FROM");
if (target === "production" && (!resendFrom || resendFrom.includes("onboarding@resend.dev"))) {
  results.push({
    level: "error",
    message: "RESEND_FROM doit utiliser un domaine Resend verifie en production",
  });
}

const resendBugFrom = get("RESEND_BUG_FROM");
if (target === "production" && (!resendBugFrom || resendBugFrom.includes("onboarding@resend.dev"))) {
  results.push({
    level: "error",
    message: "RESEND_BUG_FROM doit utiliser un domaine Resend verifie en production",
  });
}

const errors = results.filter((result) => result.level === "error");
const warnings = results.filter((result) => result.level === "warning");

console.log(`Verification environnement (${target})`);

if (errors.length === 0 && warnings.length === 0) {
  console.log("OK - aucune anomalie detectee");
  process.exit(0);
}

for (const result of results) {
  const prefix = result.level === "error" ? "ERREUR" : "WARNING";
  console.log(`${prefix} - ${result.message}`);
}

if (errors.length > 0) {
  process.exit(1);
}
