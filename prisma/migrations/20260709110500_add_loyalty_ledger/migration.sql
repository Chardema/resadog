CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'REVERSAL', 'ADJUSTMENT');

CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "paws" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "couponId" TEXT,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyTransaction_bookingId_type_key" ON "LoyaltyTransaction"("bookingId", "type");
CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx" ON "LoyaltyTransaction"("userId", "createdAt");
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");
CREATE INDEX "LoyaltyTransaction_couponId_idx" ON "LoyaltyTransaction"("couponId");

ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
