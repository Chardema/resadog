CREATE TYPE "CancellationOrigin" AS ENUM ('CLIENT', 'TEAM');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELED');

ALTER TABLE "Booking"
ADD COLUMN "cancellationOrigin" "CancellationOrigin",
ADD COLUMN "cancelledAt" TIMESTAMP(3);

ALTER TABLE "Payment"
ADD COLUMN "stripeRefundId" TEXT,
ADD COLUMN "refundStatus" "RefundStatus",
ADD COLUMN "refundFailureReason" TEXT,
ADD COLUMN "refundStartedEmailSentAt" TIMESTAMP(3),
ADD COLUMN "refundCompletedEmailSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_stripeRefundId_key" ON "Payment"("stripeRefundId");
CREATE INDEX "Payment_refundStatus_idx" ON "Payment"("refundStatus");
