# Visites de chats : tarification et simulateur — 10 septembre 2026

Règle confirmée par l’administrateur : 15 € par visite de 30 minutes au même domicile pour un ou deux chats, puis 3 € par chat supplémentaire à partir du troisième. Chaque tranche de 30 minutes supplémentaires coûte 8 € une seule fois pour la visite partagée. Les autres prestations gardent leur tarification.

## Exemple demandé

17, 19, 22, 24, 26 et 29 septembre 2026, une visite de 30 minutes chaque jour sélectionné, deux chats : six visites × 15 € = **90 €**, hors déplacement exceptionnel convenu et remise éventuelle. Trois chats : 108 €. Aucun jour intermédiaire n’est facturé.

## Fonctionnement

Admin > Simulateur > Visites de chats à domicile : nombre de chats, durée, nombre de visites par jour, dates non consécutives, déplacement par passage, coordonnées et précisions. Exemple de septembre prérempli en un clic. Devis à copier, télécharger en texte ou imprimer en PDF. Une modification invalide le document précédemment généré. Aucune réservation ni communication au client n’est créée.

Le moteur partagé `calculateBookingPrice` facture uniquement le groupe réellement réservé. Un animal présent seulement dans le contexte de prix ne donne pas droit à une visite gratuite. Le parcours client calcule la ventilation sur le groupe lors des passages partagés ; les visites séparées restent facturées normalement.

Les pages Tarifs, réservation et CGV expliquent la règle. Les textes publics disposent de traductions anglaises et espagnoles.

## Vérification

Tests tarifaires : cas exact à 90 €, troisième et quatrième chat, visites multiples, durée partagée, déplacement, doublons, entrées invalides, groupe mixte, visite séparée avec contexte supplémentaire et hébergement inchangé. `preflight` complet réussi sur une copie isolée des sources de production (tarifs, profils animaux, paiements, 19 contrôles financiers, traductions, TypeScript, lint, construction de 83 routes).

Navigateur local authentifié : chargement admin, exemple, 90 € et 108 €, invalidation de l’ancien devis, copie, absence de débordement à 390 px, export PDF d’une page inspecté visuellement. Le tarif anglais a été vérifié à l’écran. Aucune réservation de test n’a été créée.

La copie de publication provient de 216 fichiers comparés par empreinte SHA-1 à la production `dpl_9r9KuLWtJoTdzQDRQ2KpZ8ipmGxt`. Seuls sept fichiers existants liés aux tarifs/simulateur/tests/traductions et deux nouveaux fichiers sont modifiés, ainsi que les métadonnées TypeScript régénérées. Les autres travaux du checkout sont préservés.

## BIENVENUE10 — vérification de production

Contrôle en lecture seule de la base de production, confirmée identique à celle interrogée localement, puis des cinq PaymentIntents Stripe en mode live : limite de 5 ; compteur actuel **5/5**, cinq clients distincts, zéro place disponible.

- Trois réservations ont donné lieu à un paiement réussi ; l’une a ensuite été remboursée.
- Deux réservations annulées n’ont rien encaissé (PaymentIntent `canceled`, montant reçu 0), mais conservent `couponRedeemedAt` et occupent encore deux places.
- Aucun dépassement constaté. En l’état, un nouveau client est bloqué par le quota.
- Aucune place n’a été libérée, aucun seuil modifié, aucune opération Stripe ni donnée de réservation modifiée.

Le code de bienvenue est géré spécialement par les routes de validation, réservation et Checkout ; l’absence d’une entrée BIENVENUE10 dans la table générique Coupon est normale. Le Checkout contrôle la limite sous verrou transactionnel. Une éventuelle libération des deux places annulées sans paiement constituerait une correction distincte du compteur et du traitement des annulations.

## Repères commerciaux consultés

