# Runbook de production

Ce document sert de checklist avant et apres deploiement de La Patte Doree.

## 1. Preflight local

Depuis la racine du projet :

```bash
npm run check:env
npm run check:live
npm run lint
npm run build
```

`npm run check:env` ne doit jamais afficher les valeurs des secrets. Il verifie uniquement que les variables attendues existent et que les valeurs de production les plus sensibles ont une forme coherente.

`npm run check:live` est le feu vert avant ouverture publique : il doit passer avec les vraies variables de production, un compte Stripe Live active, un webhook Live actif et une configuration de portail client Stripe.

Pour tester exactement les variables de Production Vercel :

```bash
vercel env pull .vercel/.env.production.local --environment=production
CHECK_ENV_TARGET=production CHECK_ENV_FILE=.vercel/.env.production.local node scripts/check-env.mjs
CHECK_ENV_FILE=.vercel/.env.production.local node scripts/check-stripe-live.mjs
```

## 2. Variables Vercel

Configurer ces variables dans Vercel, pour Production et Preview si besoin :

```text
DATABASE_URL
NEXTAUTH_URL=https://resadog.vercel.app
AUTH_SECRET ou NEXTAUTH_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CRON_SECRET
UPLOADTHING_TOKEN
UPLOADTHING_APP_ID
RESEND_API_KEY
ADMIN_EMAIL
RESEND_FROM
DEV_EMAIL
RESEND_BUG_FROM
BUSINESS_LEGAL_NAME
BUSINESS_SIRET
BUSINESS_ADDRESS
SUPPORT_EMAIL
CONSUMER_MEDIATOR_NAME
CONSUMER_MEDIATOR_URL
NEXT_PUBLIC_ACACED_NUMBER
PROFESSIONAL_INSURANCE
```

Points d'attention :

- `NEXTAUTH_URL` doit etre l'URL publique en `https`.
- `CRON_SECRET` doit etre long et aleatoire.
- `RESEND_FROM` doit utiliser un domaine verifie dans Resend pour eviter les blocages d'envoi.
- `RESEND_BUG_FROM` doit aussi utiliser un domaine verifie : le bouton de signalement tarif/bug s'appuie dessus.
- `NEXT_PUBLIC_ACACED_NUMBER` et `PROFESSIONAL_INSURANCE` sont obligatoires pour afficher les informations professionnelles reelles.
- En production, `STRIPE_SECRET_KEY` doit commencer par `sk_live_`. Une cle `sk_test_` bloque le preflight.

## 3. Passage de Stripe en reel

1. Terminer l'activation du compte Stripe : identite de l'entreprise, representant, compte bancaire et informations publiques.
2. Basculer Stripe en mode reel puis recuperer la cle secrete `sk_live_`.
3. Activer et configurer le portail client Stripe en mode reel, au minimum avec l'historique des factures.
4. Creer en mode reel le webhook `https://resadog.vercel.app/api/stripe/webhook` et copier son secret `whsec_`.
5. Remplacer les variables dans l'environnement **Production** de Vercel.
6. Redeployer : les variables modifiees ne s'appliquent pas aux deploiements deja construits.
7. Ne pas reutiliser les identifiants Stripe de test. Clients, abonnements, moyens de paiement et factures test n'existent pas en mode reel.
8. Lancer `npm run check:live` avec les variables Live.
9. Effectuer une vraie petite transaction, puis verifier capture, annulation/remboursement, facture et webhooks dans Stripe.

References Stripe utiles :

