import { LEGAL_DOCUMENT_VERSION_LABEL, LEGAL_INFORMATION } from "@/lib/legal";

export default function CookiesPage() {
  return (
    <div data-no-translate className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="mb-3 text-4xl font-extrabold text-gray-900">Cookies et traceurs</h1>
        <p className="mb-8 text-sm text-gray-500">Version en vigueur au {LEGAL_DOCUMENT_VERSION_LABEL}</p>
        
        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm space-y-8 text-gray-700">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Qu'est-ce qu'un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette ou mobile) lors de la visite d'un site.
              Il permet de retenir certaines informations sur votre visite pour simplifier votre navigation ultérieure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Cookies Essentiels (Strictement nécessaires)</h2>
            <p className="mb-4">
              Ces cookies sont indispensables au fonctionnement du site. Vous ne pouvez pas les refuser sans altérer le fonctionnement de l'application.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 font-bold">Nom</th>
                    <th className="py-2 font-bold">Fonction</th>
                    <th className="py-2 font-bold">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 font-mono text-sm text-orange-600">authjs.session-token / __Secure-authjs.session-token</td>
                    <td className="py-3">Maintient la connexion sécurisée à l’espace client.</td>
                    <td className="py-3">7 jours maximum</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 font-mono text-sm text-orange-600">site-locale</td>
                    <td className="py-3">Mémorise la langue choisie pour afficher le site.</td>
                    <td className="py-3">1 an</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Lors du paiement, Stripe peut déposer ses propres traceurs nécessaires à la sécurisation et à la prévention de la fraude sur ses pages. Leur gestion relève alors de Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Mesure d’audience et des annonces</h2>
            <p className="mb-4">
              Avec votre accord uniquement, nous utilisons Google Analytics et la mesure Google Ads afin de comprendre
              quelles pages sont consultées et si nos annonces permettent de trouver nos services. Le tag utilisé est
              <span className="font-mono text-sm"> G-6HN68EFFPH</span>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 font-bold">Nom</th>
                    <th className="py-2 font-bold">Fonction</th>
                    <th className="py-2 font-bold">Durée maximale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 font-mono text-sm text-orange-600">_ga / _ga_*</td>
                    <td className="py-3">Mesure d’audience et attribution des campagnes Google.</td>
                    <td className="py-3">13 mois</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Si vous refusez, ces stockages restent désactivés. Vous pouvez modifier votre choix à tout moment depuis
              le lien « Gérer mes cookies » situé en bas du site. Le choix est mémorisé dans votre navigateur sous la clé
              <span className="font-mono text-sm"> la-patte-doree-google-consent-v2</span>. {LEGAL_INFORMATION.commercialName} ne revend pas vos données.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
