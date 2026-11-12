import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, GraduationCap, Home, MapPin, MoonStar, type LucideIcon } from "lucide-react";
import { ABOUT_PAGE_PATH, getAboutPageRobotsOptions, getPublishedAboutPageContent } from "@/lib/about-page";
import { buildMetadata } from "@/lib/seo";

// La photo et le texte personnel se renseignent dans src/lib/about-page.ts.
// Tant qu'ils ne le sont pas tous les deux, la page reste en noindex (canonical
// conservé) et n'affiche que le contenu déjà validé ci-dessous.
export const metadata = buildMetadata({
  title: "À propos de Mégane",
  description:
    "Découvrez Mégane, pet-sitter de La Patte Dorée à Bussy-Saint-Georges : diplômée ACACED, activité déclarée, appartement de 45 m² et 1 animal par nuit.",
  path: ABOUT_PAGE_PATH,
  ...getAboutPageRobotsOptions(),
});

const FACTS: Array<{ icon: LucideIcon; label: string; title: string }> = [
  { icon: GraduationCap, label: "Formation", title: "Diplômée ACACED" },
  { icon: BadgeCheck, label: "Statut", title: "Activité déclarée" },
  { icon: Home, label: "Logement", title: "Appartement de 45 m²" },
  { icon: MoonStar, label: "Hébergement", title: "1 animal par nuit" },
  { icon: MapPin, label: "Ville", title: "Bussy-Saint-Georges" },
];

export default function AboutPage() {
  const content = getPublishedAboutPageContent();

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

        {content && (
          <section className="grid gap-6 md:grid-cols-[2fr_3fr] md:items-stretch mb-16">
            <h2 className="sr-only">Présentation de Mégane</h2>

            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-orange-100 bg-orange-50/50 shadow-sm">
              <Image
                src={content.photo.src}
                alt={content.photo.alt}
                width={content.photo.width}
                height={content.photo.height}
                sizes="(max-width: 768px) 100vw, 40vw"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-xl shadow-orange-100/50 space-y-4 text-gray-700 leading-relaxed">
              {content.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

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
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-orange-800"
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
