# Configuration Uploadthing pour les photos

## Étapes de configuration

### 1. Créer un compte Uploadthing (GRATUIT)

1. Allez sur https://uploadthing.com/
2. Cliquez sur "Get Started" ou "Sign Up"
3. Connectez-vous avec GitHub ou créez un compte

### 2. Créer une application

1. Une fois connecté, cliquez sur "Create a new app"
2. Donnez-lui un nom (ex: "La Patte Dorée")
3. Confirmez la création

### 3. Obtenir vos clés API

1. Dans votre dashboard Uploadthing, allez dans "API Keys"
2. Vous verrez deux clés:
   - **Secret Key** (commence par `sk_live_...`)
   - **App ID** (un identifiant unique)

### 4. Ajouter les clés dans votre fichier .env.local

Remplacez ces lignes dans votre fichier `.env.local`:

```bash
# Uploadthing
UPLOADTHING_SECRET="sk_live_VOTRE_CLE_ICI"
UPLOADTHING_APP_ID="VOTRE_APP_ID_ICI"
```

### 5. Redémarrer le serveur

```bash
# Arrêter le serveur (Ctrl+C dans le terminal)
# Puis relancer
npm run dev
```

## Plan gratuit Uploadthing

- ✅ 2GB de stockage
- ✅ 2GB de bande passante par mois
- ✅ Upload jusqu'à 16MB par fichier
- ✅ Parfait pour démarrer!

## Alternative temporaire

En attendant de configurer Uploadthing, vous pouvez:
1. Créer des animaux SANS photo (le champ est optionnel)
2. Utiliser des emojis par défaut (🐕 🐩 🐶)
3. Ajouter les photos plus tard quand Uploadthing sera configuré

## Besoin d'aide?

Si vous avez des problèmes, consultez: https://docs.uploadthing.com/getting-started
