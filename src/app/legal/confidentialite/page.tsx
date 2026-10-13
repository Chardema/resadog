import Link from "next/link";
import { LEGAL_DOCUMENT_VERSION_LABEL, LEGAL_INFORMATION } from "@/lib/legal";

export default function PrivacyPolicyPage() {
  return (
    <div data-no-translate className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto max-w-4xl px-6">
        <h1 className="mb-3 text-4xl font-extrabold text-gray-900">Politique de confidentialité</h1>
        <p className="mb-8 text-sm text-gray-500">Version en vigueur au {LEGAL_DOCUMENT_VERSION_LABEL}</p>

        <div className="space-y-8 rounded-[2rem] bg-white p-8 text-gray-700 shadow-sm md:p-12">
          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement est <strong>{LEGAL_INFORMATION.commercialName}</strong>, {LEGAL_INFORMATION.legalForm.toLowerCase()}, qui exploite le service {LEGAL_INFORMATION.brandName}. Les informations d’identification complètes figurent dans les <Link href="/legal/mentions-legales" className="font-semibold text-orange-700 underline">mentions légales</Link>.
            </p>
            <p className="mt-2 text-sm text-gray-500">Identité légale de l’exploitante : {LEGAL_INFORMATION.ownerName}.</p>
            <p className="mt-3">
              Pour toute question ou demande relative aux données personnelles :{" "}
              <a className="font-semibold text-orange-700 underline" href={`mailto:${LEGAL_INFORMATION.privacyEmail}`}>{LEGAL_INFORMATION.privacyEmail}</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">2. Données traitées</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Compte et authentification :</strong> nom, prénom, adresse électronique, téléphone, adresse de facturation, identifiants techniques et informations nécessaires à la sécurisation du compte.</li>
              <li><strong>Animaux :</strong> identité, espèce, race, date de naissance, poids, comportement, alimentation, traitements, informations vétérinaires, contact d’urgence, photos et justificatifs transmis.</li>
              <li><strong>Réservations :</strong> dates, horaires, adresse d’intervention, prestations demandées, instructions, messages, statut et historique.</li>
              <li><strong>Paiements et fidélité :</strong> montants, remises, statut des transactions, références Stripe, factures d’abonnement et mouvements de fidélité. Les numéros complets de carte ne sont pas stockés par {LEGAL_INFORMATION.commercialName}.</li>
              <li><strong>Support et avis :</strong> demandes adressées à l’équipe, signalements, avis et informations nécessaires à leur suivi.</li>
              <li><strong>Données techniques :</strong> journaux de sécurité, adresse IP lorsque nécessaire, choix de langue et préférence relative à la mesure d’audience.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">3. Finalités et bases légales</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Exécution du contrat et mesures précontractuelles :</strong> création du compte, préparation et gestion des réservations, coordination des gardes, paiements, remboursements et abonnement Premium.</li>
              <li><strong>Obligations légales :</strong> conservation des pièces comptables et transactionnelles, réponse aux autorités compétentes et respect des obligations professionnelles.</li>
              <li><strong>Intérêt légitime :</strong> sécurisation du service, prévention de la fraude et des abus, gestion des incidents, amélioration du fonctionnement et défense des droits de {LEGAL_INFORMATION.commercialName}.</li>
              <li><strong>Consentement :</strong> mesure d’audience et publicitaire non essentielle, ainsi que tout autre traitement présenté comme facultatif au moment de la collecte. Le consentement peut être retiré à tout moment.</li>
            </ul>
            <p className="mt-4">
              Les informations signalées comme nécessaires dans les formulaires conditionnent la création du compte, la sécurité de l’animal ou l’exécution de la prestation. Sans elles, la demande concernée peut ne pas être traitée.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">4. Destinataires et sous-traitants</h2>
            <p>Les données sont accessibles à l’équipe de {LEGAL_INFORMATION.commercialName} dans la limite de ses besoins et aux prestataires nécessaires au service :</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li><strong>Vercel</strong> pour l’hébergement et l’exécution du site ;</li>
              <li><strong>Supabase</strong> pour le stockage des comptes, animaux, réservations et journaux applicatifs ;</li>
              <li><strong>UploadThing</strong> pour les photos d’animaux et justificatifs téléversés ;</li>
              <li><strong>Stripe</strong> pour les paiements, remboursements, abonnements et documents de facturation associés ;</li>
              <li><strong>Resend</strong> pour les courriels transactionnels ;</li>
              <li><strong>Google ou Apple</strong> si le client choisit l’un de ces fournisseurs pour se connecter ;</li>
              <li><strong>Google Maps Platform</strong> pour les avis publics, et Google Analytics/Ads uniquement selon le choix de consentement applicable ;</li>
              <li><strong>les autorités ou conseils professionnels</strong> lorsque la loi l’exige ou que la défense d’un droit le justifie.</li>
            </ul>
            <p className="mt-4">
              Certains prestataires peuvent traiter des données hors de l’Espace économique européen. Dans ce cas, le transfert doit reposer sur un mécanisme reconnu par la réglementation applicable et sur les garanties contractuelles du prestataire concerné.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">5. Durées de conservation</h2>
            <p>
              Les données sont conservées pendant la durée nécessaire à la gestion du compte et des prestations, puis pendant les délais utiles au respect des obligations légales, comptables et fiscales ou à la défense de droits en justice. Les justificatifs relatifs aux animaux sont conservés tant qu’ils sont nécessaires à la vérification et à la sécurité des prestations. Les journaux techniques et choix de consentement sont conservés pour une durée proportionnée à leur finalité. À l’issue de ces délais, les données sont supprimées ou anonymisées lorsqu’une conservation identifiable n’est plus nécessaire.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">6. Sécurité</h2>
            <p>
              Les communications avec le site sont chiffrées par HTTPS. L’accès aux comptes et aux espaces d’administration est protégé par des mécanismes d’authentification. Les données de paiement complètes sont traitées par Stripe et ne transitent pas en clair dans l’application.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">7. Vos droits</h2>
            <p>
              Selon la base légale et la situation, vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la limitation du traitement, leur portabilité ou vous opposer à certains traitements. Vous pouvez retirer votre consentement à tout moment sans remettre en cause les traitements antérieurs à ce retrait.
            </p>
            <p className="mt-3">
              Une demande peut être adressée au contact indiqué ci-dessus ou par courrier à l’adresse professionnelle. Une preuve d’identité peut être demandée uniquement en cas de doute raisonnable sur l’identité du demandeur. Vous pouvez également introduire une réclamation auprès de la <a className="font-semibold text-orange-700 underline" href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">CNIL</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">8. Cookies et mesure d’audience</h2>
            <p>
              Les informations relatives aux traceurs, à leur finalité et à la modification des préférences figurent sur la page <Link href="/legal/cookies" className="font-semibold text-orange-700 underline">Cookies</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
