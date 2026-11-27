import type Stripe from "stripe";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { prisma } from "@/lib/db/prisma";
import {
  sendBookingAuthorizationAlertAdminEmail,
  sendBookingAuthorizationExpiredEmail,
} from "@/lib/email";
import { isPaymentPlanEnabled } from "@/lib/payment-plan";
import { stripe } from "@/lib/stripe/config";

// Lot 4 de la spec 07 : une autorisation carte non capturée expire (7 jours,
// moins pour certains réseaux). Sans traitement, la demande reste PENDING avec
// une « Empreinte active » morte que l'équipe ne peut plus accepter.
//
// Le traitement couvre les deux plans (FULL et DEPOSIT_BALANCE) mais reste
// derrière isPaymentPlanEnabled() : plan fermé (production), rien ne change par
// rapport à main (pas de nouveau statut, pas d'e-mail, pas d'appel Stripe).
// Le parcours nominal (acceptation avant l'expiration) n'est jamais touché.

export const isAuthorizationExpiryEnabled = () => isPaymentPlanEnabled();

// Le cron relit Stripe pour les demandes en attente depuis plus de 48 h ...
export const AUTHORIZATION_SCAN_MIN_AGE_HOURS = 48;
// ... alerte l'équipe quand l'autorisation expire dans moins de 48 h (le cron
// est quotidien : chaque autorisation est vue au moins une fois dans ce délai) ...
export const AUTHORIZATION_EXPIRING_ALERT_HOURS = 48;
// ... et traite au plus 20 demandes par exécution.
export const AUTHORIZATION_SCAN_BATCH_SIZE = 20;
// Au-delà, la demande est close sans e-mail client (vieille demande « zombie »).
export const EXPIRED_CLIENT_NOTICE_MAX_AGE_DAYS = 7;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const bookingForExpiry = {
  client: true,
  pets: true,
  pet: true,
} as const;

// Les PaymentIntents de supplément ou de solde ne sont jamais des demandes.
export function isBookingAuthorizationIntent(paymentIntent: Pick<Stripe.PaymentIntent, "metadata">) {
  const type = paymentIntent.metadata?.type;
  if (type === "additional_charge" || type === "booking_balance") return false;
  return Boolean(paymentIntent.metadata?.bookingIds || paymentIntent.metadata?.bookingId);
}

// Prévenir le client seulement si l'expiration est récente et la garde à venir.
export function shouldNotifyClientOfExpiry(input: { canceledAt: Date | null; startDate: Date; now: Date }) {
  if (input.startDate.getTime() <= input.now.getTime()) return false;
  if (!input.canceledAt) return true;
  return input.now.getTime() - input.canceledAt.getTime() <= EXPIRED_CLIENT_NOTICE_MAX_AGE_DAYS * DAY_MS;
}

export type AuthorizationExpiryOutcome =
  | "DISABLED"
  | "IGNORED"
  | "NOT_CANCELED"
  | "EXPIRED"
  | "ALREADY_EXPIRED";

export type AuthorizationExpiryResult = {
  outcome: AuthorizationExpiryOutcome;
  bookingId?: string;
  clientNotified?: boolean;
  notifyErrors: string[];
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Passe en EXPIRED la demande dont l'autorisation Stripe est annulée (expirée)
 * avant acceptation, puis prévient le client et l'équipe. Idempotent : un rejeu
 * (webhook, cron) ne change plus l'état et les e-mails ont des clés d'idempotence.
 */
export async function expireBookingAuthorization(
  paymentIntent: Stripe.PaymentIntent,
  { now = new Date() }: { now?: Date } = {}
): Promise<AuthorizationExpiryResult> {
  if (!isAuthorizationExpiryEnabled()) return { outcome: "DISABLED", notifyErrors: [] };
  if (!isBookingAuthorizationIntent(paymentIntent)) return { outcome: "IGNORED", notifyErrors: [] };
  if (paymentIntent.status !== "canceled") return { outcome: "NOT_CANCELED", notifyErrors: [] };

  const payment = await prisma.payment.findFirst({
    where: { stripePaymentId: paymentIntent.id },
    include: { booking: { include: bookingForExpiry } },
  });
  if (!payment) return { outcome: "IGNORED", notifyErrors: [] };
  const booking = payment.booking;

  let outcome: AuthorizationExpiryOutcome;
  if (booking.status === "PENDING" && payment.status === "PROCESSING") {
    // Une annulation client ou équipe passe d'abord par CANCELLING : seule une
    // demande restée PENDING avec une autorisation morte est concernée.
    const expired = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: booking.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (updated.count !== 1) return false;
      await tx.payment.updateMany({
        where: { id: payment.id, stripePaymentId: paymentIntent.id, status: "PROCESSING" },
        data: { status: "EXPIRED" },
      });
      return true;
    });
    outcome = expired ? "EXPIRED" : "IGNORED";
  } else if (booking.status === "EXPIRED") {
    // Rejeu après un e-mail en échec : on retente l'envoi (clés idempotentes).
    outcome = "ALREADY_EXPIRED";
  } else {
    return { outcome: "IGNORED", bookingId: booking.id, notifyErrors: [] };
  }
  if (outcome === "IGNORED") return { outcome, bookingId: booking.id, notifyErrors: [] };

  const canceledAt = paymentIntent.canceled_at ? new Date(paymentIntent.canceled_at * 1000) : null;
  const clientNotified = shouldNotifyClientOfExpiry({ canceledAt, startDate: booking.startDate, now });
  const details = getBookingEmailDetails(booking);
  const notifyErrors: string[] = [];

  if (clientNotified) {
    try {
      await sendBookingAuthorizationExpiredEmail(
        booking.client.email,
        booking.client.name || "Client",
        details.petName,
        { idempotencyKey: `booking-authorization-expired-${booking.id}` }
      );
    } catch (error) {
      notifyErrors.push(`client: ${errorMessage(error)}`);
    }
  }

  try {
    await sendBookingAuthorizationAlertAdminEmail(
      "EXPIRED",
      {
        bookingId: booking.id,
        petName: details.petName,
        userName: booking.client.name || "Client",
        userEmail: booking.client.email,
        startDate: details.startDate,
        endDate: details.endDate,
        serviceLabel: details.serviceLabel,
        authorizedAmount: payment.amount,
        clientNotified,
      },
      { idempotencyKey: `booking-authorization-expired-admin-${booking.id}` }
    );
  } catch (error) {
    notifyErrors.push(`admin: ${errorMessage(error)}`);
  }

  return { outcome, bookingId: booking.id, clientNotified, notifyErrors };
}

