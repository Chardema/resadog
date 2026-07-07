import { config } from "dotenv";
import Stripe from "stripe";

if (process.env.CHECK_ENV_FILE) {
  config({ path: process.env.CHECK_ENV_FILE, override: true, quiet: true });
} else {
  config({ path: ".env", quiet: true });
  config({ path: ".env.local", override: true, quiet: true });
}

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
const appUrl = process.env.NEXTAUTH_URL?.trim()?.replace(/\/$/, "");

const bootstrapErrors = [];
if (!secretKey) {
  bootstrapErrors.push("STRIPE_SECRET_KEY est absente");
} else if (!secretKey.startsWith("sk_live_")) {
  bootstrapErrors.push("STRIPE_SECRET_KEY doit etre une cle Live (sk_live_)");
}
if (!appUrl) {
  bootstrapErrors.push("NEXTAUTH_URL est absent");
}

if (bootstrapErrors.length > 0) {
  for (const error of bootstrapErrors) console.error(`ERREUR - ${error}`);
  process.exit(1);
}

const requiredEvents = [
  "checkout.session.completed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
  "payment_intent.payment_failed",
  "payment_intent.succeeded",
];

try {
  const stripe = new Stripe(secretKey);
  const [account, webhookEndpoints, portalConfigurations] = await Promise.all([
    stripe.accounts.retrieve(),
    stripe.webhookEndpoints.list({ limit: 100 }),
    stripe.billingPortal.configurations.list({ active: true, limit: 100 }),
  ]);

  const errors = [];
  if (!account.charges_enabled) errors.push("les paiements Live ne sont pas activés");
  if (!account.payouts_enabled) errors.push("les versements Stripe ne sont pas activés");
  if (!account.details_submitted) errors.push("le dossier du compte Stripe est incomplet");
  if (portalConfigurations.data.length === 0) {
    errors.push("aucune configuration active du portail client Stripe Live n'a été trouvée");
  } else {
    const invoiceHistoryEnabled = portalConfigurations.data.some(
      (configuration) => configuration.features?.invoice_history?.enabled
    );
    if (!invoiceHistoryEnabled) {
      errors.push("le portail client Stripe Live doit autoriser la consultation des factures");
    }
  }

  const webhookUrl = `${appUrl}/api/stripe/webhook`;
  const endpoint = webhookEndpoints.data.find(
    (candidate) => candidate.url.replace(/\/$/, "") === webhookUrl
  );

  if (!endpoint || endpoint.status !== "enabled") {
    errors.push(`webhook Live actif introuvable pour ${webhookUrl}`);
  } else if (!endpoint.enabled_events.includes("*")) {
    const missingEvents = requiredEvents.filter(
      (eventName) => !endpoint.enabled_events.includes(eventName)
    );
    if (missingEvents.length > 0) {
      errors.push(`événements webhook manquants : ${missingEvents.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`ERREUR - ${error}`);
    process.exit(1);
  }

  console.log("OK - compte Stripe Live et webhook de production opérationnels");
} catch (error) {
  const message = error instanceof Error ? error.message : "erreur Stripe inconnue";
  console.error(`ERREUR - vérification Stripe Live impossible : ${message}`);
  process.exit(1);
}
