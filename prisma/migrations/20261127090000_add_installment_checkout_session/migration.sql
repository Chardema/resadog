-- Solde différé (spec 07, lot 5) : session Checkout de reprise après un échec.
-- Migration additive : colonne nullable, aucune donnée à migrer.

-- AlterTable
ALTER TABLE "BookingInstallment" ADD COLUMN "stripeCheckoutSessionId" TEXT;
