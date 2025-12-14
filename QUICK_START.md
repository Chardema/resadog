# 🚀 La Patte Dorée - Démarrage Rapide

## Étapes pour lancer votre plateforme

### 1️⃣ Installation

```bash
npm install
```

### 2️⃣ Configuration de la base de données

1. **Créez un compte Supabase gratuit:** https://supabase.com

2. **Créez un nouveau projet:**
   - Allez dans votre dashboard Supabase
   - Cliquez sur "New Project"
   - Choisissez un nom pour votre projet
   - Définissez un mot de passe sécurisé pour la base de données
   - Sélectionnez une région proche de vous
   - Cliquez sur "Create new project"

3. **Récupérez votre URL de connexion:**
   - Dans votre projet Supabase, allez dans "Settings" → "Database"
   - Scrollez jusqu'à "Connection string"
   - Sélectionnez "URI" dans le menu déroulant
   - Copiez l'URL (elle ressemble à: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`)
   - ⚠️ **Important:** Remplacez `[PASSWORD]` par le mot de passe que vous avez défini à l'étape 2

4. **Configurez votre fichier `.env.local`:**

Copiez le fichier d'exemple:
```bash
cp .env.local.example .env.local
```

Puis éditez `.env.local` et remplissez:

```env
# Database (REQUIS)
DATABASE_URL="postgresql://postgres.[ref]:VOTRE_MOT_DE_PASSE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Auth (REQUIS)
NEXTAUTH_SECRET="généré-avec-la-commande-ci-dessous"
NEXTAUTH_URL="http://localhost:3000"

# Les autres variables sont optionnelles pour le moment
```

Pour générer `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

💡 **Astuce:** Si vous n'avez pas `openssl`, vous pouvez utiliser n'importe quelle chaîne aléatoire de 32+ caractères.

### 3️⃣ Migrations de la base de données

```bash
npx prisma db push
```

Cela va créer toutes les tables nécessaires dans votre base de données.

### 4️⃣ Créez votre compte administrateur

```bash
npm run create-admin
```

Suivez les instructions:
- Entrez votre nom complet
- Entrez votre email (vous l'utiliserez pour vous connecter)
- Entrez un mot de passe sécurisé (minimum 8 caractères)

✅ **Votre compte admin est créé!**

### 5️⃣ Lancez le serveur de développement

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans votre navigateur.

### 6️⃣ Connexion

1. Cliquez sur "Connexion"
2. Utilisez l'email et le mot de passe que vous avez créés
3. Vous serez automatiquement redirigé vers le **Dashboard Admin**! 🎉

---

## 📋 Checklist de démarrage

- [ ] Base de données Supabase créée
- [ ] Fichier `.env.local` configuré
- [ ] Migrations Prisma exécutées (`npx prisma db push`)
- [ ] Compte administrateur créé (`npm run create-admin`)
- [ ] Serveur de développement lancé (`npm run dev`)
- [ ] Connexion réussie au dashboard admin

---

## 🔧 Commandes utiles

```bash
# Développement
npm run dev              # Lancer le serveur de développement

# Database
npx prisma studio        # Interface visuelle pour la base de données
npx prisma db push       # Synchroniser le schéma avec la DB

# Admin
npm run create-admin     # Créer un compte administrateur
npm run reset-admin      # Réinitialiser le mot de passe admin

# Build
npm run build            # Build de production
npm start                # Lancer en production
```

---

## ⚙️ Configuration optionnelle (à faire plus tard)

### Uploadthing (pour les photos)

1. Créez un compte: https://uploadthing.com
2. Créez une application
3. Copiez vos clés API dans `.env.local`:

```env
UPLOADTHING_SECRET="votre_secret"
UPLOADTHING_APP_ID="votre_app_id"
```

### Stripe (pour les paiements)

1. Créez un compte: https://stripe.com
2. Allez dans "Developers" → "API keys"
3. Copiez vos clés de test dans `.env.local`:

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### Pusher (pour le chat temps réel)

1. Créez un compte: https://pusher.com
2. Créez une application (Channels)
3. Copiez vos clés dans `.env.local`:

```env
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_CLUSTER="..."
```

---

## 🆘 Besoin d'aide?

### Erreurs courantes

**❌ "DATABASE_URL n'est pas défini"**
- Vérifiez que le fichier `.env.local` existe à la racine du projet
- Vérifiez que `DATABASE_URL` est bien renseigné dans `.env.local`
- Assurez-vous d'avoir remplacé `[PASSWORD]` par votre vrai mot de passe

**❌ "PrismaClientInitializationError"**
- Vérifiez que votre `DATABASE_URL` est correcte
- Testez la connexion avec `npx prisma studio`
- Vérifiez que vous avez bien exécuté `npx prisma db push`

**❌ "Un utilisateur avec l'email ... existe déjà"**
- Vous avez déjà créé un compte admin
- Utilisez plutôt `npm run reset-admin` pour changer le mot de passe

**❌ Erreur Uploadthing lors de l'upload de photo**
- Les photos sont optionnelles
- Vous pouvez créer des profils sans photos
- Configurez Uploadthing plus tard si besoin

**❌ Mot de passe admin oublié**
```bash
npm run reset-admin
```

---

## 📚 Documentation complète

- [ADMIN_SETUP.md](./ADMIN_SETUP.md) - Configuration détaillée du compte admin
- [UPLOADTHING_SETUP.md](./UPLOADTHING_SETUP.md) - Configuration des uploads de photos
- [README.md](./README.md) - Documentation complète du projet

---

**Votre plateforme La Patte Dorée est prête à l'emploi! 🐾**
