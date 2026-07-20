-- Ferme la fenêtre de concurrence pendant l'acceptation d'une réservation.
ALTER TYPE "BookingStatus" ADD VALUE 'ACCEPTING' AFTER 'PENDING';
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLING' AFTER 'ACCEPTING';

-- Conserve séparément le montant contractuel et le montant réellement encaissé.
ALTER TABLE "Payment" ADD COLUMN "capturedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Payment"
SET "capturedAmount" = CASE
    WHEN "status" = 'SUCCEEDED' THEN "amount"
    -- L'ancien parcours de remboursement partiel remplaçait amount par le
    -- montant conservé : on reconstitue donc l'encaissement brut.
    WHEN "status" = 'PARTIALLY_REFUNDED' THEN "amount" + COALESCE("refundAmount", 0)
    -- Une empreinte simplement libérée est REFUNDED avec refundAmount = 0.
    WHEN "status" = 'REFUNDED' AND COALESCE("refundAmount", 0) > 0
      THEN GREATEST("amount", "refundAmount")
    ELSE 0
END
WHERE "status" IN ('SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- Une même action admin ne peut créer qu'un supplément.
ALTER TABLE "AdditionalCharge" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "AdditionalCharge_idempotencyKey_key" ON "AdditionalCharge"("idempotencyKey");

-- Une seule tentative Checkout coordonnée par réservation.
CREATE TYPE "CheckoutAttemptStatus" AS ENUM ('CREATING', 'OPEN', 'COMPLETED', 'EXPIRED', 'FAILED');

CREATE TABLE "CheckoutAttempt" (
    "bookingId" TEXT NOT NULL,
    "attemptToken" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "CheckoutAttemptStatus" NOT NULL DEFAULT 'CREATING',
    "stripeSessionId" TEXT,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("bookingId")
);

CREATE UNIQUE INDEX "CheckoutAttempt_attemptToken_key" ON "CheckoutAttempt"("attemptToken");
CREATE UNIQUE INDEX "CheckoutAttempt_idempotencyKey_key" ON "CheckoutAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "CheckoutAttempt_stripeSessionId_key" ON "CheckoutAttempt"("stripeSessionId");
CREATE INDEX "CheckoutAttempt_status_updatedAt_idx" ON "CheckoutAttempt"("status", "updatedAt");

ALTER TABLE "CheckoutAttempt"
ADD CONSTRAINT "CheckoutAttempt_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
