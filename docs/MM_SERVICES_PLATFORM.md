# MM Services — plateforme de gestion

Cadrage initial du 10 septembre 2026. Choix confirmés : plateforme indépendante reliée à La Patte Dorée, régime micro-entreprise, aucun autre outil comptable, encaissements en espèces et hors site inclus. Une première version locale a été créée dans /Users/christopherhardeman/Desktop/mm-services. Son README distingue les fonctions disponibles des éléments de cette feuille de route qui restent à réaliser.

## Objectif

Gérer le ménage et les prestations animalières dans un même espace privé MM Services, accessible sur ordinateur et téléphone. Chaque activité dispose de son suivi, avec une vue consolidée de l’entreprise.

Le parcours principal est : client → devis → prestation planifiée → facture → règlement → registre des recettes → rapprochement bancaire → récapitulatif de déclaration.

## État observé dans le projet local

- L’identité MM Services et la marque La Patte Dorée sont centralisées dans `src/lib/legal.ts`.
- Les clients, animaux, réservations, paiements et suppléments existent dans le modèle de données.
- `src/lib/booking-invoices.ts` contient un mécanisme de facturation Stripe après encaissement de certaines nouvelles réservations.
- `src/lib/finance.ts`, `src/lib/finance-server.ts` et `/admin/revenue` contiennent un suivi des encaissements, remboursements, frais, prévisions et provisions paramétrables.
- La page financière indique exclure les abonnements Premium et les encaissements hors site. Le reste estimé est calculé avant les autres dépenses.
- Aucun modèle dédié aux interventions de ménage, aux dépenses ou à un registre comptable commun n’a été trouvé dans le schéma inspecté. Le modèle `JournalEntry` correspond au journal des animaux.

Constat issu du code local uniquement : la disponibilité en production de ces fonctions n’a pas été contrôlée dans ce cadrage. Le dépôt comporte de nombreuses modifications préexistantes.

## Écrans proposés

| Espace | Fonctions |
| --- | --- |
| Tableau de bord | Encaissements, factures à payer, dépenses, provisions, solde bancaire rapproché, prestations à venir ; filtres ménage, animaux, ensemble |
| Clients | Coordonnées, adresses d’intervention et de facturation, historique commun, documents ; particuliers et professionnels |
| Planning | Ménage ponctuel ou récurrent, durée prévue et réelle, tarif horaire ou forfait, annulations ; visibilité des réservations animales |
| Devis et factures | Devis, acomptes, facturation mensuelle du ménage, factures, avoirs, échéances, paiements partiels, suivi des relances |
| Recettes | Paiements du site, virements, espèces et chèques ; date réelle d’encaissement, justificatif et activité |
| Dépenses | Fournisseur, catégorie, activité ou frais communs, justificatif, date de paiement, statut payé ou à payer |
| Banque | Import de relevés, rapprochement avec paiements et dépenses, suivi des versements Stripe et des écarts |
| Déclarations et archives | Livre des recettes, registre des achats selon le régime, synthèses mensuelles/trimestrielles, exports et pièces justificatives |
| Paramètres | Identité, régime fiscal, TVA, taux et périodes ACRE confirmés, numérotation, échéances, accès et sauvegardes |

## Règles de conception