// Fin de validité de l'autorisation, lue sur la charge (capture_before).
export function getAuthorizationCaptureBefore(paymentIntent: Stripe.PaymentIntent) {
  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge === "string") return null;
  const captureBefore = charge.payment_method_details?.card?.capture_before;
  return captureBefore ? new Date(captureBefore * 1000) : null;
}

const formatParisDateTime = (date: Date) =>
  date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

export type AuthorizationScanResult = {
  checked: number;
  expired: number;
  alerted: number;
  errors: string[];
};

/**
 * Filet de sécurité quotidien (cron cleanup-bookings) : relit Stripe pour les
 * demandes PENDING dont l'autorisation est ancienne. Passe en EXPIRED celles
 * dont l'autorisation est annulée (y compris les « zombies » d'avant ce lot),
 * et alerte l'équipe quand une autorisation expire bientôt.
 * Retourne null quand le drapeau est désactivé (aucune lecture).
 */
export async function scanBookingAuthorizations({ now = new Date() }: { now?: Date } = {}): Promise<AuthorizationScanResult | null> {
  if (!isAuthorizationExpiryEnabled()) return null;

  const result: AuthorizationScanResult = { checked: 0, expired: 0, alerted: 0, errors: [] };
  // Une erreur ici ne doit pas faire échouer le reste du nettoyage quotidien.
  const candidates = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: new Date(now.getTime() - AUTHORIZATION_SCAN_MIN_AGE_HOURS * HOUR_MS) },
      payment: { is: { status: "PROCESSING", stripePaymentId: { not: null } } },
    },
    include: { ...bookingForExpiry, payment: true },
    orderBy: { createdAt: "asc" },
    take: AUTHORIZATION_SCAN_BATCH_SIZE,
  }).catch((error: unknown) => {
    result.errors.push(`scan: ${errorMessage(error)}`);
    return [];
  });

  for (const booking of candidates) {
    const paymentIntentId = booking.payment?.stripePaymentId;
    if (!paymentIntentId) continue;
    result.checked += 1;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });

      if (paymentIntent.status === "canceled") {
        const expiry = await expireBookingAuthorization(paymentIntent, { now });
        if (expiry.outcome === "EXPIRED") result.expired += 1;
        result.errors.push(...expiry.notifyErrors.map((message) => `${booking.id}: ${message}`));
        continue;
      }

      if (paymentIntent.status !== "requires_capture") continue;
      const captureBefore = getAuthorizationCaptureBefore(paymentIntent);
      if (!captureBefore || captureBefore.getTime() - now.getTime() > AUTHORIZATION_EXPIRING_ALERT_HOURS * HOUR_MS) continue;

      const details = getBookingEmailDetails(booking);
      await sendBookingAuthorizationAlertAdminEmail(
        "EXPIRING",
        {
          bookingId: booking.id,
          petName: details.petName,
          userName: booking.client.name || "Client",
          userEmail: booking.client.email,
          startDate: details.startDate,
          endDate: details.endDate,
          serviceLabel: details.serviceLabel,
          authorizedAmount: booking.payment?.amount ?? 0,
          expiresAt: formatParisDateTime(captureBefore),
        },
        { idempotencyKey: `booking-authorization-expiring-${booking.id}` }
      );
      result.alerted += 1;
    } catch (error) {
      result.errors.push(`${booking.id}: ${errorMessage(error)}`);
    }
  }
  return result;
}

// Webhook : un e-mail en échec fait répondre 500 pour que Stripe rejoue
// l'événement (l'état est déjà EXPIRED, seuls les e-mails sont retentés).
export function assertExpiryNotified(result: AuthorizationExpiryResult) {
  if (result.notifyErrors.length > 0) {
    throw new Error(`Demande ${result.bookingId} expirée, e-mails à renvoyer : ${result.notifyErrors.join(" ; ")}`);
  }
  return result;
}

// Webhook charge.expired : la charge non capturée a expiré ; le PaymentIntent
// correspondant porte la réservation.
export async function expireAuthorizationFromCharge(charge: Stripe.Charge) {
  if (!isAuthorizationExpiryEnabled()) return { outcome: "DISABLED", notifyErrors: [] } as AuthorizationExpiryResult;
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return { outcome: "IGNORED", notifyErrors: [] } as AuthorizationExpiryResult;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return expireBookingAuthorization(paymentIntent);
}
