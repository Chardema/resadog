export default function CGVPage() {
  return (
    <div className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Conditions Générales de Vente (CGV) 📜</h1>
        
        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm space-y-8 text-gray-700">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Réservation et Paiement</h2>
            <p>
              Toute réservation effectuée sur La Patte Dorée est soumise à validation. 
              Une empreinte bancaire est prise au moment de la réservation via notre partenaire Stripe.
              Le débit est effectué uniquement après confirmation de la disponibilité par nos soins (sous 48h).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Politique d'Annulation</h2>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
              <p className="font-bold text-orange-800">Annulation Gratuite jusqu'à 48h avant le début</p>
              <p className="text-sm text-orange-700 mt-1">
                Vous pouvez annuler sans frais jusqu'à 48 heures avant l'heure prévue de dépôt.
              </p>
            </div>
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li><strong>Plus de 48h avant :</strong> Remboursement intégral (ou libération de l'empreinte bancaire).</li>
              <li><strong>Moins de 48h avant :</strong> 50% du montant total sera retenu à titre de dédommagement.</li>
              <li><strong>Non présentation :</strong> La totalité du séjour est due.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Responsabilités</h2>
            <p className="mb-2"><strong>Du Propriétaire :</strong></p>
            <ul className="list-disc pl-5 mb-4">
              <li>L'animal doit être identifié (puce/tatouage) et à jour de ses vaccins.</li>
              <li>Le propriétaire doit signaler tout problème de santé ou de comportement avant le séjour.</li>
              <li>Le propriétaire reste responsable des dégâts majeurs causés par son animal s'ils résultent d'un comportement non signalé.</li>
            </ul>
            <p className="mb-2"><strong>De La Patte Dorée :</strong></p>
            <ul className="list-disc pl-5">
              <li>Nous nous engageons à assurer le bien-être, la sécurité et l'hygiène de l'animal confié.</li>
              <li>En cas d'urgence médicale, nous nous engageons à contacter le propriétaire et/ou le vétérinaire référent immédiatement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Tarifs</h2>
            <p>
              Les tarifs sont indiqués en Euros TTC. Ils varient selon le type de service (Hébergement, Visite, Promenade) et le nombre d'animaux.
              Un supplément "Chiot" (+2€/nuit) s'applique pour les animaux de moins d'un an (offert pour les abonnés).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Abonnement Le Club La Meute</h2>
            <p className="mb-2"><strong>Fonctionnement :</strong></p>
            <ul className="list-disc pl-5 mb-4">
              <li>L'abonnement donne droit à un nombre défini de crédits mensuels.</li>
              <li>1 Crédit = 1 Jour de garde ou 1 Promenade (peu importe le type).</li>
              <li>Les crédits ont une durée de validité illimitée tant que le compte est actif.</li>
            </ul>
            <p className="mb-2"><strong>Engagement et Résiliation :</strong></p>
            <ul className="list-disc pl-5">
              <li>Formule Mensuelle : Engagement minimum de 2 mois. Résiliable ensuite à tout moment sans frais.</li>
              <li>Formule Annuelle : Engagement ferme de 12 mois, payé en une fois ou mensuellement selon l'offre.</li>
              <li>Toute période commencée est due. Les crédits non utilisés restent acquis.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