1. MM Services est l’entreprise ; ménage et animaux sont des activités. Les marques commerciales ne créent pas deux entreprises comptables.
2. Distinguer montant prévu, facturé, encaissé, remboursé et reçu en banque. Une facture impayée ne doit pas gonfler les recettes encaissées.
3. Relier chaque paiement importé à son identifiant d’origine. Rejouer une synchronisation ne doit créer ni recette ni facture supplémentaire.
4. Un versement Stripe vers la banque est un transfert à rapprocher, pas une deuxième vente. Les frais Stripe sont suivis séparément du montant payé par le client.
5. Reprendre les factures existantes avec leur numéro et leur document d’origine. Prévoir une stratégie de numérotation coordonnée avant toute nouvelle émission commune.
6. Utiliser des montants exacts au centime, des écritures validées non modifiables et des corrections traçables. Les brouillons restent modifiables avant validation.
7. Conserver la version des paramètres utilisée pour les écritures validées. Un changement de provision future ne réécrit pas l’historique comptable.
8. Séparer recettes déclarables, dépenses de gestion et trésorerie disponible. Le calcul des déclarations dépend du régime confirmé ; ne pas traiter automatiquement toutes les dépenses comme déductibles.
9. Afficher les données manquantes et les écarts de rapprochement. Un solde prévisionnel ne doit pas être présenté comme le solde bancaire vérifié.
10. Réserver la gestion comptable aux personnes autorisées. Les accès aux réservations animales ne donnent pas automatiquement accès à toutes les finances de MM Services.
11. Prévoir sauvegardes, restauration testée, export complet et conservation des justificatifs selon les obligations applicables.
12. Les relances, transmissions fiscales et paiements requièrent un parcours explicite ; un tableau récapitulatif ne prouve pas qu’une déclaration a été déposée.

## Articulation avec La Patte Dorée

Choix confirmé : application MM Services indépendante, reliée en lecture seule à La Patte Dorée.

Dans les deux cas, réutiliser les données animales existantes et conserver la référence à chaque réservation, paiement et facture. Définir une seule source d’émission par facture et une seule source par règlement. Inclure les abonnements et l’historique hors site dans le périmètre de reprise, en signalant les pièces absentes.

## Livraison proposée

### Étape 1 — socle de gestion utilisable

Clients communs, catalogue ménage, interventions récurrentes, devis et brouillons de factures, dépenses avec justificatifs, paiements manuels, vue par activité. Connexion aux réservations animales avec prévention des doublons.

### Étape 2 — comptabilité et reprise vérifiées

Émission et numérotation coordonnées, acomptes et avoirs, livre des recettes, paramètres fiscaux confirmés, import bancaire et rapprochement, reprise des factures/paiements/abonnements existants, exports et sauvegarde restaurable. Vérifier les montants contre les pièces et relevés avant utilisation comme référence comptable.

### Étape 3 — échanges externes

Connexion à une plateforme agréée de facturation électronique, puis automatisations choisies : connexion bancaire, rappels et transmission des données selon les interfaces disponibles. Prioriser dès le démarrage le choix de la plateforme de réception si aucune n’est déjà utilisée.

La première étape seule ne constitue pas une gestion comptable complète. Les critères de recette comprennent : paiement partiel, remboursement d’un mois antérieur, annulation d’intervention récurrente, synchronisation rejouée, facture déjà émise dans Stripe, versement bancaire regroupant plusieurs paiements, accès non autorisé et restauration d’archives.

## Cadre réglementaire vérifié pour le cadrage

- Le régime micro prévoit une comptabilité allégée et un livre des recettes encaissées. Le détail des registres dépend de l’activité et du régime. Référence : [Service Public — obligations comptables du micro-entrepreneur](https://entreprendre.service-public.gouv.fr/vosdroits/F23266).
- La facturation électronique concerne aussi les entreprises en franchise en base de TVA. Réception à compter du 1er septembre 2026, émission pour les petites et micro-entreprises à compter du 1er septembre 2027 selon le périmètre des opérations ; les échanges avec les particuliers relèvent du dispositif de transmission des données applicable. La plateforme MM Services doit prévoir son articulation avec une plateforme agréée. Référence : [DGFiP — découvrir la facturation électronique](https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique).

## Informations à confirmer

- Application indépendante ou espace dans l’administration actuelle.
- Régime micro actuel, outil de facturation/comptabilité déjà utilisé et historique à reprendre.
- Clientèle ménage : particuliers, professionnels ou les deux ; tarifs et récurrences.
- Moyens de paiement, compte utilisé, périodicité de déclaration et paramètres fiscaux personnels.
- Éventuel statut services à la personne : à vérifier avant de prévoir des attestations fiscales ou une fonctionnalité d’avantage fiscal.
