-- Replace the client-declared age with a verifiable birth date while keeping
-- the legacy age column during the transition.
ALTER TABLE "Pet"
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "birthDateProofUrl" TEXT,
ADD COLUMN "birthDateVerifiedAt" TIMESTAMP(3);

CREATE INDEX "Pet_birthDateVerifiedAt_idx" ON "Pet"("birthDateVerifiedAt");
