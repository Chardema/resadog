# Plan de paiement « acompte + solde » (DEPOSIT_BALANCE)

État : **implémenté, désactivé**. Tant que `PAYMENT_PLAN_ENABLED` vaut `false`, le site se comporte exactement comme `main` : toutes les réservations restent en paiement intégral (plan `FULL`).

Ce document liste le fonctionnement du plan et tout ce qui doit être fait, **au déploiement et avec l'accord du propriétaire**, avant de l'activer.

## 1. Fonctionnement

### 1.1 Éligibilité

Une réservation passe en plan `DEPOSIT_BALANCE` seulement si **toutes** ces conditions sont réunies :

- drapeau `PAYMENT_PLAN_ENABLED` à `true` ;
- total **≥ 100 €** (`DEPOSIT_MIN_TOTAL`) ;
- début de la garde **≥ 14 jours** après la demande (`DEPOSIT_MIN_LEAD_DAYS`) ;
- service éligible (`DEPOSIT_ELIGIBLE_SERVICES` : hébergement, garde à domicile, visites, garderie ; le seuil de 100 € écarte de lui-même les prestations isolées) ;
- paiement par carte en ligne (les réservations directes, espèces ou virement, ne sont pas concernées).

Sinon, plan `FULL` : flux actuel inchangé (autorisation du total, capture à l'acceptation, annulation gratuite jusqu'à 48 h).

Les constantes sont dans `src/lib/payment-plan.ts`.

### 1.2 Calendrier

| Moment | Ce qui se passe |
|---|---|
| Réservation | Checkout autorise l'**acompte de 30 %** du total (`DEPOSIT_RATE`), arrondi à l'euro supérieur. Le client coche une case dédiée qui autorise le prélèvement du solde sur sa carte (mandat MIT). La carte est enregistrée chez Stripe. |
| Acceptation par l'équipe | L'acompte est **capturé**. Le solde (total − acompte) est planifié (`BookingInstallment` `BALANCE`, statut `SCHEDULED`, échéance J-7). |
| J-14 | E-mail de rappel : montant et date du prélèvement à venir. |
| **J-7** | Le cron prélève le solde **hors session** (`off_session`) sur la carte enregistrée pour cette réservation. |
| Échec | E-mail au client avec un lien vers une **session Checkout fraîche** (`/dashboard/bookings/[id]/pay`), alerte à l'équipe. Nouvelle tentative au passage quotidien suivant, sauf refus définitif (authentification requise, carte expirée…). |
| J-5 et J-3 | Relances au client et alertes à l'équipe si le solde est toujours impayé. |
| **J-2, 12:00 (Paris)** | Annulation automatique pour défaut de paiement (origine `PAYMENT_DEFAULT`), **acompte conservé**. |
| Fin du solde | Facture finale unique, acompte déduit. |

Les échéances sont calculées sur des **dates** (« échéance atteinte »), jamais sur l'heure d'exécution du cron : un passage en retard d'une heure ne change rien.

### 1.3 Barème d'annulation client (plan DEPOSIT_BALANCE)

| Annulation par le client | Effet |
|---|---|
| Plus de 7 jours avant le début | Gratuite : autorisation libérée, ou acompte (et solde éventuel) remboursés intégralement. |
| Entre 7 jours et 48 h | Acompte conservé ; le solde déjà prélevé est remboursé. |
| Moins de 48 h | 50 % du total retenus, le reste remboursé. |

La retenue est toujours bornée aux sommes réellement encaissées. Annulation par l'équipe ou refus de la demande : remboursement ou libération intégrale. La non-présentation tient compte de l'acompte et du solde. Chaque remboursement porte une clé d'idempotence propre au PaymentIntent visé (acompte ou solde) : un rejeu ne rembourse jamais deux fois.

Code : `src/lib/deposit-cancellation.ts`, `src/lib/team-booking-cancellation.ts`, `src/app/api/bookings/[bookingId]/cancel/route.ts`, route `no-show`.

### 1.4 Expiration des autorisations

Une autorisation carte non capturée expire (7 jours au plus, moins pour certains réseaux). Le cron `cleanup-bookings` relit Stripe pour les demandes en attente depuis plus de 48 h, alerte l'équipe quand l'autorisation expire dans moins de 48 h, et passe la demande au statut `EXPIRED` (e-mail au client) quand elle a expiré. Il n'y a plus d'« Empreinte active » morte dans l'admin. Les webhooks `payment_intent.canceled` et `charge.expired` font le même traitement en temps réel (voir §4).

Code : `src/lib/authorization-expiry.ts`.

### 1.5 Garanties du prélèvement du solde

