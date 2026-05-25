# Runbook de production

Ce document sert de checklist avant et apres deploiement de La Patte Doree.

## 1. Preflight local

Depuis la racine du projet :

```bash
npm run check:env
npm run lint
npm run build
```

`npm run check:env` ne doit jamais afficher les valeurs des secrets. Il verifie uniquement que les variables attendues existent et que les valeurs de production les plus sensibles ont une forme coherente.

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
```

Points d'attention :

- `NEXTAUTH_URL` doit etre l'URL publique en `https`.
- `CRON_SECRET` doit etre long et aleatoire.
- `RESEND_FROM` doit utiliser un domaine verifie dans Resend pour eviter les blocages d'envoi.
- En production, preferer une cle Stripe live. Une cle `sk_test_` est acceptable uniquement pour une recette Stripe non publique.

## 3. Stripe

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

## 4. Cron Vercel

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

## 5. UploadThing

Verifier :

- `UPLOADTHING_TOKEN`
- `UPLOADTHING_APP_ID`
- les permissions du projet UploadThing
- un upload depuis une page qui utilise les pieces jointes ou les documents animaux

## 6. Emails

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

## 7. Recette fonctionnelle apres deploiement

Tester comme un utilisateur standard :

- creer un compte et se connecter
- ajouter un chien
- creer une reservation de promenade
- creer une garderie avec plusieurs dates
- creer une visite a domicile avec plusieurs dates, plusieurs passages dans la journee et duree 30 min / 1 h
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
- simuler un renouvellement et un paiement echoue via Stripe

## 8. Deploiement

Flux standard :

```bash
git push origin main
```

L'integration Git Vercel deploie automatiquement la branche `main` en production.

Suivi :

1. Ouvrir le deploiement dans Vercel.
2. Verifier que le build passe en `READY`.
3. Tester [https://resadog.vercel.app](https://resadog.vercel.app).

## 9. Rollback

Deux options :

- Vercel Dashboard : revenir au dernier deploiement `READY`.
- Git : `git revert <sha>` puis push sur `main`.

Preferer le rollback Vercel si la correction doit etre immediate.
