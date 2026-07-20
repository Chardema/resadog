-- Les anciens abonnements à crédits restent conservés pour l'historique, mais
-- ces colonnes ne font plus partie du modèle Prisma actuel. Les rendre
-- facultatives permet de créer un abonnement Premium sans perdre les données
-- historiques de CreditBatch.
ALTER TABLE "UserSubscription"
  ALTER COLUMN "serviceType" DROP NOT NULL,
  ALTER COLUMN "billingPeriod" DROP NOT NULL,
  ALTER COLUMN "daysPerWeek" DROP NOT NULL,
  ALTER COLUMN "creditsPerMonth" DROP NOT NULL;
