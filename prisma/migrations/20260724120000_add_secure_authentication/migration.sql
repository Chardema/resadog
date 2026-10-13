-- Existing password accounts predate mandatory email verification. They are
-- grandfathered once so the deployment does not lock legitimate customers out.
UPDATE "User"
SET "emailVerified" = COALESCE("createdAt", NOW())
WHERE "passwordHash" IS NOT NULL
  AND "emailVerified" IS NULL;

ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorSecret" TEXT,
ADD COLUMN "twoFactorRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastLoginAt" TIMESTAMP(3);
