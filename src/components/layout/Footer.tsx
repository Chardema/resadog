"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Instagram, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { OPEN_BUG_REPORT_EVENT } from "@/components/layout/BetaBanner";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/google-consent";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/social-links";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
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
            <p className="text-gray-600 text-sm max-w-xs">
              Garde familiale de chiens et chats à Bussy-Saint-Georges, visites et promenades près de Disneyland Paris. Des photos et des nouvelles pendant la garde.
            </p>
            <p className="mt-3 text-sm font-semibold text-emerald-700">{LEGAL_INFORMATION.commercialName} · entreprise individuelle</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" />
                <span>77600 Bussy-Saint-Georges · Val d’Europe</span>
              </li>
              <li>
                <a
                  data-no-translate
                  href={`tel:${LEGAL_INFORMATION.phone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-2 font-medium text-gray-700 transition-colors hover:text-orange-700"
                >
                  <Phone className="h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" />
                  <span>{LEGAL_INFORMATION.phone}</span>
                </a>
              </li>
              <li>
                <a
                  data-no-translate
                  href={`mailto:${LEGAL_INFORMATION.contactEmail}`}
                  className="inline-flex items-center gap-2 break-all font-medium text-gray-700 transition-colors hover:text-orange-700"
                >
                  <Mail className="h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" />
                  <span>{LEGAL_INFORMATION.contactEmail}</span>
                </a>
              </li>
              <li className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>
                  Certifié ACACED Chien &amp; Chat n° <span data-no-translate>{LEGAL_INFORMATION.acaced.number}</span>
                </span>
              </li>
            </ul>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-800 transition-colors hover:bg-orange-50">
              <Instagram className="h-4 w-4" aria-hidden="true" />
              <span data-no-translate>Instagram · {INSTAGRAM_HANDLE}</span>
            </a>
            <div className="mt-3 md:hidden">
              <LanguageSwitcher inline />
            </div>
          </div>

          {/* Liens Rapides */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Navigation</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/booking" className="hover:text-orange-600 transition-colors">Simuler &amp; Réserver</Link></li>
              <li><Link href="/tarifs" className="hover:text-orange-600 transition-colors">Tarifs &amp; Conditions</Link></li>
              <li><Link href="/concept" className="hover:text-orange-600 transition-colors">Programme Fidélité</Link></li>
              <li><Link href="/subscriptions" className="hover:text-orange-600 transition-colors font-bold text-orange-600">Premium ✨</Link></li>
              {isAuthenticated ? (
                <>
                  <li><Link href="/dashboard" className="hover:text-orange-600 transition-colors">Mon Espace</Link></li>
                  <li><Link href="/pets" className="hover:text-orange-600 transition-colors">Mes Animaux</Link></li>
                </>
              ) : (
                <li><Link href="/auth/signin" className="hover:text-orange-600 transition-colors">Connexion client</Link></li>
              )}
            </ul>
          </div>

          {/* Zone de service */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Près de chez vous</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/garde-chien-disneyland-paris" className="hover:text-orange-600 transition-colors">Garde chien Disneyland Paris</Link></li>
              <li><Link href="/pension-chien-77" className="hover:text-orange-600 transition-colors">Pension familiale chien 77</Link></li>
              <li><Link href="/garde-chien-77" className="hover:text-orange-600 transition-colors">Garde chien Seine-et-Marne (77)</Link></li>
              <li><Link href="/garde-chat-77" className="hover:text-orange-600 transition-colors">Garde chat Seine-et-Marne (77)</Link></li>
              <li><Link href="/visite-chat-domicile-77" className="hover:text-orange-600 transition-colors">Visite chat à domicile 77</Link></li>
              <li><Link href="/garde-animaux-seine-et-marne" className="hover:text-orange-600 transition-colors">Pet-sitting Seine-et-Marne</Link></li>
              <li><Link href="/en/dog-boarding-disneyland-paris" data-no-translate className="hover:text-orange-600 transition-colors font-semibold text-orange-700">🇬🇧 Dog Boarding Disneyland Paris</Link></li>
            </ul>
          </div>

          {/* Légal & Aide */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">Légal &amp; Aide</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/legal/mentions-legales" className="hover:text-orange-600 transition-colors">Mentions légales</Link></li>
              <li><Link href="/legal/cgv" className="hover:text-orange-600 transition-colors">CGV &amp; Annulation</Link></li>
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
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_BUG_REPORT_EVENT))}
                  className="hover:text-orange-600 transition-colors"
                >
                  Signaler un problème
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-12 pt-8 text-center text-sm text-gray-600">
          <p>© {currentYear} La Patte Dorée. Tous droits réservés.</p>
          <p data-no-translate className="mt-2">
            La Patte Dorée est une activité de {LEGAL_INFORMATION.commercialName}, {LEGAL_INFORMATION.legalForm.toLowerCase()} · SIREN {LEGAL_INFORMATION.siren}
          </p>
        </div>
      </div>
    </footer>
  );
}
