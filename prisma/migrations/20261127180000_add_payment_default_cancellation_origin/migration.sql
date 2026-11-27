-- Solde différé (spec 07, lot 6) : origine dédiée pour l'annulation
-- automatique à J-2 quand le solde reste impayé (acompte conservé).
-- Migration additive : nouvelle valeur d'enum, aucune donnée à migrer.

-- AlterEnum
ALTER TYPE "CancellationOrigin" ADD VALUE IF NOT EXISTS 'PAYMENT_DEFAULT';
