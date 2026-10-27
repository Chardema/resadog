-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReviewSource" AS ENUM ('ALLOVOISINS', 'ROVER', 'GOOGLE', 'WEBSITE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "allergies" TEXT;
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "insuranceInfo" TEXT;
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "lastVetVisit" TIMESTAMP(3);
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "microchipNumber" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Vaccine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateGiven" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "batchNumber" TEXT,
    "vetName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "petId" TEXT NOT NULL,

    CONSTRAINT "Vaccine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Vaccine_petId_idx" ON "Vaccine"("petId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Vaccine_expiryDate_idx" ON "Vaccine"("expiryDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_isActive_idx" ON "Review"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_source_idx" ON "Review"("source");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Vaccine_petId_fkey'
  ) THEN
    ALTER TABLE "Vaccine" ADD CONSTRAINT "Vaccine_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
