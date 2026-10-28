"use client";

import Link from "next/link";
import { ArrowUpRight, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { GOOGLE_MAPS_PLACE_URL } from "@/lib/google-reviews";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/social-links";

const SERVED_TOWNS = [
  "Bussy-Saint-Georges",
  "Serris",
  "Chessy",
  "Montévrain",
  "Bailly-Romainvilliers",
  "Magny-le-Hongre",
  "Coupvray",
  "Chanteloup-en-Brie",
  "Jossigny",
  "Ferrières-en-Brie",
  "Lagny-sur-Marne",
  "Torcy",
  "Lognes",
];

const LOCAL_SEO_LINKS = [
  { href: "/garde-chien-disneyland-paris", label: "Garde chien Disneyland Paris" },
  { href: "/pension-chien-77", label: "Pension familiale chien 77" },
  { href: "/garde-chien-77", label: "Garde chien Seine-et-Marne (77)" },
  { href: "/garde-chat-77", label: "Garde chat Seine-et-Marne (77)" },
  { href: "/visite-chat-domicile-77", label: "Visite chat à domicile 77" },
  { href: "/garde-animaux-seine-et-marne", label: "Pet-sitting Seine-et-Marne" },
];

export function LocationSection() {
  return (
    <section id="nous-trouver" aria-labelledby="location-title" className="container mx-auto scroll-mt-28 px-6 py-16 md:py-20">
      <div className="mb-8 max-w-2xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-emerald-800">Tout près de vous</p>
        <h2 id="location-title" className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">À Bussy-Saint-Georges, près de Disneyland Paris</h2>
        <p className="mt-4 leading-7 text-gray-600">Hébergement familial, visites et promenades autour de Val d’Europe. Le lieu et les horaires de prise en charge sont convenus lors de la réservation.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white">
          <div className="flex min-h-80 items-center justify-center bg-emerald-50">
            <iframe
              title="Carte du secteur de Bussy-Saint-Georges"
              src="https://www.google.com/maps?q=Bussy-Saint-Georges%2C%20France&z=13&output=embed"
              className="h-80 w-full border-0 sm:h-96"
              loading={"lazy"}
              referrerPolicy="no-referrer"
              allowFullScreen
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-gray-600">Carte du secteur d’intervention</p>
            <a href={GOOGLE_MAPS_PLACE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-800 hover:underline">Ouvrir notre fiche Google Maps <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
            <h3 className="text-xl font-bold text-gray-900">Une question avant de réserver ?</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">Parlons des habitudes de votre compagnon et de vos dates.</p>
            <div className="mt-4 flex flex-col items-start gap-1">
              <div className="inline-flex min-h-11 items-center gap-3 text-sm font-medium text-gray-700">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>77600 Bussy-Saint-Georges (à 10 min de Disneyland Paris &amp; Val d’Europe) · Accueil 7j/7 sur réservation</span>
              </div>
              <a data-no-translate href={`tel:${LEGAL_INFORMATION.phone.replace(/\D/g, "")}`} className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-gray-800 hover:text-orange-700"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" />{LEGAL_INFORMATION.phone}</a>
              <a data-no-translate href={`mailto:${LEGAL_INFORMATION.contactEmail}`} className="inline-flex min-h-11 items-center gap-3 break-all text-sm font-semibold text-gray-800 hover:text-orange-700"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{LEGAL_INFORMATION.contactEmail}</a>
            </div>
          </div>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="group flex flex-col justify-center rounded-3xl border border-orange-200 bg-orange-50 p-6 transition-colors hover:bg-orange-100 sm:p-8">
            <div className="flex items-center justify-between text-orange-800"><Instagram className="h-7 w-7" aria-hidden="true" /><ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></div>
            <h3 className="mt-4 text-xl font-bold text-gray-900">Retrouvez-nous sur Instagram</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">Les nouvelles de La Patte Dorée, en images.</p>
            <span data-no-translate className="mt-4 break-all text-sm font-bold text-orange-800">{INSTAGRAM_HANDLE}</span>
          </a>
        </div>
      </div>

      {/* Maillage local : communes desservies & pages locales SEO */}
      <div className="mt-6 grid gap-6 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Communes desservies autour de Bussy-Saint-Georges &amp; Val d’Europe</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Hébergement familial chez nous ou visites et promenades à domicile dans tout le secteur de Marne-la-Vallée :
          </p>
          <div data-no-translate className="mt-3 flex flex-wrap gap-1.5">
            {SERVED_TOWNS.map((town) => (
              <span
                key={town}
                className="rounded-lg border border-orange-100 bg-orange-50/50 px-2.5 py-1 text-xs font-medium text-gray-700"
              >
                {town}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-orange-100 pt-5 lg:col-span-7 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-800">
            Nos gardes par besoin en Seine-et-Marne (77)
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Consultez les informations pratiques, accès et tarifs selon le mode de garde recherché :
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCAL_SEO_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200/80 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors hover:border-orange-400 hover:bg-orange-50/60 hover:text-orange-800"
              >
                <span>{item.label}</span>
                <span aria-hidden="true" className="text-orange-600">→</span>
              </Link>
            ))}
            <Link
              href="/en/dog-boarding-disneyland-paris"
              data-no-translate
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100/70"
            >
              <span>🇬🇧 Dog Boarding Disneyland Paris</span>
              <span aria-hidden="true" className="text-amber-700">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
