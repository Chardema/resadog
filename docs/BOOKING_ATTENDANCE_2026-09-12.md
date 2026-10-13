# Rappels, retards et non-présentation — 12 septembre 2026

## Fonctionnement livré

- Rappel automatique la veille pour les réservations confirmées/en cours : chaque jour de garderie ou de garde au domicile, les passages prévus, et le départ d’un hébergement. Cron quotidien à 16:00 UTC (18:00 en été, 17:00 en hiver ; précision de lancement dépendant du forfait Vercel). Une confirmation effectuée après ce passage reçoit le mail de confirmation complet, mais pas un second rappel le même soir.
- Emails FR/EN : référence, service, animaux, dates et heures de Paris, adresse adaptée au service, itinéraire, coordonnées MM Services, téléphone client ou invitation à le fournir, matériel/consignes. Les anciens contrats ne reçoivent pas de nouvelles conditions imposées par un rappel.
- Action manuelle distincte dans Administration > Réservations : aperçu du mail, date de relance, délai annoncé, trace des échanges et justification de la retenue. 30 min minimum au dépôt ET expiration du délai de la relance, qui doit laisser au moins 15 min pour répondre. Ce minimum technique n’est pas une garantie de délai juridiquement raisonnable : l’adapter aux circonstances.
- La fonction de retenue totale est limitée à un accueil de 24 h maximum, non commencé et non terminé, intégralement encaissé, sans remboursement détecté. Elle vérifie Stripe et les CGV acceptées. Si la preuve manque, si le séjour dépasse 24 h ou si un remboursement partiel est nécessaire, traiter individuellement. Aucune capture ni création de remboursement dans cette action.
- Anciennes CGV : aucune application rétroactive du délai de 30 min. La preuve des CGV et d’un délai supplémentaire expressément accepté est nécessaire pour utiliser l’action. Le silence du client ne vaut pas acceptation.
- Récupération : 15 min sans supplément, puis prolongation expressément convenue et chiffrée. Pas de forfait punitif, journée entière ni nouveau débit automatiques. Le bien-être de l’animal demeure assuré.
- Outbox persistante, identifiant unique par rappel/date ou annulation, verrou d’envoi, reprises avec le même contenu et la même clé Resend. Les envois incertains de plus de 23 h nécessitent une vérification chez Resend avant toute réémission. SENT signifie accepté par le service d’envoi, pas livré.

## Analyse juridique et limites

Ce changement ne constitue pas une validation par un avocat ni une garantie d’opposabilité dans chaque dossier.

- Article 1119 du Code civil : les CGV doivent avoir été portées à la connaissance du client et acceptées. Archiver les versions et conserver les preuves de consentement. Le texte source antérieur est conservé dans `docs/legal/cgv-2026-09-08-source.txt`.
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040866
- Articles 1225 et 1226 du Code civil : une annulation pour inexécution suppose une base contractuelle valable ou les conditions de la résolution unilatérale ; en particulier, une mise en demeure dans un délai raisonnable, sauf exceptions prévues par la loi. Une simple relance la veille n’établit pas à elle seule ces conditions.
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041477
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041472/
- Article R212-2, 2° et 3°, du Code de la consommation et article 1231-5 du Code civil : attention à la réciprocité et aux indemnités manifestement disproportionnées. La nouvelle clause retient le préjudice justifié, plafonné au prix réservé, après coûts économisés et réattribution éventuelle. Elle prévoit restitution de la différence si la retenue totale n’est pas justifiée, et préserve les recours du client en cas d’annulation imputable au professionnel.
  https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032807198
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032010131
- Article 1218 du Code civil : examiner la force majeure selon les faits ; ne pas exclure automatiquement tout remboursement.
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041431
- Article L221-25 du Code de la consommation : le démarrage anticipé d’un service et le droit de rétractation obéissent à des conditions propres. Ne pas assimiler automatiquement la pension animale à une exception applicable à l’hôtellerie. La nouvelle règle de non-présentation ne permet pas d’écarter un droit légal de rétractation.
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179
- Médiation : au moment de la vérification, la page publique annonçait toujours la publication ultérieure des coordonnées. L’obligation de désigner un médiateur compétent et d’informer les consommateurs reste à régulariser avec une convention réelle. Aucun médiateur fictif n’est ajouté.
  https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0

## Vérifications

`npm run check:attendance` vérifie fuseaux/DST, rappels quotidiens et de récupération, créneaux multiples, adresse, contacts, limite de 08:30, délai de réponse, exclusion d’une relance faite la veille, prestation déjà commencée, long séjour, absence de doublons concurrents, reprises, expiration et blocage après la fenêtre d’idempotence.

Le preflight complet a passé dans une copie isolée reconstruite depuis le manifeste de la production. Tous les fichiers sources préexistants comparés correspondaient à la production (hors cache TypeScript). Cette méthode évite de publier les sauvegardes et autres fichiers locaux hors manifeste. Migration additive `20260912090000_booking_attendance` : tables `BookingNoShow` et `BookingNotice`.

Vérification sans envoi : GET `/api/cron/booking-reminders?dryRun=true` avec `Authorization: Bearer <CRON_SECRET>`. Aucun changement de réservation ni email dans ce mode.


## Preuve de mise en production

Déploiement `dpl_9XFLEQ9dLaewsa52fodwjC3eAcSo`, état READY, cible production, alias public `www.lapatte-doree.fr`. La configuration du projet Vercel confirme le cron activé sur `/api/cron/booking-reminders` avec `0 16 * * *`.

Contrôles après publication : CGV 200 avec version du 12 septembre et règles 30/15 minutes ; cron anonyme 401 ; mode dryRun authentifié 200, aucun email envoyé ; routes administratives anonymes 403. Tables créées par migration, sans constat d’absence enregistré. Vérifications navigateur sur ordinateur et mobile, aperçu d’annulation et CGV, sans erreur JavaScript détectée.

Les deux relances expressément demandées dans la conversation ont été acceptées par Resend : française à 08:25 et anglaise à 08:27, échéance rappelée de 08:40 (Paris). L’accès API fourni permet uniquement l’envoi ; l’interface Resend n’était pas connectée, donc aucune preuve de livraison en boîte n’a pu être obtenue. Ces relances n’ont annulé aucune réservation ni modifié aucun paiement.
