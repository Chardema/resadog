# Configuration du Compte Administrateur

## 🔐 Création du Compte Admin

Pour créer votre compte administrateur La Patte Dorée, suivez ces étapes:

### Méthode 1: Script Automatisé (Recommandé)

1. **Ouvrir le terminal dans le dossier du projet**

2. **Installer les dépendances si ce n'est pas déjà fait:**
   ```bash
   npm install
   ```

3. **Exécuter le script de création:**
   ```bash
   npx tsx scripts/create-admin.ts
   ```

4. **Suivre les instructions:**
   - Entrez votre nom complet
   - Entrez votre email (celui que vous utiliserez pour vous connecter)
   - Entrez un mot de passe sécurisé (minimum 8 caractères)

5. **Connexion:**
   - Allez sur votre site La Patte Dorée
   - Cliquez sur "Connexion"
   - Utilisez l'email et le mot de passe que vous avez créés
   - Vous serez automatiquement redirigé vers le dashboard admin

---

### Méthode 2: Prisma Studio (Alternative)

Si le script ne fonctionne pas, vous pouvez créer le compte manuellement:

1. **Ouvrir Prisma Studio:**
   ```bash
   npx prisma studio
   ```

2. **Créer un utilisateur:**
   - Cliquez sur "User" dans le menu de gauche
   - Cliquez sur "Add record"
   - Remplissez les champs:
     - `name`: Votre nom complet
     - `email`: Votre email
     - `password`: **ATTENTION!** Le mot de passe doit être hashé avec bcrypt
     - `role`: Sélectionnez **ADMIN**
   - Cliquez sur "Save 1 change"

3. **Pour hasher le mot de passe:**

   Créez un fichier temporaire `hash-password.ts`:
   ```typescript
   import bcrypt from "bcryptjs";

   const password = "VotreMotDePasse123"; // CHANGEZ CECI
   const hashed = bcrypt.hashSync(password, 10);
   console.log(hashed);
   ```

   Puis exécutez:
   ```bash
   npx tsx hash-password.ts
   ```

   Copiez le hash généré et utilisez-le dans Prisma Studio.

---

## 🔒 Sécurité du Compte Admin

### Bonnes Pratiques

1. **Mot de passe fort:**
   - Minimum 12 caractères
   - Mélange de majuscules, minuscules, chiffres et symboles
   - Exemple: `La Patte Dorée2024!Secure#`

2. **Email sécurisé:**
   - Utilisez un email professionnel
   - Activez l'authentification à deux facteurs (2FA) sur votre email
   - Ne partagez jamais cet email publiquement

3. **Ne créez qu'UN SEUL compte admin:**
   - Vous êtes le seul propriétaire de la plateforme
   - Les clients créent des comptes CLIENT (rôle par défaut)
   - Ne partagez JAMAIS vos identifiants admin

4. **Changez votre mot de passe régulièrement:**
   - Tous les 3-6 mois
   - Immédiatement si vous suspectez une compromission

---

## 🚫 Protection de l'Accès Admin

### Ce qui est protégé automatiquement:

✅ **Routes admin** (`/admin/*`):
- Seuls les utilisateurs avec le rôle ADMIN ou SITTER peuvent y accéder
- Redirection automatique vers `/dashboard` pour les clients

✅ **API admin** (`/api/admin/*`):
- Vérification du rôle sur chaque requête
- Retourne une erreur 403 si non autorisé

✅ **Dashboard séparé:**
- Les clients voient `/dashboard` (gestion de leurs réservations)
- L'admin voit `/admin/dashboard` (gestion de toutes les réservations, calendrier, revenus)

✅ **Menu de navigation adaptatif:**
- Le menu affiche différentes options selon le rôle de l'utilisateur
- Les clients ne voient pas les liens admin

### Ce que les clients PEUVENT faire:

- S'inscrire et se connecter
- Créer des profils pour leurs animaux
- Faire des réservations
- Payer en ligne (Stripe)
- Communiquer avec vous via le chat
- Voir le journal d'activités de leur animal pendant la garde

### Ce que SEUL l'admin PEUT faire:

- Voir toutes les réservations
- Confirmer/annuler des réservations
- Gérer le calendrier de disponibilités
- Voir la liste de tous les clients
- Consulter les revenus et statistiques
- Ajouter des entrées au journal d'activités
- Uploader des photos/vidéos pendant les gardes

---

## 📧 En cas de problème

Si vous perdez l'accès à votre compte admin:

1. **Utilisez le script de récupération:**
   ```bash
   npx tsx scripts/reset-admin-password.ts
   ```

2. **Ou contactez votre développeur** avec:
   - L'email du compte admin
   - La preuve que vous êtes bien le propriétaire de la plateforme

---

## ⚠️ Important

- **NE SUPPRIMEZ PAS** ce fichier `ADMIN_SETUP.md`
- **NE COMMITEZ PAS** vos identifiants dans Git
- **NE PARTAGEZ PAS** vos identifiants avec qui que ce soit
- **SAUVEGARDEZ** vos identifiants dans un gestionnaire de mots de passe (1Password, LastPass, Bitwarden, etc.)

---

## 📝 Checklist de Sécurité

Après la création de votre compte admin, vérifiez:

- [ ] Mot de passe fort (12+ caractères)
- [ ] Email sécurisé avec 2FA
- [ ] Identifiants sauvegardés dans un gestionnaire de mots de passe
- [ ] Test de connexion réussi
- [ ] Accès au dashboard admin confirmé
- [ ] Variables d'environnement (`DATABASE_URL`, etc.) sécurisées
- [ ] `.env.local` ajouté au `.gitignore`
- [ ] Pas de données sensibles dans le code source

---

**Votre plateforme La Patte Dorée est maintenant sécurisée! 🐾**