- [Cles API Stripe](https://docs.stripe.com/keys)
- [Checklist go-live Stripe](https://docs.stripe.com/get-started/checklist/go-live)
- [Webhooks Stripe](https://docs.stripe.com/webhooks)
- [Portail client Stripe](https://docs.stripe.com/customer-management)

## 4. Stripe

Endpoint webhook :

```text
https://resadog.vercel.app/api/stripe/webhook
```

Evenements a activer :

```text
payment_intent.succeeded
payment_intent.payment_failed
checkout.session.completed
customer.subscription.deleted
customer.subscription.updated
invoice.payment_succeeded
invoice.payment_failed
```

Flux reservation :

1. Le client cree une ou plusieurs reservations.
2. Stripe Checkout cree un PaymentIntent en capture manuelle.
3. Le webhook marque le paiement en attente et conserve les infos de carte utiles.
4. L'admin confirme la reservation.
5. L'API admin capture le paiement.

Flux annulation :

- Si le paiement est encore autorise, l'autorisation est annulee.
- Si le paiement est deja capture, Stripe lance un remboursement.

## 5. Cron Vercel

`vercel.json` planifie :

```text
/api/cron/cleanup-bookings
0 4 * * *
```

La route attend :

```text
Authorization: Bearer ${CRON_SECRET}
```

Verifier dans Vercel que les crons sont actifs apres deploiement.

## 6. UploadThing

Verifier :

- `UPLOADTHING_TOKEN`
- `UPLOADTHING_APP_ID`
- les permissions du projet UploadThing
- un upload depuis une page qui utilise les pieces jointes ou les documents animaux

## 7. Emails

Verifier :

- `RESEND_API_KEY`
- `RESEND_FROM` avec domaine verifie
- `ADMIN_EMAIL` pour les notifications de reservation
- `DEV_EMAIL` pour les rapports de bug

Tests attendus :

- demande de reservation recue par le client
- notification admin
- confirmation de reservation
- email d'echec de paiement abonnement
- rapport de bug vers l'adresse dev

## 8. Conformite avant ouverture

- entreprise declaree via le guichet unique et SIRET affiche dans les mentions legales
- activite de garde declaree a l'autorite competente lorsque requis
- ACACED a jour pour les categories d'animaux accueillies
- assurance responsabilite civile professionnelle adaptee
- mediateur de la consommation designe et affiche sur le site et dans les CGV
- protocole sanitaire, veterinaire referent et registre des animaux en place
- CGV, confidentialite, cookies et coordonnees professionnelles relus avec les informations reelles

## 9. Recette fonctionnelle apres deploiement

Tester comme un utilisateur standard :

- creer un compte et se connecter
- ajouter un chien
- creer une reservation de promenade
- creer une garderie avec plusieurs dates
- creer une visite a domicile avec plusieurs dates, plusieurs passages dans la journee et duree 30 min / 1 h
- verifier que l'adresse de prestation est obligatoire
- verifier le recapitulatif et le detail du prix avant paiement
- appliquer un coupon valide et un coupon invalide
- passer par Stripe Checkout
- revenir sur la page de succes
- verifier que la reservation apparait dans le dashboard

Tester comme admin :

- voir les reservations entrantes
- confirmer une reservation et verifier la capture Stripe
- annuler une reservation et verifier l'annulation ou le remboursement
- ajouter des frais supplementaires
- gerer disponibilites, coupons, credits et avis

Tester les abonnements :

- creer un abonnement promenade
- creer un abonnement garderie
- verifier les credits attribues
- verifier qu'un paiement annuel attribue bien 12 mois de credits en une fois
- verifier qu'un credit promenade ne peut pas payer une garderie, et inversement
- programmer une resiliation, confirmer une seconde fois, puis annuler la resiliation
- ouvrir et telecharger une facture
- simuler un renouvellement et un paiement echoue via Stripe

## 10. Deploiement

Flux standard :

```bash
git push origin main
```

L'integration Git Vercel deploie automatiquement la branche `main` en production.

Suivi :

1. Ouvrir le deploiement dans Vercel.
2. Verifier que le build passe en `READY`.
3. Tester [https://resadog.vercel.app](https://resadog.vercel.app).

## 11. Rollback

Deux options :

- Vercel Dashboard : revenir au dernier deploiement `READY`.
- Git : `git revert <sha>` puis push sur `main`.

Preferer le rollback Vercel si la correction doit etre immediate.
