# La Patte Dorée

Application de réservation pour services de garde d'animaux : demandes, disponibilités, paiement Stripe avec capture manuelle, espace client, administration, fidélité, avis et emails transactionnels.

## Stack

- Next.js 16 et React 19
- TypeScript et Tailwind CSS 4
- Prisma 7 et PostgreSQL/Supabase
- NextAuth 5
- Stripe Checkout, PaymentIntents et abonnements
- Resend et UploadThing
- Vercel

## Installation locale

Prérequis : Node.js 20.9 ou supérieur et une base PostgreSQL dédiée au développement.

```bash
cp .env.example .env.local
npm ci
npx prisma migrate deploy
npm run dev
```

Le site est ensuite accessible sur [http://localhost:3000](http://localhost:3000).

Ne lancez jamais `prisma db push` ou `prisma migrate reset` sur la base de production.

## Contrôles

```bash
npm run check:env          # environnement local
npm run check:types        # TypeScript
npm run check:pricing      # tarification, coupons et fidélité
npm run check:payments     # invariants d'encaissement/remboursement
npm run check:translations # couverture FR/EN/ES
npm run lint
npm run build
```

Le contrôle complet avant livraison est :

```bash
npm run preflight
```

Le contrôle des services Live nécessite les variables de production :

```bash
npm run check:live
```

## Administration

```bash
npm run create-admin
npm run reset-admin
```

Les scripts utilisent la base définie dans l'environnement courant. Vérifiez toujours la cible avant de les lancer.

## Déploiement

Le projet Vercel est `pattedoree`. Le flux recommandé est :

1. sauvegarder la base ;
2. exécuter `npm run preflight` ;
3. appliquer `npx prisma migrate deploy` ;
4. valider un Preview Vercel ;
5. promouvoir l'artefact testé en production ;
6. contrôler les routes publiques et les logs runtime.

Voir [la procédure de production](docs/PRODUCTION_DEPLOYMENT.md) et [le dossier de stabilisation V2](docs/PHASE_1_V2_STABILISATION.md).

## Licence

Projet propriétaire.
