export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Politique de Confidentialité 🔒</h1>
        
        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm space-y-8 text-gray-700">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Données Collectées</h2>
            <p className="mb-2">Dans le cadre de l'utilisation de La Patte Dorée, nous collectons les informations suivantes :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identité :</strong> Nom, prénom, adresse email (via Google/Email Auth).</li>
              <li><strong>Coordonnées :</strong> Numéro de téléphone (pour la coordination des gardes).</li>
              <li><strong>Animaux :</strong> Nom, race, âge, poids, antécédents médicaux, comportement, photos.</li>
              <li><strong>Paiement :</strong> Historique des transactions et empreinte bancaire (gérés de manière sécurisée par Stripe, nous ne stockons pas vos numéros de carte complets).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Utilisation des Données</h2>
            <p>Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Gérer vos réservations et valider les disponibilités.</li>
              <li>Assurer la sécurité et le bien-être de vos animaux durant la garde (fiches médicales et comportementales).</li>
              <li>Vous contacter pour la validation des gardes ou en cas d'urgence.</li>
              <li>Traiter les paiements et remboursements via Stripe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Partage des Données</h2>
            <p>Nous ne vendons aucune donnée personnelle. Vos informations sont partagées uniquement avec :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Stripe :</strong> Pour le traitement sécurisé des paiements et la gestion des abonnements récurrents.</li>
              <li>
                <strong>Google Maps Platform :</strong> Pour afficher la note et une sélection d&apos;avis publics associés à La Patte Dorée.
                L&apos;ouverture d&apos;un profil, d&apos;un avis ou le chargement d&apos;une photo d&apos;auteur peut entraîner une connexion aux services Google.
              </li>
              <li><strong>Autorités légales :</strong> Uniquement si requis par la loi.</li>
            </ul>
            <p className="mt-4 text-sm">
              Ces contenus sont soumis à la{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-orange-700 underline underline-offset-4"
              >
                politique de confidentialité de Google
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Sécurité</h2>
            <p>
              Toutes les communications sont chiffrées (HTTPS). L'accès à votre compte est protégé par authentification.
              Les données sensibles (mots de passe, cartes bancaires) ne sont pas stockées sur nos serveurs en clair.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Vos Droits</h2>
            <p>
              Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
              Vous pouvez exercer ce droit en nous contactant directement ou via votre espace client.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
