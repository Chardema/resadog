import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Camera, GraduationCap, Home, MapPin, MoonStar, PenLine, type LucideIcon } from "lucide-react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "À propos de Mégane",
  description:
    "Découvrez Mégane, pet-sitter de La Patte Dorée à Bussy-Saint-Georges : diplômée ACACED, activité déclarée, appartement de 45 m² et 1 animal par nuit.",
  path: "/a-propos",
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENU À VALIDER PAR CHRISTOPHER
// Tant que ces deux constantes valent `null`, la page affiche des emplacements
// visibles « Photo à valider » et « Texte personnel à valider ».
// - Photo : déposer le fichier dans /public/images/ puis renseigner src, alt,
//   width et height (ex. { src: "/images/megane.webp", alt: "…", width: 800, height: 1000 }).
// - Texte : un paragraphe par entrée du tableau, en français. Penser ensuite à
//   ajouter les traductions EN/ES (npm run check:translations).
// ─────────────────────────────────────────────────────────────────────────────
// `as` évite que TypeScript réduise le type à `null` tant que rien n'est renseigné.
const MEGANE_PHOTO = null as { src: string; alt: string; width: number; height: number } | null;
const MEGANE_PERSONAL_TEXT = null as string[] | null;

const FACTS: Array<{ icon: LucideIcon; label: string; title: string }> = [
  { icon: GraduationCap, label: "Formation", title: "Diplômée ACACED" },
  { icon: BadgeCheck, label: "Statut", title: "Activité déclarée" },
  { icon: Home, label: "Logement", title: "Appartement de 45 m²" },
  { icon: MoonStar, label: "Hébergement", title: "1 animal par nuit" },
  { icon: MapPin, label: "Ville", title: "Bussy-Saint-Georges" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200">
      <main className="pt-32 pb-24 container mx-auto px-6 max-w-5xl">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="inline-block bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full font-bold text-sm mb-6">
            À propos
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Mégane,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
              la pet-sitter de La Patte Dorée
            </span>
          </h1>
          <p className="text-lg text-gray-600">
            Celle qui s’occupe de votre compagnon chez La Patte Dorée, à Bussy-Saint-Georges.
          </p>
        </div>

        <section className="grid gap-6 md:grid-cols-[2fr_3fr] md:items-stretch mb-16">
          <h2 className="sr-only">Présentation de Mégane</h2>

          {MEGANE_PHOTO ? (
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-orange-100 bg-orange-50/50 shadow-sm">
              <Image
                src={MEGANE_PHOTO.src}
                alt={MEGANE_PHOTO.alt}
                width={MEGANE_PHOTO.width}
                height={MEGANE_PHOTO.height}
                sizes="(max-width: 768px) 100vw, 40vw"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              id="photo-megane-a-valider"
              data-a-valider
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-orange-300 bg-orange-50/60 p-6 text-center"
            >
              <Camera className="h-10 w-10 text-orange-500" aria-hidden="true" />
              <p className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Photo à valider
              </p>
              <p className="text-sm text-orange-900">Emplacement réservé à la photo de Mégane.</p>
            </div>
          )}

          {MEGANE_PERSONAL_TEXT ? (
            <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-xl shadow-orange-100/50 space-y-4 text-gray-700 leading-relaxed">
              {MEGANE_PERSONAL_TEXT.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div
              id="texte-personnel-megane-a-valider"
              data-a-valider
              className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-orange-300 bg-white p-8 text-center"
            >
              <PenLine className="h-10 w-10 text-orange-500" aria-hidden="true" />
              <p className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Texte personnel à valider
              </p>
              <p className="text-sm text-gray-600">Emplacement réservé au texte de présentation de Mégane.</p>
            </div>
          )}
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl text-center mb-8">
            En bref
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
            {FACTS.map(({ icon: Icon, label, title }) => (
              <li key={title} className="flex items-center gap-3.5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-bold text-gray-900">{title}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/booking"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-orange-600"
          >
            Simuler &amp; Réserver
          </Link>
          <Link
            href="/tarifs"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-900 transition-colors hover:bg-gray-50"
          >
            Tarifs &amp; Conditions
          </Link>
        </div>
      </main>
    </div>
  );
}
