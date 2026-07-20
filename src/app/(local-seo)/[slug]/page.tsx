import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServiceDisplayPrice, getServiceDisplayPriceForDuration } from "@/lib/pricing";
import {
  buildMetadata,
  getBreadcrumbJsonLd,
  getFaqJsonLd,
  getLocalSeoPage,
  getLocalServiceJsonLd,
  localSeoPages,
} from "@/lib/seo";

type SeoPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return localSeoPages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({ params }: SeoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getLocalSeoPage(slug);

  if (!page) {
    return buildMetadata({
      title: "Page introuvable",
      description: "Cette page n'existe pas.",
      path: `/${slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: page.metaTitle,
    description: page.description,
    path: page.path,
    keywords: page.keywords,
  });
}

export default async function LocalSeoPage({ params }: SeoPageProps) {
  const { slug } = await params;
  const page = getLocalSeoPage(slug);

  if (!page) notFound();

  const boardingPrice = getServiceDisplayPrice("BOARDING");
  const dayCarePrice = getServiceDisplayPrice("DAY_CARE");
  const dropInPrice = getServiceDisplayPrice("DROP_IN");
  const walkingPrice = getServiceDisplayPrice("DOG_WALKING");
  const dropInTwoHourCatPrice = getServiceDisplayPriceForDuration("DROP_IN", "CAT", 120);
  const relatedPages = localSeoPages.filter((relatedPage) => relatedPage.slug !== page.slug).slice(0, 3);
  const proofIcons = [ShieldCheck, Home, Camera, CalendarCheck];

  const priceHighlights = [
    {
      label: "Hébergement chien",
      value: `${boardingPrice.dogPrice} € / nuit`,
    },
    {
      label: "Hébergement chat",
      value: `${boardingPrice.catPrice} € / nuit`,
    },
    {
      label: "Garderie chien",
      value: `${dayCarePrice.dogPrice} € / jour`,
    },
    {
      label: "Visite chat",
      value: `${dropInPrice.catPrice} € / ${dropInPrice.durationMinutes || 30} min`,
    },
    {
      label: "Promenade chien",
      value: `${walkingPrice.dogPrice} € / ${walkingPrice.durationMinutes || 30} min`,
    },
    {
      label: "Visite 2 h chat",
      value: dropInTwoHourCatPrice ? `${dropInTwoHourCatPrice} €` : "Sur demande",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFbf7] text-gray-950">
      <AppNav />

      <main className="pt-24 md:pt-32">
        <section className="border-b border-orange-100 bg-white">
          <div className="container mx-auto grid gap-10 px-6 py-14 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">{page.eyebrow}</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight text-gray-950 sm:text-5xl">
                {page.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{page.lead}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/booking"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-950 px-6 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                >
                  {page.ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-bold text-gray-800 transition-colors hover:border-orange-200 hover:text-orange-700"
                >
                  Créer mon espace client
                </Link>
              </div>

              {page.disneyDisclaimer && (
                <p className="mt-4 max-w-2xl text-xs leading-5 text-gray-500">
                  Service indépendant de garde d'animaux, non affilié à Disneyland Paris.
                </p>
              )}
            </div>

            <aside className="rounded-lg border border-gray-200 bg-[#FDFbf7] p-5">
              <div className="flex items-center gap-3 border-b border-orange-100 pb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-600 text-white">
                  <PawPrint className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-950">La Patte Dorée</p>
                  <p className="text-xs text-gray-500">Garde chien et chat dans le 77</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {priceHighlights.map((price) => (
                  <div key={price.label} className="flex items-center justify-between gap-4 rounded-lg bg-white px-4 py-3 text-sm">
                    <span className="text-gray-600">{price.label}</span>
                    <span className="font-bold text-gray-950">{price.value}</span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Tarifs indicatifs hors suppléments éventuels. Le prix final est calculé au moment de la réservation.
              </p>
            </aside>
          </div>
        </section>

        <section className="container mx-auto px-6 py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {page.proofPoints.map((proofPoint, index) => {
              const Icon = proofIcons[index] || BadgeCheck;
              return (
                <div key={proofPoint} className="rounded-lg border border-orange-100 bg-white p-5">
                  <Icon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-gray-950">{proofPoint}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white">
          <div className="container mx-auto grid gap-10 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">Nos solutions</p>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">Une garde adaptée à votre compagnon</h2>
              <p className="mt-4 text-base leading-7 text-gray-600">{page.intent}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {page.services.map((service) => (
                <article key={service.title} className="rounded-lg border border-gray-200 bg-[#FDFbf7] p-5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold text-gray-950">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{service.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 py-14">
          <div className="grid gap-6 lg:grid-cols-2">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="text-2xl font-bold text-gray-950">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-600">{section.body}</p>
                <ul className="mt-5 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-sm leading-6 text-gray-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-orange-100 bg-orange-50/60">
          <div className="container mx-auto grid gap-8 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <div className="flex items-center gap-2 text-orange-700">
                <MapPin className="h-5 w-5" aria-hidden="true" />
                <p className="text-sm font-bold uppercase tracking-wide">Secteur desservi</p>
              </div>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">Où nous intervenons</h2>
              <p className="mt-4 text-sm leading-7 text-gray-600">
                Chaque demande est confirmée selon les dates, la distance, le profil de l'animal et les disponibilités.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {page.areas.map((area) => (
                <span key={area} className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 py-14">
          <div className="mb-8 flex items-center gap-3">
            <Clock className="h-6 w-6 text-orange-600" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-gray-950">Questions fréquentes</h2>
          </div>

          <dl className="grid gap-4 lg:grid-cols-2">
            {page.faqs.map((faq) => (
              <div key={faq.question} className="rounded-lg border border-gray-200 bg-white p-6">
                <dt className="font-bold text-gray-950">{faq.question}</dt>
                <dd className="mt-3 text-sm leading-6 text-gray-600">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="container mx-auto px-6 pb-20">
          <div className="rounded-lg bg-gray-950 p-6 text-white md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <h2 className="text-2xl font-bold">Besoin d'une garde fiable dans le 77 ?</h2>
                <p className="mt-3 text-sm leading-6 text-gray-300">
                  Ajoutez votre animal, indiquez les dates et recevez une validation avant confirmation.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link
                  href="/booking"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-gray-950 transition-colors hover:bg-orange-50"
                >
                  Réserver maintenant
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  Voir les services
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-white">
          <div className="container mx-auto px-6 py-12">
            <h2 className="text-2xl font-bold text-gray-950">Découvrir aussi</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {relatedPages.map((relatedPage) => (
                <Link
                  key={relatedPage.slug}
                  href={relatedPage.path}
                  className="group rounded-lg border border-gray-200 bg-[#FDFbf7] p-5 transition-colors hover:border-orange-300 hover:bg-orange-50"
                >
                  <span className="text-sm font-bold text-gray-950 group-hover:text-orange-800">{relatedPage.eyebrow}</span>
                  <span className="mt-2 block text-xs leading-5 text-gray-600">{relatedPage.description}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <JsonLd data={[getLocalServiceJsonLd(page), getFaqJsonLd(page), getBreadcrumbJsonLd(page)]} />
    </div>
  );
}
