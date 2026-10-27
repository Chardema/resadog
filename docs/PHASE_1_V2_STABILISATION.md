# Phase 1 V2 — stabilisation des réservations et paiements

## Objectif livré

Cette phase sécurise les opérations qui peuvent entraîner un surbooking, un double paiement ou un revenu erroné. Elle ne change pas le parcours commercial du client.

## Changements mis en place

### 1. Confirmation sans surbooking

- `ACCEPTING` réserve temporairement la capacité pendant la capture Stripe.
- Un verrou PostgreSQL est pris pour chaque couple service/date.
- La disponibilité est relue dans la même transaction que la prise de capacité.
- Toutes les recherches de disponibilité comptent `ACCEPTING` et `CANCELLING` comme capacité occupée.
- La mise à jour `PENDING -> ACCEPTING` est conditionnelle : une seule requête concurrente peut gagner.
- La capture Stripe utilise la clé `booking:<id>:confirmation-capture`.
- Si la réponse HTTP est interrompue après l'encaissement, le webhook `payment_intent.succeeded` termine `ACCEPTING -> CONFIRMED` et envoie l'email idempotent.
- Une tentative `ACCEPTING` abandonnée peut être reprise après dix minutes.

### 2. Annulation coordonnée

- `CANCELLING` empêche une confirmation et une annulation de modifier simultanément la même réservation.
- Le client et l'admin prennent cet état par mise à jour conditionnelle avant d'agir chez Stripe.
- En cas d'échec, le statut précédent est restauré ; les appels Stripe restent idempotents lors d'une nouvelle tentative.
- Le prix contractuel `Payment.amount` n'est plus écrasé lors d'une retenue de 50 %.

### 3. Checkout idempotent

- `CheckoutAttempt` conserve une tentative unique par réservation.
- Un double clic réutilise la session Stripe ouverte au lieu d'en créer une seconde.
- Une création simultanée renvoie `409` pendant deux minutes.
- Une création interrompue reprend avec la même clé d'idempotence Stripe.
- La session, le paiement local et l'état `OPEN` sont enregistrés dans une transaction unique.
- Les webhooks marquent la tentative `COMPLETED` ou `EXPIRED`.

### 4. Suppléments idempotents

- L'interface crée un UUID stable pour chaque action de débit.
- La ligne `AdditionalCharge` est créée avant l'appel Stripe.
- La même clé est utilisée en base, dans les métadonnées Stripe et comme clé d'idempotence.
- Les webhooks de paiement mettent à jour le supplément sans attribuer par erreur des points de fidélité à la réservation.

### 5. Montants et revenus fiables

- `Payment.amount` reste le montant contractuel.
- `Payment.capturedAmount` contient uniquement le montant réellement encaissé.
- `refundAmount` contient uniquement le montant remboursé.
- Le revenu net est `capturedAmount - refundAmount` pour un remboursement partiel.
- Les indicateurs admin sont calculés sur tout l'historique ; seules les lignes détaillées restent limitées à 80 pour protéger l'interface.
- La migration reconstitue les anciennes retenues partielles avec `amount + refundAmount`.

## Déploiement

À réaliser d'abord sur l'environnement de préproduction :

1. Faire une sauvegarde PostgreSQL et relever le nombre de paiements par statut.
2. Vérifier les variables `DATABASE_URL`, `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans l'environnement cible.
3. Appliquer la migration :

   ```bash
   npx prisma migrate deploy
   ```

4. Déployer l'application immédiatement après la migration.
5. Vérifier dans Stripe que le webhook actif reçoit au minimum :

   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

6. Exécuter les contrôles applicatifs :

   ```bash
   npm run check:payments
   npm run check:pricing
   npx tsc --noEmit
   npm run build
   ```

La migration a été appliquée manuellement à la production le 20 juillet 2026, après sauvegarde et validation du Preview. Le code ne l'applique pas automatiquement lors d'un build afin d'éviter toute modification involontaire d'une base cible.

### État du déploiement du 20 juillet 2026

- Sauvegarde PostgreSQL complète créée et contrôlée avant migration.
- Migration `20260719230000_harden_payment_workflows` appliquée avec succès.
- Schéma Prisma déclaré à jour après migration.
- Preview Vercel `dpl_Cyuodreq7SdypgYGseJnyyqjbok2` compilé et testé.
- Production Vercel `dpl_EiQ9c4RFz2yuujxHNQj2gZyCGYhN` prête et reliée aux domaines publics.
- Disponibilité, session, protections Checkout/annulation et pages publiques testées après bascule.
- Aucun log runtime de niveau erreur observé après le déploiement.

## Recette manuelle avant production

### Confirmation

1. Créer deux demandes incompatibles sur la même capacité.
2. Envoyer simultanément les deux validations depuis deux onglets.
3. Vérifier qu'une seule passe et que l'autre reçoit `409` avec les dates bloquées.
4. Vérifier qu'un seul PaymentIntent est capturé.

### Checkout

1. Double-cliquer ou envoyer deux requêtes Checkout identiques.
2. Vérifier qu'une seule session Stripe est créée.
3. Recharger la page et vérifier que l'URL de la session ouverte est réutilisée.
4. Laisser expirer une session et vérifier le nettoyage de la réservation abandonnée.

### Annulation et revenus

1. Tester une annulation gratuite avant la fenêtre limite.
2. Tester une annulation tardive sur une autorisation non capturée : seule la retenue de 50 % doit être encaissée.
3. Tester une annulation tardive après capture : 50 % doit être remboursé.
4. Vérifier que `amount` reste inchangé, que `capturedAmount` correspond à Stripe et que `refundAmount` correspond au remboursement.
5. Comparer le revenu net admin avec le solde de test Stripe.

### Supplément

1. Débiter un supplément depuis l'admin.
2. Répéter exactement la requête avec le même UUID.
3. Vérifier qu'un seul PaymentIntent et une seule ligne `AdditionalCharge` existent.

## Surveillance après mise en ligne

Contrôler les états transitoires restés bloqués depuis plus de quinze minutes :

```sql
SELECT "id", "status", "updatedAt"
FROM "Booking"
WHERE "status" IN ('ACCEPTING', 'CANCELLING')
  AND "updatedAt" < NOW() - INTERVAL '15 minutes';
```

Contrôler les tentatives Checkout orphelines :

```sql
SELECT "bookingId", "status", "lastError", "updatedAt"
FROM "CheckoutAttempt"
WHERE "status" = 'CREATING'
  AND "updatedAt" < NOW() - INTERVAL '5 minutes';
```

Contrôler les incohérences monétaires :

```sql
SELECT "id", "amount", "capturedAmount", "refundAmount", "status"
FROM "Payment"
WHERE "capturedAmount" < 0
   OR COALESCE("refundAmount", 0) < 0
   OR COALESCE("refundAmount", 0) > "capturedAmount";
```

## Retour arrière

Ne pas supprimer les colonnes ou les valeurs d'enum en urgence. En cas d'incident, arrêter les nouvelles actions de paiement, résoudre d'abord les éventuelles réservations `ACCEPTING`/`CANCELLING`, puis redéployer la version applicative précédente. Les ajouts de schéma sont compatibles avec les anciennes lectures tant qu'aucun état transitoire ne reste actif.
