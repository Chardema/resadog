# Runbook de production

Ce document sert de checklist avant et apres deploiement de La Patte Doree.

## 1. Preflight local

Depuis la racine du projet :

```bash
npm run check:env
npm run check:env:production
npm run check:live
npm run lint
npm run build
```

Ces contrôles ne doivent jamais afficher les valeurs des secrets. `check:env` valide le développement local et `check:env:production` applique les règles strictes de production.

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
TWO_FACTOR_ENCRYPTION_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APPLE_CLIENT_ID
APPLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_BILLING_PORTAL_CONFIGURATION_ID
STRIPE_PREMIUM_PRICE_ID
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
BUSINESS_PHONE
PUBLICATION_DIRECTOR
PRIVACY_EMAIL
BUSINESS_TAX_STATUS
BUSINESS_VAT_NUMBER (si BUSINESS_TAX_STATUS=VAT_SUBJECT)
SUPPORT_EMAIL
CONSUMER_MEDIATOR_NAME
CONSUMER_MEDIATOR_ADDRESS
CONSUMER_MEDIATOR_URL
PROFESSIONAL_INSURANCE
```

Points d'attention :

- `NEXTAUTH_URL` doit etre l'URL publique en `https`.
- `AUTH_SECRET` doit etre aleatoire et faire au moins 32 caracteres.
- `TWO_FACTOR_ENCRYPTION_KEY` doit encoder exactement 32 octets (64 caracteres hexadecimaux ou base64). Generer une cle dediee avec `openssl rand -base64 32`; ne jamais reutiliser une cle OAuth.
- Google et Apple sont optionnels, mais chaque couple ID/secret doit etre configure en entier. En l'absence d'un couple, le bouton correspondant est masque.
- `CRON_SECRET` doit etre long et aleatoire.
- `RESEND_FROM` doit utiliser un domaine verifie dans Resend pour eviter les blocages d'envoi.
- `RESEND_BUG_FROM` doit aussi utiliser un domaine verifie : le bouton de signalement tarif/bug s'appuie dessus.
- `BUSINESS_PHONE`, `PUBLICATION_DIRECTOR`, `PRIVACY_EMAIL` et `BUSINESS_TAX_STATUS` reprennent les informations confirmees dans `src/lib/legal.ts`. La franchise en base de TVA est actuellement declaree avec la mention de l'article 293 B du CGI.
- Les trois coordonnees du mediateur doivent encore etre renseignees avant publication des pages juridiques.
- L’attestation ACACED vérifiée est centralisée dans `src/lib/legal.ts` : n° 2026/f9c3-6ee5, catégories chien et chat, délivrée le 8 juin 2026.
- `PROFESSIONAL_INSURANCE` reste optionnel tant que le contrat n’est pas souscrit. Le site ne doit jamais inventer cette information.
- En production, `STRIPE_SECRET_KEY` doit commencer par `sk_live_`. Une cle `sk_test_` bloque le preflight.
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` doit pointer vers la configuration Live du portail client Stripe (`bpc_...`) pour garder la page de gestion Premium coherent avec La Patte Doree.
- `STRIPE_PREMIUM_PRICE_ID` doit pointer vers le prix Stripe Live de l'abonnement Premium mensuel a 9,99€ (`price_...`).

## 3. Authentification, OAuth et 2FA

Callbacks a declarer dans les consoles des fournisseurs, en remplacant le domaine si necessaire :

```text
https://resadog.vercel.app/api/auth/callback/google
https://resadog.vercel.app/api/auth/callback/apple
```

Google :

1. Creer un client OAuth 2.0 de type application Web.
2. Ajouter l'origine `https://resadog.vercel.app`.
3. Ajouter le callback Google ci-dessus.
4. Copier les valeurs dans `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

Apple :

1. Creer un Services ID avec « Sign in with Apple ».
2. Declarer le domaine et le callback Apple ci-dessus.
3. Generer le client secret Apple signe cote serveur et le stocker dans `APPLE_CLIENT_SECRET` avec son Services ID dans `APPLE_CLIENT_ID`.
4. Prevoir sa rotation avant l'expiration indiquee par Apple.

Recette securite obligatoire :

- une inscription par mot de passe reste bloquee avant clic sur le lien email ;
- un lien email est a usage unique et expire apres 24 heures ;
- Google et Apple creent ou rattachent le meme compte uniquement avec l'adresse verifiee du fournisseur ;
- l'activation 2FA fonctionne avec un QR TOTP et affiche 10 codes de recuperation une seule fois ;
- une connexion mot de passe et une connexion sociale demandent toutes deux la 2FA lorsqu'elle est active ;
- un code de recuperation ne fonctionne qu'une fois ;
- la desactivation 2FA et la reinitialisation du mot de passe revoquent les anciennes sessions ;
- `npm audit --omit=dev` ne signale aucune vulnerabilite connue.

## 4. Passage de Stripe en reel

1. Terminer l'activation du compte Stripe : identite de l'entreprise, representant, compte bancaire et informations publiques.
2. Basculer Stripe en mode reel puis recuperer la cle secrete `sk_live_`.
3. Activer et configurer le portail client Stripe en mode reel, au minimum avec l'historique des factures.
4. Copier l'identifiant de configuration du portail client (`bpc_...`) dans `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`.
5. Creer en mode reel le webhook `https://resadog.vercel.app/api/stripe/webhook` et copier son secret `whsec_`.
6. Remplacer les variables dans l'environnement **Production** de Vercel.
7. Redeployer : les variables modifiees ne s'appliquent pas aux deploiements deja construits.
8. Ne pas reutiliser les identifiants Stripe de test. Clients, abonnements, moyens de paiement et factures test n'existent pas en mode reel.
9. Lancer `npm run check:live` avec les variables Live.
10. Effectuer une vraie petite transaction, puis verifier capture, annulation/remboursement, facture et webhooks dans Stripe.

