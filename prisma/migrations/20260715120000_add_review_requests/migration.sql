CREATE TABLE "ReviewRequest" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "serviceRating" INTEGER,
  "serviceComment" TEXT,
  "websiteRating" INTEGER,
  "websiteComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "bookingId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "reviewId" TEXT,

  CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewRequest_token_key" ON "ReviewRequest"("token");
CREATE UNIQUE INDEX "ReviewRequest_bookingId_key" ON "ReviewRequest"("bookingId");
CREATE UNIQUE INDEX "ReviewRequest_reviewId_key" ON "ReviewRequest"("reviewId");
CREATE INDEX "ReviewRequest_clientId_idx" ON "ReviewRequest"("clientId");
CREATE INDEX "ReviewRequest_sentAt_idx" ON "ReviewRequest"("sentAt");
CREATE INDEX "ReviewRequest_submittedAt_idx" ON "ReviewRequest"("submittedAt");

ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
