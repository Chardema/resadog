ALTER TABLE "Booking" ADD COLUMN "couponRedeemedAt" TIMESTAMP(3);

ALTER TABLE "CreditBatch" ADD COLUMN "stripeSourceId" TEXT;

ALTER TABLE "StripeWebhookEvent"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PROCESSED',
ADD COLUMN "attemptToken" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "StripeWebhookEvent"
SET "processedAt" = "createdAt"
WHERE "processedAt" IS NULL;

ALTER TABLE "StripeWebhookEvent" ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

CREATE UNIQUE INDEX "CreditBatch_stripeSourceId_key" ON "CreditBatch"("stripeSourceId");
CREATE INDEX "StripeWebhookEvent_status_updatedAt_idx" ON "StripeWebhookEvent"("status", "updatedAt");