References Stripe utiles :

- [Cles API Stripe](https://docs.stripe.com/keys)
- [Checklist go-live Stripe](https://docs.stripe.com/get-started/checklist/go-live)
- [Webhooks Stripe](https://docs.stripe.com/webhooks)
- [Portail client Stripe](https://docs.stripe.com/customer-management)

## 5. Stripe

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
customer.subscription.created
customer.subscription.updated
invoice.payment_succeeded
invoice.payment_failed
refund.created
refund.updated
refund.failed
```

Flux reservation :

1. Le client cree une ou plusieurs reservations.
2. Stripe Checkout cree un PaymentIntent en capture manuelle.
3. Le webhook marque le paiement en attente et conserve les infos de carte utiles.
4. L'admin confirme la reservation.
5. L'API admin capture le paiement.

Flux annulation :

- Si le paiement est encore autorise, l'autorisation est annulee.
- Si le paiement est deja capture, Stripe lance un remboursement integral.
- Les evenements `refund.created`, `refund.updated` et `refund.failed` synchronisent ensuite son etat en base.
- Un `refund.failed` affiche l'echec dans l'admin et envoie une alerte a `ADMIN_EMAIL` pour reprise manuelle.
- Le client recoit d'abord un email avec le statut « remboursement en cours », puis un second email quand Stripe confirme le statut `succeeded`. Les deux indiquent `SUPPORT_EMAIL` comme adresse de contact.
- Une annulation par l'equipe doit etre testee en mode Stripe Test avant chaque mise en production touchant au paiement.

## 6. Cron Vercel

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

## 7. UploadThing

Verifier :

- `UPLOADTHING_TOKEN`
- `UPLOADTHING_APP_ID`
- les permissions du projet UploadThing
- un upload depuis une page qui utilise les pieces jointes ou les documents animaux

## 8. Emails

Verifier :

- `RESEND_API_KEY`
- `RESEND_FROM` avec domaine verifie
- `ADMIN_EMAIL` pour les notifications de reservation
- `DEV_EMAIL` pour les rapports de bug

Tests attendus :

- verification de l'adresse apres inscription et renvoi du lien
- bienvenue envoyee uniquement apres verification
- reinitialisation du mot de passe et revocation des anciennes sessions
- demande de reservation recue par le client
- notification admin
- notification admin lors de l'envoi ou du remplacement d'un justificatif d'âge animal
- confirmation de reservation
- email d'echec de paiement abonnement
- rapport de bug vers l'adresse dev

## 9. Conformite avant ouverture

- entreprise declaree via le guichet unique et SIRET affiche dans les mentions legales
- activite de garde declaree a l'autorite competente lorsque requis
- ACACED a jour pour les categories d'animaux accueillies
- assurance responsabilite civile professionnelle adaptee
- mediateur de la consommation designe et affiche sur le site et dans les CGV
- protocole sanitaire, veterinaire referent et registre des animaux en place
- CGV, confidentialite, cookies et coordonnees professionnelles relus avec les informations reelles

## 10. Recette fonctionnelle apres deploiement

Tester comme un utilisateur standard :

- creer un compte, verifier l'email puis se connecter
- tester Google, Apple, activation 2FA, code TOTP et code de recuperation
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
- gerer disponibilites, coupons, Premium, fidelite et avis

Tester les abonnements :

- creer un abonnement promenade
- creer un abonnement garderie
- verifier l'activation Premium
- verifier la remise Premium de 10% sur une reservation
- verifier les Pattes doublees pour un client Premium
- programmer une resiliation, confirmer une seconde fois, puis annuler la resiliation
- ouvrir et telecharger une facture
- simuler un renouvellement et un paiement echoue via Stripe

## 11. Deploiement

Flux standard :

```bash
git push origin main
```

L'integration Git Vercel deploie automatiquement la branche `main` en production.

Suivi :

1. Ouvrir le deploiement dans Vercel.
2. Verifier que le build passe en `READY`.
3. Tester [https://resadog.vercel.app](https://resadog.vercel.app).

## 12. Rollback

Deux options :

- Vercel Dashboard : revenir au dernier deploiement `READY`.
- Git : `git revert <sha>` puis push sur `main`.

Preferer le rollback Vercel si la correction doit etre immediate.
