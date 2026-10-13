CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinanceStripeSnapshot" (
    "paymentIntentId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceStripeSnapshot_pkey" PRIMARY KEY ("paymentIntentId")
);
