export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Utilisation des Cookies 🍪</h1>
        
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
                    <td className="py-3 font-mono text-sm text-orange-600">next-auth.session-token</td>
                    <td className="py-3">Gère votre connexion sécurisée (Session active).</td>
                    <td className="py-3">Session</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 font-mono text-sm text-orange-600">__stripe_mid / __stripe_sid</td>
                    <td className="py-3">Sécurisation des paiements et détection de fraude (Fourni par Stripe).</td>
                    <td className="py-3">1 an / 30 min</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Pas de cookies publicitaires</h2>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
              <p className="text-green-800 font-medium">
                Nous respectons votre vie privée.
              </p>
              <p className="text-sm text-green-700 mt-1">
                La Patte Dorée n'utilise aucun cookie tiers à des fins publicitaires, de traçage commercial ou de revente de données.
                Nous utilisons uniquement ce qui est nécessaire pour garder vos chiens ! 🐕
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
