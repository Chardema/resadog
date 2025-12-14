# La Patte Dorée - Plateforme de Garde de Chiens

Plateforme professionnelle de réservation de garde de chiens avec suivi en temps réel, photos quotidiennes et communication directe.

## Fonctionnalités

- Système de réservation en ligne avec calendrier
- Paiements sécurisés via Stripe
- Chat en temps réel
- Journal d'activités quotidien avec photos/vidéos
- Notifications email et SMS
- Interface moderne et responsive

## Technologies

### Frontend
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query (TanStack Query)
- Zustand

### Backend
- Next.js API Routes
- PostgreSQL
- Prisma ORM
- NextAuth.js v5

### Services Externes
- Stripe (paiements)
- Pusher (temps réel)
- Uploadthing (uploads)
- Resend (emails)
- Twilio (SMS)

## Installation

### Prérequis
- Node.js 18+ et npm
- PostgreSQL (local ou cloud)

### Étapes

1. **Installer les dépendances**
```bash
npm install
```

2. **Configurer la base de données**

Créer une base de données PostgreSQL, puis mettre à jour `.env.local` avec votre URL de connexion :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/resadog?schema=public"
```

3. **Générer une clé secrète pour NextAuth**
```bash
openssl rand -base64 32
```

Ajouter dans `.env.local` :
```env
NEXTAUTH_SECRET="votre-clé-générée"
NEXTAUTH_URL="http://localhost:3000"
```

4. **Appliquer les migrations Prisma**
```bash
npx prisma migrate dev
```

5. **Lancer le serveur de développement**
```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Structure du Projet

```
resadog/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   ├── auth/                 # Pages d'authentification
│   │   └── page.tsx              # Page d'accueil
│   ├── components/               # Composants React
│   │   ├── ui/                   # shadcn/ui
│   │   ├── calendar/             # Calendrier
│   │   ├── booking/              # Réservations
│   │   ├── chat/                 # Chat
│   │   └── journal/              # Journal
│   ├── lib/                      # Bibliothèques
│   │   ├── auth/                 # Configuration NextAuth
│   │   ├── db/                   # Client Prisma
│   │   └── utils.ts              # Utilitaires
│   └── types/                    # Types TypeScript
├── prisma/
│   └── schema.prisma             # Schéma de base de données
└── public/                       # Fichiers statiques
```

## Configuration des Services Externes

### Stripe

1. Créer un compte sur [stripe.com](https://stripe.com)
2. Récupérer vos clés API (test puis production)
3. Ajouter dans `.env.local` :

```env
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Pusher (Chat temps réel)

1. Créer un compte sur [pusher.com](https://pusher.com)
2. Créer une app
3. Ajouter dans `.env.local` :

```env
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_CLUSTER="eu"
```

### Uploadthing (Upload fichiers)

1. Créer un compte sur [uploadthing.com](https://uploadthing.com)
2. Créer un projet
3. Ajouter dans `.env.local` :

```env
UPLOADTHING_SECRET="sk_..."
UPLOADTHING_APP_ID="..."
```

### Resend (Emails)

1. Créer un compte sur [resend.com](https://resend.com)
2. Récupérer votre clé API
3. Ajouter dans `.env.local` :

```env
RESEND_API_KEY="re_..."
```

### Twilio (SMS)

1. Créer un compte sur [twilio.com](https://twilio.com)
2. Récupérer vos credentials
3. Ajouter dans `.env.local` :

```env
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+33..."
```

## Scripts Disponibles

```bash
# Développement
npm run dev              # Démarre le serveur dev
npm run build            # Build pour production
npm start                # Lance la version production
npm run lint             # Lint le code

# Base de données
npx prisma studio        # Interface UI pour la BDD
npx prisma migrate dev   # Créer une migration
npx prisma db push       # Push le schéma (dev rapide)
npx prisma generate      # Générer le client Prisma
```

## Prochaines Étapes

### Phase 1 (MVP) - En cours
- [x] Setup du projet
- [x] Configuration de l'authentification
- [x] Page d'accueil
- [ ] Pages d'inscription/connexion
- [ ] Système de réservation
- [ ] Gestion des profils d'animaux
- [ ] Intégration Stripe

### Phase 2 (Communication)
- [ ] Chat en temps réel
- [ ] Journal d'activités
- [ ] Upload de photos/vidéos
- [ ] Notifications

### Phase 3 (Polish)
- [ ] Notifications SMS
- [ ] Tests end-to-end
- [ ] Optimisations performances
- [ ] Déploiement production

## Déploiement

### Vercel (Recommandé)

1. Pousser le code sur GitHub
2. Connecter le repo à Vercel
3. Configurer les variables d'environnement
4. Déployer

```bash
vercel --prod
```

## Support

Pour toute question ou problème, contactez-moi.

## Licence

Propriétaire - Tous droits réservés
