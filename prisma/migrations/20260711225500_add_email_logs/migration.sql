CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED');

CREATE TABLE "EmailLog" (
  "id" TEXT NOT NULL,
  "resendId" TEXT,
  "status" "EmailStatus" NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT[] NOT NULL,
  "subject" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailLog_resendId_key" ON "EmailLog"("resendId");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
CREATE INDEX "EmailLog_idempotencyKey_idx" ON "EmailLog"("idempotencyKey");
