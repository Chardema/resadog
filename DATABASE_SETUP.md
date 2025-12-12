# Configuration de la Base de Données PostgreSQL

## Option 1 : Supabase (RECOMMANDÉ - 100% GRATUIT)

C'est la solution la plus simple et gratuite !

### Étapes :

1. **Créer un compte Supabase**
   - Allez sur https://supabase.com
   - Cliquez sur "Start your project"
   - Connectez-vous avec GitHub (gratuit)

2. **Créer un nouveau projet**
   - Cliquez sur "New Project"
   - Nom du projet : `resadog`
   - Database Password : choisissez un mot de passe fort (NOTEZ-LE !)
   - Region : choisissez "Europe West (Ireland)" ou la plus proche
   - Cliquez sur "Create new project"
   - ⏳ Attendez 2-3 minutes que le projet soit prêt

3. **Récupérer l'URL de connexion**
   - Dans votre projet Supabase, allez dans "Project Settings" (icône engrenage en bas à gauche)
   - Cliquez sur "Database" dans le menu
   - Scrollez jusqu'à "Connection string"
   - Sélectionnez "URI" (pas "Transaction")
   - Copiez l'URL qui ressemble à :
     ```
     postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
     ```
   - ⚠️ Remplacez `[YOUR-PASSWORD]` par le mot de passe que vous avez choisi à l'étape 2

4. **Mettre à jour .env.local**
   - Ouvrez le fichier `.env.local` à la racine du projet
   - Remplacez la ligne `DATABASE_URL` par votre URL Supabase
   ```env
   DATABASE_URL="postgresql://postgres.abcdefghijklmnop:VOTRE_MOT_DE_PASSE@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
   ```

5. **Appliquer les migrations Prisma**
   ```bash
   npx prisma migrate dev --name init
   ```

✅ C'est tout ! Votre base de données est prête.

---

## Option 2 : Vercel Postgres (GRATUIT avec limites)

Si vous prévoyez de déployer sur Vercel :

1. Allez sur https://vercel.com
2. Connectez-vous avec GitHub
3. Créez un nouveau projet ou sélectionnez un projet existant
4. Allez dans l'onglet "Storage"
5. Cliquez sur "Create Database"
6. Sélectionnez "Postgres"
7. Copiez la variable `POSTGRES_PRISMA_URL`
8. Collez-la dans `.env.local` comme `DATABASE_URL`

---

## Option 3 : PostgreSQL Local (pour développement)

### Sur Mac :
```bash
# Installer PostgreSQL avec Homebrew
brew install postgresql@16

# Démarrer PostgreSQL
brew services start postgresql@16

# Créer la base de données
createdb resadog

# URL de connexion
DATABASE_URL="postgresql://votre_user@localhost:5432/resadog"
```

### Sur Windows :
1. Téléchargez PostgreSQL : https://www.postgresql.org/download/windows/
2. Installez-le (notez le mot de passe !)
3. Ouvrez pgAdmin 4
4. Créez une nouvelle base de données nommée `resadog`
5. URL de connexion :
   ```
   DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/resadog"
   ```

### Sur Linux (Ubuntu/Debian) :
```bash
# Installer PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Créer un utilisateur et une base de données
sudo -u postgres createuser --interactive --pwprompt
sudo -u postgres createdb resadog

# URL de connexion
DATABASE_URL="postgresql://votre_user:mot_de_passe@localhost:5432/resadog"
```

---

## Après avoir configuré DATABASE_URL

1. **Appliquer les migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

   Cela va créer toutes les tables dans votre base de données.

2. **Vérifier que ça fonctionne**
   ```bash
   npx prisma studio
   ```

   Cela ouvre une interface web pour voir vos tables (même si elles sont vides).

3. **Lancer l'application**
   ```bash
   npm run dev
   ```

   Allez sur http://localhost:3000 et testez l'inscription !

---

## Dépannage

### Erreur : "Can't reach database server"
- Vérifiez que votre URL de connexion est correcte
- Vérifiez que le mot de passe ne contient pas de caractères spéciaux non encodés
- Si oui, encodez-les : https://www.urlencoder.org/

### Erreur : "SSL connection required"
- Ajoutez `?sslmode=require` à la fin de votre DATABASE_URL

### Erreur de migration
```bash
# Réinitialiser complètement
npx prisma migrate reset
# Puis refaire
npx prisma migrate dev --name init
```

---

## 🎉 Recommandation

**Utilisez Supabase (Option 1)** - c'est gratuit, rapide à configurer, et vous n'avez pas à gérer de serveur !
