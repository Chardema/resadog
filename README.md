# La Patte Doree

Application Next.js de reservation pour La Patte Doree : reservations, paiement Stripe avec empreinte bancaire, espace client, administration, disponibilites, coupons, credits, abonnements et emails transactionnels.

## Stack

- Next.js 16, React 19, TypeScript
- Prisma 7 et PostgreSQL
- NextAuth v5
- Stripe Checkout, PaymentIntents et abonnements
- Resend pour les emails
- UploadThing pour les fichiers
- Vercel pour l'hebergement et les crons

## Demarrage local

```bash
npm install
npm run dev
```

L'application demarre sur [http://localhost:3000](http://localhost:3000).

## Scripts utiles

```bash
npm run dev          # serveur local
npm run lint         # ESLint
npm run build        # build production Next.js
npm run check:env    # controle des variables d'environnement de production
npm run preflight    # env + lint + build
npm run create-admin # creation d'un admin
npm run reset-admin  # reset du mot de passe admin
```

## Variables d'environnement

Le controle de production se lance avec :

```bash
npm run check:env
```

Variables requises en production :

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `AUTH_SECRET` ou `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET`
- `UPLOADTHING_TOKEN`
- `UPLOADTHING_APP_ID`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`

Variables conseillees :

- `RESEND_FROM`
- `RESEND_BUG_FROM`
- `DEV_EMAIL`

Voir [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) pour la checklist complete de mise en production.

## Deploiement

Le projet est lie a Vercel. Le flux normal est :

```bash
npm run check:env
npm run lint
npm run build
git push origin main
```

Le push sur `main` declenche le deploiement Vercel de production via l'integration Git.

## Paiements

Les reservations utilisent Stripe Checkout avec PaymentIntent en capture manuelle. Le client autorise le paiement, puis l'admin confirme la reservation pour capturer le paiement. Une annulation admin annule l'autorisation ou rembourse selon l'etat du paiement.

Webhook Stripe production :

```text
https://resadog.vercel.app/api/stripe/webhook
```

## Licence

Projet proprietaire.
