import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-orange-100 py-12 mt-auto">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                🐾
              </div>
              <span className="text-xl font-bold text-gray-900">La Patte Dorée</span>
            </Link>
            <p className="text-gray-500 text-sm max-w-xs">
              Service de garde d'animaux premium avec suivi en temps réel. 
              Offrez à vos compagnons des vacances aussi belles que les vôtres.
            </p>
          </div>

          {/* Liens Rapides */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Navigation</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/dashboard" className="hover:text-orange-600 transition-colors">Mon Espace</Link></li>
              <li><Link href="/booking" className="hover:text-orange-600 transition-colors">Réserver</Link></li>
              <li><Link href="/pets" className="hover:text-orange-600 transition-colors">Mes Animaux</Link></li>
              <li><Link href="/concept" className="hover:text-orange-600 transition-colors font-bold text-orange-600">Le Club (Abonnements) ✨</Link></li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Légal</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/legal/cgv" className="hover:text-orange-600 transition-colors">CGV & Annulation</Link></li>
              <li><Link href="/legal/confidentialite" className="hover:text-orange-600 transition-colors">Politique de Confidentialité</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-orange-600 transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-12 pt-8 text-center text-sm text-gray-400">
          <p>© {currentYear} La Patte Dorée. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
