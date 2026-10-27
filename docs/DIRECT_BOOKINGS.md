# Réservations directes

Depuis Administration > Réservations > Nouvelle réservation directe, un administrateur peut enregistrer un accord conclu avec un client par téléphone, SMS ou e-mail. Le client n’a pas besoin de créer un compte. Un e-mail réel est requis pour la fiche client ; aucune invitation, vérification, confirmation ni demande de paiement n’est envoyée par la création.

Le formulaire prend en charge un client existant et ses animaux, ou une nouvelle fiche client et un nouvel animal. Les tarifs sont recalculés côté serveur à partir de la grille commune, sans coupon ni avantage Premium. La date de naissance détermine le supplément chiot. La garderie reste limitée à 10 heures ; au-delà, sélectionner Hébergement. Les visites et promenades sont enregistrées un créneau à la fois. La disponibilité utilise les mêmes verrous transactionnels et contrôles de capacité que la confirmation en ligne.

L’enregistrement crée une réservation CONFIRMED, visible dans le planning existant. Il faut avoir obtenu et renseigné une trace de l’accord sur le prix, les horaires et les CGV transmis au client. Le nom, la date de naissance, les besoins du chien et la compatibilité de l’accueil sont saisis/vérifiés par l’administrateur ; aucune preuve de naissance n’est automatiquement marquée comme vérifiée.

## Paiements

- Modes pris en charge : espèces et virement (`Payment.paymentMethod`: `DIRECT_CASH`, `DIRECT_BANK_TRANSFER`). Aucun nouveau schéma ni migration.
- À recevoir : `PENDING`, montant encaissé nul, aucune recette comptabilisée.
- Déjà reçu : `SUCCEEDED`, date réelle d’encaissement et référence obligatoires. Les références et l’auteur/date de chaque action sont conservés dans les notes et visibles dans l’historique du paiement.
- Le bouton Enregistrer le paiement reçu permet de saisir l’encaissement ultérieurement. Il ne réalise aucun transfert.
- L’annulation sans paiement annule la garde et ferme le paiement en `FAILED` (aucune somme encaissée). Pour une garde payée, cette action enregistre uniquement un remboursement intégral déjà effectué : l’administrateur doit l’attester et dater le remboursement. Aucun remboursement bancaire n’est lancé. Une retenue ou un remboursement partiel n’est pas pris en charge par ce parcours.
- Aucun frais Stripe n’est imputé aux espèces et virements. La finance existante distingue les montants attendus et réellement reçus. L’application MM Services indépendante n’a pas été modifiée.
- Checkout, les suppléments par carte et l’annulation en ligne sont bloqués pour ces réservations ; ils renvoient vers la gestion directe. Le client peut contacter Mégane pour une annulation.
- Les actions existantes de fin de prestation et les rappels programmés conservent leur comportement, notamment la demande Google à la clôture. La création et les actions de paiement/annulation directes n’envoient rien.

## Vérification

`npm run check:direct-bookings` contrôle le devis adulte de 45 € jusqu’à 22 h 30/23 h, les saisies invalides, la tarification serveur, les accès, les transactions annulées, les indisponibilités, la capacité, les nouvelles tentatives sans doublon, l’encaissement et le remboursement. Les handlers et le contrôle de capacité réels sont exécutés avec une base en mémoire : aucun paiement, message ou client réel n’est créé.

Le formulaire, la création d’une réservation à 45 € et l’enregistrement de son paiement ont également été vérifiés dans le navigateur sur une copie locale isolée, avec auth/base de test. Les contrôles de concurrence PostgreSQL ne sont pas reproduits par la base en mémoire. La fonctionnalité doit encore être déployée pour être accessible sur le site public.
