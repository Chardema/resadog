"use client";

import Image from "next/image";
import { Camera, Instagram } from "lucide-react";
import { INSTAGRAM_URL } from "@/lib/social-links";

const GALLERY_PHOTOS = [
  {
    src: "/images/galerie/salon-chien-chat.webp",
    badge: "Vie au salon",
    caption: "Chien et chat cohabitant paisiblement au salon",
    alt: "Chien et chat cohabitant paisiblement au salon chez La Patte Dorée",
  },
  {
    src: "/images/galerie/jardin-golden.webp",
    badge: "Jardin & extérieur",
    caption: "Golden Retriever en promenade dans le jardin ensoleillé",
    alt: "Golden Retriever en promenade dans le jardin ensoleillé chez La Patte Dorée",
  },
  {
    src: "/images/galerie/balade-golden-creme.webp",
    badge: "Promenades",
    caption: "Balade quotidienne en pleine nature",
    alt: "Balade quotidienne en pleine nature avec un chien gardé par La Patte Dorée",
  },
  {
    src: "/images/galerie/chat-soleil-jardin.webp",
    badge: "Garde chat",
    caption: "Chat profitant du soleil dans l'herbe",
    alt: "Chat profitant du soleil dans l'herbe pendant sa garde",
  },
  {
    src: "/images/galerie/interieur-chien-noir.webp",
    badge: "Comme à la maison",
    caption: "Repos au calme à la maison sans box",
    alt: "Repos au calme à la maison sans box ni cage chez La Patte Dorée",
  },
  {
    src: "/images/galerie/chat-tigre-canape.webp",
    badge: "Confort familial",
    caption: "Chat tigré détendu sur le canapé",
    alt: "Chat tigré détendu sur le canapé familial chez La Patte Dorée",
  },
] as const;

export function PhotoGallerySection() {
  return (
    <section
      id="galerie"
      className="container mx-auto scroll-mt-28 px-6 pb-16 md:pb-20"
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-orange-800">
            <Camera className="h-4 w-4 text-orange-700" aria-hidden="true" />
            <span>Vraies photos · Cadre 100 % familial</span>
          </p>
          <h2
            className="text-3xl font-bold text-gray-900 md:text-4xl"
          >
            Nos pensionnaires comme à la maison
          </h2>
          <p className="mt-2 text-base text-gray-600 sm:text-lg">
            Un aperçu réel du quotidien chez La Patte Dorée à Bussy-Saint-Georges : vie au salon, jardin clos et balades attentives, sans box ni cage.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {GALLERY_PHOTOS.map((photo) => (
          <figure
            key={photo.src}
            className="group rounded-2xl overflow-hidden border border-orange-100 bg-white shadow-sm flex flex-col"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-orange-50/50">
              <Image
                src={photo.src}
                alt={photo.alt}
                width={800}
                height={600}
                sizes="(max-width: 768px) 50vw, 33vw"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute top-2.5 left-2.5 rounded-full bg-white/95 backdrop-blur-sm border border-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-900 shadow-sm">
                {photo.badge}
              </span>
            </div>
            <figcaption className="p-3 sm:p-3.5 text-xs sm:text-sm font-medium text-gray-700 leading-snug">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 px-5 py-4">
        <p className="text-xs sm:text-sm font-medium text-gray-700 text-center sm:text-left">
          Retrouvez encore plus de photos et de stories de nos pensionnaires au quotidien sur Instagram.
        </p>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-orange-800 shadow-sm transition-colors hover:bg-orange-100"
        >
          <Instagram className="h-4 w-4 text-orange-700" aria-hidden="true" />
          <span>Suivre sur Instagram</span>
          <span data-no-translate className="text-orange-700">@lapatte_doree</span>
        </a>
      </div>
    </section>
  );
}
