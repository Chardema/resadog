# Mise en ligne du plan acompte + solde (PR #31) : checklist

Rédigée le 27/11/2026 par lecture du code (aucune lecture ni écriture en production). Rien de ce qui suit n'est fait. Chaque étape de production demande l'accord explicite de Christopher (section 8).

## Choix assumés (ne bloquent pas la mise en ligne)
- **CGV sans relecture par un juriste** : choix assumé du propriétaire. Il reste à dater la version (§7) et à vérifier les taux L214-2 de `LEGAL_INTEREST_RATES` ; les traductions EN/ES des CGV ont été écrites à la main.
- **Vercel reste sur Hobby** : choix assumé. Conséquences pour les crons (§3) : une exécution par jour au maximum, heure imprécise (à l'heure près), pas de nouvelle tentative automatique. Vercel réserve Hobby à un usage non commercial.

## 0. Point critique : la garde `sk_test_` bloque le plan en production
`src/lib/payment-plan-stripe-guard.ts` refuse toute opération du plan si `STRIPE_SECRET_KEY` ne commence pas par `sk_test_`. En production la clé est `sk_live_`. Donc, même avec `PAYMENT_PLAN_ENABLED_IN_PRODUCTION = true`, le plan reste bloqué et, pire, **casse** les réservations éligibles (total ≥ 100 € et départ ≥ 14 jours) :
- Checkout de l'acompte : `assertPaymentPlanStripeTestMode("checkout-acompte")` (`src/app/api/stripe/checkout/route.ts:191` et `:202`) lève une erreur, réponse 503 `PAYMENT_PLAN_UNAVAILABLE` (pas de repli vers le paiement intégral, choix délibéré) ;
- capture à l'acceptation : `src/app/api/admin/bookings/[bookingId]/status/route.ts:164` (503, la demande reste PENDING) ;
- prélèvement du solde : `src/lib/balance-collection.ts:605` et `:866` (le cron répond 502, aucun rappel J-14 n'est envoyé) ;
- reprise du solde `balance-collection.ts:490` ; retenue du barème `src/lib/deposit-cancellation.ts:343`.

**Passer la constante à true ne suffit donc pas.** La PR d'activation doit aussi modifier la garde, par exemple : clé `sk_test_` toujours acceptée ; clé `sk_live_` acceptée seulement si `isProductionDeployment()` ET `PAYMENT_PLAN_ENABLED_IN_PRODUCTION` ET une nouvelle constante `PAYMENT_PLAN_LIVE_STRIPE_ALLOWED = true` ; tout le reste refusé. Ajouter des tests (prod + sk_live_ autorisé seulement avec les deux constantes ; aperçu + sk_live_ refusé).

## 1. Webhook Stripe live : 2 événements à ajouter
- Noms exacts : `payment_intent.canceled` et `charge.expired`.
- Source dans le code : `src/app/api/stripe/webhook/route.ts:81` (`expireBookingAuthorization`) et `:85` (`expireAuthorizationFromCharge`), logique dans `src/lib/authorization-expiry.ts`.
- Endpoint : l'endpoint live existant `/api/stripe/webhook` du domaine de production (la doc `PRODUCTION_DEPLOYMENT.md` cite encore `resadog.vercel.app` : à confirmer dans le Dashboard, le site est sur lapatte-doree.fr). Ne pas créer un second endpoint : le secret `STRIPE_WEBHOOK_SECRET` de production est celui de l'endpoint existant.
- Opération (Dashboard Stripe, compte live, mode Live, Développeurs > Webhooks > l'endpoint de production > « Modifier la destination » > ajouter les 2 événements > enregistrer). Ne pas toucher à l'URL ni au secret.
- À vérifier : l'URL de l'endpoint est bien celle de la production ; il y a bien 14 événements dont les 2 nouveaux ; le secret de signature n'a pas changé (pas de « révéler/renouveler ») ; l'endpoint reste « Activé ». Après l'activation du code, Stripe > Webhooks > l'endpoint > tentatives récentes : les deux types d'événements reçus doivent répondre 200.
- Ordre : après le déploiement de #31 (le code les traite déjà, mais avec le plan fermé il répond `DISABLED`). Sans eux, le cron `cleanup-bookings` sert de repli avec un jour de retard.

## 2. Migration production (3 migrations additives)
1. `20261126120000_add_deposit_balance_plan` : valeur `EXPIRED` des enums `BookingStatus` et `PaymentStatus` ; enums `PaymentPlan` (`FULL`, `DEPOSIT_BALANCE`), `InstallmentKind`, `InstallmentStatus` ; 5 colonnes sur `Booking` (`paymentPlan` NOT NULL DEFAULT 'FULL', `balanceAmount`, `balanceDueAt`, `mandateAcceptedAt`, `mandateLegalVersion`) ; colonne `Payment.stripePaymentMethodId` ; table `BookingInstallment` avec 4 index et une clé étrangère `ON DELETE CASCADE` vers `Booking` ; index `Booking(paymentPlan, balanceDueAt)`. Les réservations existantes passent `FULL`.
2. `20261127090000_add_installment_checkout_session` : colonne nullable `BookingInstallment.stripeCheckoutSessionId`.
3. `20261127180000_add_payment_default_cancellation_origin` : valeur `PAYMENT_DEFAULT` de l'enum `CancellationOrigin`.
- **Ordre impératif : migrer AVANT le déploiement de #31.** Le Prisma Client du nouveau code lit les nouvelles colonnes dans presque toutes les requêtes sur `Booking` et `Payment` : déployer le code sur une base non migrée casserait le site. L'ancien code (main) ignore les nouvelles colonnes : migrer avant est sans risque.
- Sauvegarde avant : créer une branche Neon de la base de production (Console Neon > projet de production > Branches > Create branch depuis la branche principale, nom `avant-acompte-2026-11-27`), ou noter l'horodatage pour une restauration à un point dans le temps (Neon Restore). Vérifier la fenêtre de restauration du plan Neon. Les ajouts d'enum sont validés immédiatement et ne s'annulent pas par SQL : la branche est la vraie sécurité.
- Commande exacte (Mac mini, worktree de la branche à fusionner, Node 24), lancée par moi (Mac mini · Dev) avec accord explicite : `DATABASE_URL="<DIRECT_URL de production, lue sans l'afficher>" npx prisma migrate status` d'abord (lecture seule : doit lister exactement ces 3 migrations en attente et rien d'autre ; si une autre apparaît, STOP), puis `DATABASE_URL="<même valeur>" npx prisma migrate deploy`. `prisma.config.ts` lit `DATABASE_URL` : y mettre la `DIRECT_URL` (connexion directe, pas le pooler). Les variables de production ne sont pas modifiées : la valeur n'est passée qu'au processus.
- Vérification après : `prisma migrate status` répond « Database schema is up to date » ; `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3` ; `SELECT count(*) FROM "Booking" WHERE "paymentPlan" <> 'FULL'` = 0 ; le site et l'admin répondent normalement.
- Retour arrière : (a) sans activation du plan, le plus simple est de ne rien annuler (colonnes inertes) ; (b) restauration Neon vers la branche ou le point dans le temps pris avant (perd les écritures faites depuis : à éviter une fois des réservations prises) ; (c) SQL de suppression si besoin : `DROP TABLE "BookingInstallment"; ALTER TABLE "Booking" DROP COLUMN "paymentPlan", DROP COLUMN "balanceAmount", DROP COLUMN "balanceDueAt", DROP COLUMN "mandateAcceptedAt", DROP COLUMN "mandateLegalVersion"; ALTER TABLE "Payment" DROP COLUMN "stripePaymentMethodId"; DROP TYPE "InstallmentStatus"; DROP TYPE "InstallmentKind"; DROP TYPE "PaymentPlan"; DELETE FROM "_prisma_migrations" WHERE migration_name IN (...les 3...)`. Risque : les valeurs ajoutées aux enums (`EXPIRED`, `PAYMENT_DEFAULT`) ne se retirent pas sans recréer les types ; ne jamais supprimer les colonnes si des réservations `DEPOSIT_BALANCE` existent (perte des soldes).

## 3. Cron du solde
- `vercel.json` : `{ "path": "/api/cron/collect-balances", "schedule": "15 4 * * *" }` (3e cron, après `cleanup-bookings` à 04:00 et `booking-reminders` à 16:00). Il est enregistré par Vercel dès le déploiement de #31, avant l'activation : tant que le plan est fermé, la route répond `{ success: true, enabled: false }` sans rien faire (`src/app/api/cron/collect-balances/route.ts:14-16`).
- `CRON_SECRET` : déjà présent en production (nom `CRON_SECRET` dans les 34 empreintes de variables de production, vérifié sans lire la valeur). La route compare l'en-tête `Authorization: Bearer` (`route.ts:11`) ; Vercel l'envoie automatiquement aux crons. Aucune variable à ajouter.
- Limites Hobby : 100 crons par projet (depuis le 20/01/2026), donc le 3e passe ; **une seule exécution par jour au maximum** (une expression plus fréquente fait échouer le déploiement) ; **horaire imprécis à l'heure près** : `15 4 * * *` peut partir entre 04:00 et 04:59 UTC (05:00-05:59 à Paris en hiver), et l'ordre avec `cleanup-bookings` n'est pas garanti (le code n'en dépend pas) ; pas de nouvelle tentative automatique par Vercel : un solde raté est retenté le lendemain (relances J-5 et J-3, annulation à J-2 à 12:00 heure de Paris, acompte conservé).
- Vérifier la première exécution : Vercel > projet > Logs/Cron Jobs > `/api/cron/collect-balances` : statut 200 ; tant que le plan est fermé, corps `enabled: false`. Après activation, la première exécution utile a lieu quand une réservation du plan atteint J-14 (e-mail d'avis) puis J-7 : prévoir un contrôle ce jour-là dans Stripe (PaymentIntent `booking_balance`, `origin: off_session`) et dans l'admin (« Acompte et solde encaissés »). Aucun test manuel avec la clé live ; le `dryRun` est le seul appel manuel envisageable (avec accord).

## 4. Activation
- `PAYMENT_PLAN_ENABLED_IN_PRODUCTION` est une **constante codée en dur** dans `src/lib/payment-plan.ts:14` : aucune variable Vercel. Activer = une PR (commit) qui met `true`, adapte la garde (§0), met à jour la date des CGV (§7) et les tests, puis merge = déploiement automatique en production.
- Coupe-circuit : une PR de retour à `false` (ou revert), ou la promotion du déploiement précédent depuis Vercel (Instant Rollback, environ une minute, sans nouveau build). Fermer le plan n'annule pas les réservations déjà au plan (voir §6).
- Preuve que la production est fermée avant activation : `tests/payment-plan-environment.test.ts` (production fermée, `sk_live_` refusée).

## 5. Ordre exact des opérations
1. Accord de Christopher (§8). Vérifier que la PR #31 est verte et que `main` n'a pas bougé (merge de `origin/main` si besoin, sans rebase).
2. Sauvegarde Neon de la production (branche). Coupe-circuit : rien n'a changé.
3. `prisma migrate status` puis `prisma migrate deploy` sur la production (§2). Coupe-circuit : site inchangé (colonnes inertes) ; retour arrière via la branche Neon.
4. Sortir #31 du brouillon et la fusionner (merge commit) avec le plan fermé : déploiement automatique, enregistrement du 3e cron. Coupe-circuit : Instant Rollback du déploiement précédent. Vérifier : déploiement Ready, `/health`, accueil, /booking, /tarifs et CGV inchangés (version du 13/09/2026), 34 variables de production identiques (`hashenv.sh`), cron en 200 `enabled: false`, un paiement intégral reste possible (jusqu'au Checkout).
5. Ajouter les 2 événements au webhook live (§1). Coupe-circuit : les retirer dans le Dashboard.
6. PR d'activation (§4) : constante à `true`, garde adaptée, version CGV datée du jour, tests. CI verte, aperçu vérifié. Fusion = activation. Coupe-circuit : constante à `false` ou Instant Rollback.
7. Vérifier en production : /legal/cgv affiche la nouvelle version ; /booking propose le plan sur une simulation éligible ; une vraie réservation éligible avec une vraie carte (Christopher ou compte équipe) jusqu'à l'autorisation de l'acompte, puis annulation de la demande côté admin pour libérer l'autorisation sans frais (accord spécifique) ; webhooks 200 ; cron du lendemain en 200.

## 6. Réservations existantes à l'activation
- **Confirmées et en attente au paiement intégral** : la migration les met `paymentPlan = FULL`. Le cron de solde ne sélectionne que `paymentPlan: "DEPOSIT_BALANCE"` (`src/lib/balance-collection.ts:845-850`) ; la capture du plan n'agit que pour `isDepositBalanceBooking` (`status/route.ts:162`) ; le barème d'annulation du plan ne vise que les réservations `DEPOSIT_BALANCE` (`src/lib/deposit-cancellation.ts:15`, `:474`). Elles sont inchangées.
- **Demandes PENDING non encore payées** : le plan est décidé à la création du Checkout (`checkout/route.ts:187-190`, `resolveCheckoutDepositPlan`). Un client qui paie après l'activation une demande éligible (≥ 100 €, départ ≥ 14 jours après maintenant) passe au plan acompte avec le consentement du solde, et le calcul se fait à ce moment. Une session Checkout déjà ouverte garde ses conditions d'origine (`checkout/route.ts:198-204`).
- **Demandes PENDING déjà autorisées (« empreinte active »)** : le traitement d'expiration (`src/lib/authorization-expiry.ts:20`, appelé par `cleanup-bookings/route.ts:117-118` et par les événements `payment_intent.canceled` / `charge.expired`) devient actif pour tous les plans : au plus 20 demandes par passage, celles dont l'autorisation est morte passent `EXPIRED` ; le client est prévenu par e-mail si l'expiration date de moins de 7 jours et que la garde est à venir, sinon clôture sans e-mail. Prévoir de regarder l'admin le lendemain de l'activation.
- **Version des CGV** : `getLegalDocumentVersion()` change (`src/lib/legal.ts:45-48`) ; le Checkout refuse une version périmée (`checkout/route.ts:80-86`, 400) : un client qui avait la page /booking ouverte avant le déploiement doit la recharger. Les acceptations déjà enregistrées ne changent pas.

## 7. Version des CGV
- Source unique : `src/lib/legal.ts:40-43`. Plan actif : `PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION = "2026-11-27"` et `PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION_LABEL = "27 novembre 2026"`. Plan fermé : `STANDARD_LEGAL_DOCUMENT_VERSION = "2026-09-13"` / « 13 septembre 2026 ». La date affichée vient de cette constante pour le FR, l'EN et l'ES (elle est rendue telle quelle, sans clé de traduction) : `/legal/cgv`, `/legal/confidentialite`, `/legal/mentions-legales`, `/booking` et `/subscriptions` (case d'acceptation).
- Elle est déjà au 27/11/2026. Si l'activation a lieu un autre jour, la mettre à cette date dans la PR d'activation (valeur ISO + libellé) ; les tests qui citent la date sont à adapter.

## 8. Accords explicites de Christopher, un par étape de production
1. Sauvegarde Neon de la production (création d'une branche).
2. `prisma migrate status` en lecture seule puis `prisma migrate deploy` sur la production.
3. Sortie du brouillon et fusion de #31 avec le plan fermé (déploiement en production, enregistrement du cron).
4. Ajout des 2 événements au webhook Stripe live (opération manuelle dans le Dashboard).
5. Approbation du 3e cron (`collect-balances`, Hobby).
6. PR d'activation : constante `true`, garde adaptée aux clés live, date des CGV : accord sur le contenu, puis accord sur sa fusion.
7. Test de bout en bout en production avec une vraie carte, puis annulation de la demande de test.
8. Éventuel retour arrière (constante à `false` / Instant Rollback / restauration Neon) : accord au moment voulu, restauration Neon seulement en dernier recours.