- [Gwenn&Cie](https://gwennetcie.fr/visites-a-domicile/) : formule chat classique de 20–30 minutes à 15,50 €.
- [Coco & Raco](https://www.petsitter-cocoetraco.fr/chats) : une visite à partir de 14 €, deux chats inclus, supplément au-delà.
- [Chat Prestige](https://www.chatprestige.fr/chat_prestige_tarifs.html) : 27 € les 30 minutes pour un ou deux chats, puis supplément par chat.

Ces offres ont des zones et conditions différentes. Elles étayent le choix commercial de deux chats inclus, sans constituer une moyenne locale exhaustive.

## Publication confirmée

Déploiement **dpl_GnyMUX2DyLtWgPivhfZpAyeVc24z**, état `READY`, alias `www.lapatte-doree.fr` vérifié le 10 septembre 2026. Pages `/tarifs` et `/legal/cgv` : 200 avec la nouvelle règle ; `/admin/pricing` sans session : redirection vers la connexion. La session Chrome administrateur affiche le nouveau simulateur, les six dates et le devis généré à 90 €. Le PDF généré depuis le simulateur a été inspecté sur une page lisible.

PDF de l’exemple : `output/pdf/devis-visites-chats-septembre-2026.pdf`.

## Présentation professionnelle du devis

Document aux couleurs de La Patte Dorée avec logo, identité MM Services, coordonnées et SIRET issus du référentiel légal, destinataire, référence unique, date d’émission, date limite de validité, détail des visites et du déplacement, total HT, mention de TVA non applicable, total à payer et zone « Bon pour accord » avec date et signature.

Les noms des chats et les précisions peuvent être ajoutés. La validité est réglable de 1 à 90 jours, sans dépasser la première visite. Une date de visite passée empêche la génération. Tant que le nom et l’adresse du client manquent, le document porte la mention « Projet à compléter ». La référence est conservée lors des ajustements du devis dans la session ; il faut télécharger le document pour le conserver.

Contrôles : total à 90 €, client renseigné et projet incomplet, validité de trois jours et limite au premier passage, référence stable, invalidation du document après modification, affichage mobile sans débordement à 390 px, absence d’erreur navigateur. PDF A4 d’une page exporté et inspecté visuellement, sans client fictif dans l’exemplaire livré. Vérifications complètes `preflight` réussies sur la copie de publication, avec contrôle ciblé des différences.

La publication reprend les sources de `dpl_Msweo6ziFHRf7BweuVkUwxe24Cg5`, y compris les mises à jour de la page d’accueil intervenues pendant le travail. Seuls le simulateur de chats, le générateur de texte, leurs contrôles et les deux nouveaux fichiers de présentation changent pour cette seconde publication (hors métadonnées TypeScript régénérées).

Publication du nouveau devis confirmée : **dpl_6VS89pm59boLYWCrLXVwEaTHygRU**, état `READY`, alias `www.lapatte-doree.fr`. Les 221 fichiers de source publiés correspondent à la copie vérifiée ; aucune modification inattendue. Navigateur Chrome administrateur : génération réelle du devis à 90 €, référence et validité jusqu’au 17 septembre, mention de projet et présentation contrôlées. Accueil, tarifs et CGV accessibles ; admin protégé sans connexion. Aucun journal d’erreur retourné pour ce déploiement durant le contrôle.

## Envoi du devis par e-mail

Après génération, un formulaire permet de renseigner l’adresse e-mail du destinataire et de modifier l’objet ainsi que le message prérempli. Celui-ci reprend la référence, les dates, la durée, le nombre de chats, le montant et la validité. Le PDF peut être téléchargé avant l’envoi ; il est joint automatiquement au clic sur « Envoyer l’e-mail avec le devis ». Le nom et l’adresse du client doivent être complétés avant l’envoi.

Les routes administrateur `/api/admin/quotes/cat-visits/pdf` et `/api/admin/quotes/cat-visits/send` vérifient la session, l’origine et les données. Le serveur recalcule les montants ; aucun prix ou PDF fourni par le navigateur n’est accepté. Les envois utilisent Resend, l’expéditeur configuré et le journal e-mail existant, avec une clé de déduplication dérivée du document et du message. Les PDF sont reproductibles octet pour octet, y compris lors d’une relance. Le succès confirme l’acceptation par le service d’envoi, pas la réception dans la boîte du destinataire.

Le PDF est généré côté serveur avec `@react-pdf/renderer`, logo et polices Noto embarqués sous licence SIL OFL. L’exemple à six dates tient sur une page A4 ; un cas de 45 dates et des consignes longues a été contrôlé sur trois pages. Les références et numéros de page apparaissent en pied de page.

Contrôles automatisés sans e-mail réel : accès interdit, origine étrangère, données incomplètes, adresse e-mail invalide, devis expiré, tentative de fournir un prix, calcul central, téléchargement et pièce jointe identiques, requêtes réitérées, e-mail déjà journalisé, limite d’envoi et erreur du fournisseur. Vérification navigateur locale : champs et message prérempli, bouton activé après saisie complète, téléchargement PDF réel, absence de débordement à 390 px. Aucun client contacté pendant les vérifications.

Publication finale : **dpl_7Q1dCvS33LqUMbJDhK8Gk82NJouz**, `READY` sur `www.lapatte-doree.fr`. Elle conserve les changements de navigation de `dpl_7x6FfpnPZ3WX9DqiUGT7gKLqssM8`. `preflight` complet réussi ; ajustement final de la référence lors d’une nouvelle génération un autre jour vérifié par TypeScript, lint et compilation Vercel. Formulaire et PDF réellement téléchargé via Chrome en production vérifiés : une page A4, six visites, total 90 €. Les deux nouvelles API renvoient 403 sans session ; configuration Resend présente, aucun journal d’erreur retourné pour le déploiement final. Aucun envoi réel ni réception d’e-mail n’est revendiqué par ces tests.
