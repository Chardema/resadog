import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";

const CREATING_STALE_AFTER_MS = 2 * 60 * 1000;

export class CheckoutAttemptBusyError extends Error {}

export type CheckoutAttemptClaim = {
  bookingId: string;
  attemptToken: string;
  idempotencyKey: string;
};

export async function claimCheckoutAttempt(bookingId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${bookingId}`}, 0))`;

    const existing = await tx.checkoutAttempt.findUnique({ where: { bookingId } });
    const now = new Date();

    if (
      existing?.status === "OPEN" &&
      existing.checkoutUrl &&
      existing.stripeSessionId &&
      existing.expiresAt &&
      existing.expiresAt > new Date(now.getTime() + 30_000)
    ) {
      return {
        kind: "REUSE" as const,
        checkoutUrl: existing.checkoutUrl,
        sessionId: existing.stripeSessionId,
      };
    }

    const staleBefore = new Date(now.getTime() - CREATING_STALE_AFTER_MS);
    if (existing?.status === "CREATING" && existing.updatedAt > staleBefore) {
      throw new CheckoutAttemptBusyError(
        "Une session de paiement est déjà en cours de création. Réessayez dans quelques secondes."
      );
    }

    // Une tentative CREATING devenue orpheline réutilise exactement la même clé
    // Stripe : si la requête précédente a abouti chez Stripe, le même objet revient.
    const attemptToken = existing?.status === "CREATING"
      ? existing.attemptToken
      : randomUUID();
    const idempotencyKey = existing?.status === "CREATING"
      ? existing.idempotencyKey
      : `booking-checkout:${bookingId}:${attemptToken}`;

    await tx.checkoutAttempt.upsert({
      where: { bookingId },
      create: {
        bookingId,
        attemptToken,
        idempotencyKey,
        status: "CREATING",
      },
      update: {
        attemptToken,
        idempotencyKey,
        status: "CREATING",
        stripeSessionId: null,
        checkoutUrl: null,
        expiresAt: null,
        lastError: null,
      },
    });

    return {
      kind: "CLAIMED" as const,
      claim: { bookingId, attemptToken, idempotencyKey } satisfies CheckoutAttemptClaim,
    };
  }, { maxWait: 5_000, timeout: 10_000 });
}

export async function failCheckoutAttempt(
  claim: CheckoutAttemptClaim,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Échec de création Checkout";
  await prisma.checkoutAttempt.updateMany({
    where: {
      bookingId: claim.bookingId,
      attemptToken: claim.attemptToken,
      status: "CREATING",
    },
    data: {
      status: "FAILED",
      lastError: message.slice(0, 2_000),
    },
  });
}
