-- Acompte à la réservation et solde différé (spec 07).
-- Migration additive : les réservations existantes passent FULL par défaut.

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'DEPOSIT_BALANCE');

-- CreateEnum
CREATE TYPE "InstallmentKind" AS ENUM ('BALANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
ADD COLUMN "balanceAmount" DOUBLE PRECISION,
ADD COLUMN "balanceDueAt" TIMESTAMP(3),
ADD COLUMN "mandateAcceptedAt" TIMESTAMP(3),
ADD COLUMN "mandateLegalVersion" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "stripePaymentMethodId" TEXT;

-- CreateTable
CREATE TABLE "BookingInstallment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "InstallmentKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "stripePaymentIntentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "refundedAmount" DOUBLE PRECISION,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingInstallment_stripePaymentIntentId_key" ON "BookingInstallment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingInstallment_idempotencyKey_key" ON "BookingInstallment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BookingInstallment_bookingId_idx" ON "BookingInstallment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingInstallment_status_dueAt_idx" ON "BookingInstallment"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Booking_paymentPlan_balanceDueAt_idx" ON "Booking"("paymentPlan", "balanceDueAt");

-- AddForeignKey
ALTER TABLE "BookingInstallment" ADD CONSTRAINT "BookingInstallment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