- Un seul débit par tentative : verrou en base (statut `PROCESSING` posé par une mise à jour conditionnelle) et clé d'idempotence Stripe `booking:{id}:balance:{n}`.
- Un échec n'écrase jamais un succès.
- Une tentative interrompue est réconciliée avec Stripe avant toute nouvelle tentative, jamais redébitée à l'aveugle.
- Prélèvement automatique et session Checkout de reprise s'excluent.
- La réussite du solde ne rejoue ni la confirmation, ni la fidélité, ni l'e-mail d'acompte.
- La carte enregistrée pour le solde (`Payment.stripePaymentMethodId`) ne sert **qu'au solde**. Le débit automatique de suppléments (`/api/admin/additional-charges`) reste neutralisé (`ADDITIONAL_CHARGES_ENABLED = false`, PR #27) ; un supplément devra passer par une future « demande de paiement » acceptée par le client. Ce comportement est verrouillé par des tests Vitest (`src/lib/__tests__/additional-charges-*.test.ts`).

Code : `src/lib/balance-collection.ts`, `src/app/api/cron/collect-balances/route.ts`.

## 2. Drapeau `PAYMENT_PLAN_ENABLED`

- **Constante de code** dans `src/lib/payment-plan.ts`, valeur actuelle `false`. Ce n'est **pas** une variable d'environnement Vercel : l'activation passe par une modification de code relue et déployée.
- Quand elle vaut `false` : plan `FULL` pour tout le monde, CGV actuelles affichées, cron `collect-balances` sans effet (il répond `{ "success": true, "enabled": false }`), traitement des expirations inactif.
- Aucune nouvelle variable d'environnement n'est requise. Le plan réutilise `CRON_SECRET`, `STRIPE_*` et `RESEND_API_KEY`.

## 3. Migration Prisma (à appliquer au déploiement)

