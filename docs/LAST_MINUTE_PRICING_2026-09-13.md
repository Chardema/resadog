# Supplément de dernière minute — 13 septembre 2026

- 10 € une seule fois par réservation, pour les cinq prestations.
- Déclenchement strictement à moins de 24 heures avant le premier début prévu (heure de Paris). Pour plusieurs passages, prendre le premier chronologiquement.
- Le supplément est ajouté après les remises ; il ne dépend ni des animaux, ni des jours ou passages.
- Calcul serveur indépendant du total client. Une différence entre supplément affiché et calculé renvoie 409 sans créer de réservation.
- Le tarif enregistré inclut le supplément et les notes de facturation conservent son détail. Les réservations déjà enregistrées ne sont pas recalculées.
- Les devis de visites sans horaires préviennent du supplément éventuel avant acceptation, sans présumer une heure de début.

## Validation

- Source de référence : déploiement de production dpl_2qfcirBhtGVWJERSKFscecwYekAN. Les empreintes des sources locales avant modification correspondaient à cette production (hors cache TypeScript et fichiers non exécutables).
- Build isolé : /tmp/resadog-last-minute-release, reconstitué depuis la liste des sources du déploiement. Cela évite d’inclure les sauvegardes et fichiers temporaires du dossier de travail.
- `npm run preflight` passé dans cette copie, puis contrôles TypeScript, lint et nouveau build après correction de l’affichage Premium.
- `scripts/check-last-minute.ts` : cinq services, animaux groupés, passages non triés, frontière exacte de 24 h, changements d’heure et remise Premium.
- `scripts/check-last-minute-api.ts` : véritable gestionnaire POST avec authentification et base en mémoire, prix client falsifié ignoré, refus 409 sans écriture, note de facturation et Premium. Aucun effet externe.
- Navigateur avec session, animaux et disponibilité simulés : deux chiens sur 24 h demandés pour le soir, supplément unique, total 100 €. Aucun paiement ni réservation client créé.
- Traductions nouvelles couvertes en français, anglais et espagnol.

## Publication confirmée

- Production : `dpl_BktciWNmmvqYRaPrGeaBsvB5mL3N`, statut Ready, alias `www.lapatte-doree.fr` confirmé.
- `/`, `/tarifs` et `/legal/cgv` répondent 200 avec la nouvelle règle, sans l’ancienne promesse d’absence de supplément de dernière minute.
- Page tarifs ouverte et inspectée dans un navigateur de production. API de réservation non authentifiée : 401.
- Aucun log d’erreur retourné par la recherche filtrée sur les dix premières minutes disponibles.
- Les contrôles fonctionnels de réservation utilisent des fixtures ; aucun paiement ni réservation réelle n’a été créé pour la recette.
