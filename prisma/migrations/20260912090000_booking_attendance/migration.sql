-- CreateTable
CREATE TABLE "BookingNoShow" (
    "bookingId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "contactEvidence" TEXT NOT NULL,
    "lossEvidence" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3) NOT NULL,
    "responseDeadline" TIMESTAMP(3) NOT NULL,
    "legalVersion" TEXT NOT NULL,
    "retainedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingNoShow_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "BookingNotice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "firstAttemptAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "resendId" TEXT,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingNotice_state_createdAt_idx" ON "BookingNotice"("state", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingNoShow" ADD CONSTRAINT "BookingNoShow_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingNotice" ADD CONSTRAINT "BookingNotice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

