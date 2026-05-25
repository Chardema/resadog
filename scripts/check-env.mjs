import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

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
  "CRON_SECRET",
  "UPLOADTHING_TOKEN",
  "UPLOADTHING_APP_ID",
  "RESEND_API_KEY",
  "ADMIN_EMAIL",
];

required.forEach(requireEnv);

if (!get("AUTH_SECRET") && !get("NEXTAUTH_SECRET")) {
  results.push({ level: "error", message: "AUTH_SECRET ou NEXTAUTH_SECRET est manquant" });
}

warnEnv("DEV_EMAIL");
warnEnv("RESEND_FROM");
warnEnv("RESEND_BUG_FROM");

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
if (target === "production" && stripeSecret?.startsWith("sk_test_")) {
  results.push({ level: "warning", message: "STRIPE_SECRET_KEY est une cle de test Stripe" });
}

const cronSecret = get("CRON_SECRET");
if (cronSecret && cronSecret.length < 24) {
  results.push({ level: "error", message: "CRON_SECRET doit faire au moins 24 caracteres" });
}

const adminEmail = get("ADMIN_EMAIL");
if (adminEmail && !adminEmail.includes("@")) {
  results.push({ level: "error", message: "ADMIN_EMAIL ne ressemble pas a une adresse email" });
}

const resendFrom = get("RESEND_FROM");
if (target === "production" && (!resendFrom || resendFrom.includes("onboarding@resend.dev"))) {
  results.push({
    level: "warning",
    message: "RESEND_FROM doit utiliser un domaine Resend verifie en production",
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
