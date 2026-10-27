"use client";

import { ArrowUpRight, Instagram, Mail, Phone } from "lucide-react";
import { GOOGLE_MAPS_PLACE_URL } from "@/lib/google-reviews";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/social-links";

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
    </section>
  );
}