Trois migrations **additives** (nouvelles colonnes nullables ou avec défaut, nouvelles tables, nouvelles valeurs d'enum ; aucune suppression, aucun renommage) :

- `prisma/migrations/20261126120000_add_deposit_balance_plan` : enum `PaymentPlan`, table `BookingInstallment`, statuts `EXPIRED`, colonnes du plan sur `Booking` et `Payment` (les réservations existantes passent `FULL` par défaut) ;
- `prisma/migrations/20261127090000_add_installment_checkout_session` : colonne `BookingInstallment.stripeCheckoutSessionId` ;
- `prisma/migrations/20261127180000_add_payment_default_cancellation_origin` : valeur `PAYMENT_DEFAULT` de `CancellationOrigin`.

Elles n'ont été exécutées sur aucune base. À appliquer avec `prisma migrate deploy` lors du déploiement, **après** validation du propriétaire et une sauvegarde de la base de production. Elles sont sans effet fonctionnel tant que le drapeau vaut `false`, et peuvent donc être déployées avant l'activation.

## 4. Réglages Stripe live (à faire au déploiement, NE PAS activer maintenant)

À faire dans le Dashboard Stripe, compte live, **uniquement avec l'accord du propriétaire** :

1. Ajouter à l'endpoint webhook live (`/api/stripe/webhook`) les événements :
   - `payment_intent.canceled` ;
   - `charge.expired`.

   Le code les traite déjà. Sans eux, le cron `cleanup-bookings` sert de repli (détection de l'expiration avec au plus un jour de retard).
2. Recommandé : libellé de relevé « LA PATTE DOREE » à la place de « MM SERVICES », pour que le client reconnaisse un prélèvement différé (moins de litiges).

Ne modifier ni l'endpoint ni le libellé avant l'activation.

## 5. Cron Vercel : À APPROUVER au déploiement

`vercel.json` (qui n'accepte pas de commentaires) déclare désormais :

```json
{ "path": "/api/cron/collect-balances", "schedule": "15 4 * * *" }
```

- **Heure choisie : 04:15 UTC** (05:15 à Paris en hiver, 06:15 en été). Le cron `cleanup-bookings` tourne déjà à `0 4 * * *`. Décaler le solde d'un quart d'heure évite que les deux routes s'exécutent en même temps : elles lisent et écrivent les mêmes réservations et paiements, et le traitement des expirations passe avant le prélèvement du solde. Sur le plan Hobby, l'heure n'est garantie qu'à l'heure près (±59 min) : `15 4 * * *` peut partir n'importe quand entre 04:00 et 04:59 UTC, donc avant ou après `cleanup-bookings` (04:00). L'ordre n'est pas garanti et le code ne doit pas en dépendre : l'idempotence et les verrous sont déjà en place. Le décalage réduit seulement les recouvrements.
- La route `/api/cron/collect-balances` exige `Authorization: Bearer ${CRON_SECRET}` (401 sinon) et ne fait rien tant que `PAYMENT_PLAN_ENABLED` vaut `false`. Elle accepte `?dryRun=true` (aucun effet) et, hors production seulement, `?now=…` (date de référence de test).

> **Avertissement plan Vercel** (vérifié dans la documentation Vercel le 27/11/2026 : [usage et tarifs des crons](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) et changelog du 20/01/2026).
>
> - **Nombre de crons.** Depuis le 20/01/2026, tous les plans, Hobby compris, acceptent jusqu'à 100 crons par projet. L'ancienne limite Hobby de 2 crons par équipe n'existe plus. **C'est le 3e cron du projet** (`cleanup-bookings`, `booking-reminders`, `collect-balances`) : il ne devrait donc plus être refusé pour son nombre. **À VÉRIFIER** sur le compte au moment du déploiement, car le plan de l'équipe `chardemas-projects` n'est pas confirmé. Si Vercel refuse quand même le déploiement, retirer l'entrée de `vercel.json` (la route reste appelable manuellement ou par un ordonnanceur externe protégé par `CRON_SECRET`), ou regrouper l'appel dans un cron existant.
> - **Fréquence (Hobby).** Un cron ne peut s'exécuter qu'une fois par jour : une expression plus fréquente fait échouer le déploiement. `15 4 * * *` respecte cette limite.
> - **Précision horaire (Hobby).** L'heure n'est garantie qu'à ±59 min (voir plus haut) : l'ordre avec `cleanup-bookings` n'est pas garanti.
> - **Usage commercial.** Selon Vercel, le plan Hobby est réservé à un usage personnel non commercial. À garder en tête pour un site commercial.

Ajouter ce cron est une modification de configuration de production : il doit être validé par le propriétaire au moment du déploiement. Il est sans effet tant que le drapeau vaut `false`. Après le déploiement, vérifier dans Vercel que les trois crons apparaissent comme actifs.

## 6. CGV et version des documents légaux

- La nouvelle version des CGV (terme « acompte », jamais « arrhes » ; mandat de prélèvement du solde ; barème ; droit de rétractation de 14 jours le cas échéant ; intérêts L214-2 sur l'acompte au-delà de 3 mois, déduits du solde) n'est affichée que si le drapeau vaut `true`.
- **À faire relire par un juriste avant l'activation** (qualification acompte ou arrhes, clause de retenue, rétractation, intérêts). Ce dépôt ne contient aucun avis juridique.
- `PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION` et son libellé (`src/lib/legal.ts`, aujourd'hui `2026-11-27`) : **à dater du jour de l'activation**. Cette version est enregistrée avec le consentement de chaque client ; elle doit correspondre au texte réellement publié.
- Taux d'intérêt légal (`LEGAL_INTEREST_RATES` dans `src/lib/payment-plan.ts`) : à vérifier sur Légifrance ou auprès de la Banque de France avant l'activation, puis à mettre à jour chaque semestre.
- Réservations existantes : inchangées. Le plan ne s'applique qu'aux nouvelles réservations faites après la publication de la nouvelle version.

## 7. Points comptables (à valider avec le comptable)

- **Acompte encaissé** : capturé à l'acceptation, il est un encaissement du mois de capture (micro-entreprise : chiffre d'affaires déclaré sur les sommes encaissées). Ne pas retenir les fonds manuellement sans avis du comptable ou de l'URSSAF.
- **Facture unique après le solde** : aucune facture n'est émise pour l'acompte. La facture finale est créée au paiement du solde, avec une ligne « Acompte déjà versé le … » déduite, et les éventuels intérêts L214-2 déduits du solde.
- **Remboursements** : faits sur le PaymentIntent qui porte l'argent (acompte ou solde). Les frais Stripe d'un paiement capturé puis remboursé ne sont pas restitués ; un plan fractionné coûte environ 0,25 € de frais fixes de plus par réservation.
- **Acompte conservé** (annulation tardive ou défaut de paiement) : il reste encaissé. Son traitement comptable (indemnité, pas une prestation exécutée) est à confirmer avec le comptable.
- Le module finance (`src/lib/finance-server.ts`) distingue acompte et solde ; `npm run check:finance` vérifie les invariants.

## 8. Tests sur l'aperçu (preview)

Rien n'est automatisé ici : ce sont les prérequis à réunir avant de tester le plan de bout en bout sur une preview Vercel.

1. **Base de preview** : une base de test distincte de la production, sur laquelle les migrations du §3 ont été appliquées. Ne jamais appliquer une migration ni lancer un test sur la base de production.
2. **Clés Stripe de test** : vérifier que la preview utilise `sk_test_…` (et le secret webhook de test). S'arrêter si une clé live est détectée.
3. **Activation hors production** : passer `PAYMENT_PLAN_ENABLED` à `true` sur une branche de test uniquement, jamais sur `main` ni en production avant l'accord du propriétaire.
4. **Cartes de test Stripe** :
   - `4000002500003155` : 3DS à la réservation, solde ensuite sans authentification (succès) ;
   - `4000002760003184` : le solde exige une authentification (échec, lien de reprise, paiement sur session) ;
   - `4000000000009995` (fonds insuffisants) et `4000000000000341` (débit refusé) : échecs, relances, annulation à J-2 ;
   - `4000000000000069` : carte expirée.
5. **Date de référence** : sur la preview, appeler `/api/cron/collect-balances?now=<date ISO>` (avec `CRON_SECRET`) pour simuler J-7, J-5, J-3 et J-2. Ce paramètre est refusé en production.
6. **E-mails** : vérifier que Resend n'envoie rien à de vrais clients depuis la preview.
