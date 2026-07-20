"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/google-consent";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  const { status } = useSession();
  const authenticatedAppPath = [
    "/dashboard",
    "/booking",
    "/history",
    "/pets",
    "/profile",
    "/subscriptions",
    "/admin",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (authenticatedAppPath && status !== "unauthenticated") return null;

  return (
    <footer className="bg-white border-t border-orange-100 py-12 mt-auto">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 overflow-hidden rounded-full border border-orange-100 bg-[#FDFBF7] shadow-md">
                <Image
                  src="/logo-mark.png"
                  width={40}
                  height={40}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-xl font-bold text-gray-900">La Patte Dorée</span>
            </Link>
            <p className="text-gray-500 text-sm max-w-xs">
              Service de garde d’animaux premium avec suivi en temps réel.
              Offrez à vos compagnons des vacances aussi belles que les vôtres.
            </p>
            <p className="mt-3 text-sm font-semibold text-emerald-700">Professionnelle titulaire de l’ACACED</p>
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

          {/* Zone de service */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Près de chez vous</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/garde-chien-disneyland-paris" className="hover:text-orange-600 transition-colors">Autour de Disneyland Paris</Link></li>
              <li><Link href="/garde-chat-77" className="hover:text-orange-600 transition-colors">Pour les chats</Link></li>
              <li><Link href="/pension-chien-77" className="hover:text-orange-600 transition-colors">Hébergement familial</Link></li>
              <li><Link href="/garde-animaux-seine-et-marne" className="hover:text-orange-600 transition-colors">Toutes nos zones</Link></li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Légal</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/legal/mentions-legales" className="hover:text-orange-600 transition-colors">Mentions légales</Link></li>
              <li><Link href="/legal/cgv" className="hover:text-orange-600 transition-colors">CGV & Annulation</Link></li>
              <li><Link href="/legal/confidentialite" className="hover:text-orange-600 transition-colors">Politique de Confidentialité</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-orange-600 transition-colors">Cookies</Link></li>
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
                  className="hover:text-orange-600 transition-colors"
                >
                  Gérer mes cookies
                </button>
              </li>
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
