import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
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
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getServiceDisplayPrice,
  getServiceDisplayPriceForDuration,
  HOUSE_SITTING_DURATION_TIERS,
} from "@/lib/pricing";
import {
  absoluteUrl,
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

type LocalPhotoCard = {
  src: string;
  badge: string;
  caption: string;
  alt: string;
};

type LocalPagePhotosConfig = {
  hero: {
    src: string;
    width: number;
    height: number;
    badge: string;
    caption: string;
    alt: string;
  };
  galleryHeading: string;
  gallerySubheading: string;
  gallery: [LocalPhotoCard, LocalPhotoCard, LocalPhotoCard];
};

function getLocalPagePhotos(slug: string): LocalPagePhotosConfig {
  if (slug === "garde-chat-77" || slug === "visite-chat-domicile-77") {
    return {
      hero: {
        src:
          slug === "garde-chat-77"
            ? "/images/galerie/chat-tigre-canape.webp"
            : "/images/galerie/chat-soleil-jardin.webp",
        width: 800,
        height: 600,
        badge: "Garde chat · 100 % sereine",
        caption:
          slug === "garde-chat-77"
            ? "Chat tigré détendu sur le canapé familial chez La Patte Dorée"
            : "Chat profitant du soleil dans l'herbe pendant sa garde en Seine-et-Marne",
        alt:
          slug === "garde-chat-77"
            ? "Chat tigré détendu sur le canapé familial chez La Patte Dorée en Seine-et-Marne (77)"
            : "Chat profitant du soleil dans l'herbe pendant une garde chat en Seine-et-Marne (77)",
      },
      galleryHeading: "Un aperçu réel de nos gardes et visites chats dans le 77",
      gallerySubheading:
        "Vraies photos prises lors de nos gardes : respect des habitudes, calme, câlins et nouvelles envoyées à chaque passage.",
      gallery: [
        {
          src: "/images/galerie/chat-tigre-canape.webp",
          badge: "Confort familial",
          caption: "Chat tigré détendu sur le canapé",
          alt: "Chat tigré détendu sur le canapé familial chez La Patte Dorée",
        },
        {
          src: "/images/galerie/chat-soleil-jardin.webp",
          badge: "Garde chat",
          caption: "Chat profitant du soleil dans l'herbe",
          alt: "Chat profitant du soleil dans l'herbe pendant sa garde",
        },
        {
          src: "/images/galerie/salon-chien-chat.webp",
          badge: "Vie au salon",
          caption: "Chien et chat cohabitant paisiblement au salon",
          alt: "Chien et chat cohabitant paisiblement au salon chez La Patte Dorée",
        },
      ],
    };
  }

  if (slug === "garde-animaux-seine-et-marne") {
    return {
      hero: {
        src: "/images/hero-famille.webp",
        width: 1200,
        height: 900,
        badge: "Maison familiale · Zéro box",
        caption: "Accueil familial chiens et chats à Bussy-Saint-Georges (77)",
        alt: "Cavalier King Charles endormi paisiblement dans un fauteuil chez La Patte Dorée en Seine-et-Marne (77)",
      },
      galleryHeading: "Le cadre réel chez La Patte Dorée en Seine-et-Marne",
      gallerySubheading:
        "Vraies photos de nos pensionnaires chiens et chats à Bussy-Saint-Georges : salon familial, jardin clos et repos au calme.",
      gallery: [
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
          src: "/images/galerie/chat-tigre-canape.webp",
          badge: "Confort familial",
          caption: "Chat tigré détendu sur le canapé",
          alt: "Chat tigré détendu sur le canapé familial chez La Patte Dorée",
        },
      ],
    };
  }

  return {
    hero: {
      src: "/images/hero-famille.webp",
      width: 1200,
      height: 900,
      badge: "Maison familiale · 100 % sans box",
      caption:
        slug === "garde-chien-disneyland-paris"
          ? "Repos au calme en maison familiale à 10 min de Disneyland Paris"
          : "Hébergement familial sans box ni chenil en Seine-et-Marne (77)",
      alt:
        slug === "garde-chien-disneyland-paris"
          ? "Cavalier King Charles endormi paisiblement dans un fauteuil chez La Patte Dorée à 10 min de Disneyland Paris"
          : "Cavalier King Charles endormi paisiblement dans un fauteuil chez La Patte Dorée en Seine-et-Marne (77)",
    },
    galleryHeading:
      slug === "garde-chien-disneyland-paris"
        ? "Le cadre réel pendant votre journée à Disneyland Paris"
        : "Un cadre de maison réel pour votre chien dans le 77",
    gallerySubheading:
      "Vraies photos de nos pensionnaires à Bussy-Saint-Georges : jardin clos, vraies promenades incluses et repos au salon sans cage.",
    gallery: [
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
        src: "/images/galerie/interieur-chien-noir.webp",
        badge: "Comme à la maison",
        caption: "Repos au calme à la maison sans box",
        alt: "Repos au calme à la maison sans box ni cage chez La Patte Dorée",
      },
    ],
  };
}

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

  const isDisneyPage = slug === "garde-chien-disneyland-paris";

  return buildMetadata({
    title: page.metaTitle,
    description: page.description,
    path: page.path,
    keywords: page.keywords,
    ...(isDisneyPage
      ? {
          alternatesLanguages: {
            fr: absoluteUrl("/garde-chien-disneyland-paris"),
            "fr-FR": absoluteUrl("/garde-chien-disneyland-paris"),
            en: absoluteUrl("/en/dog-boarding-disneyland-paris"),
            "en-GB": absoluteUrl("/en/dog-boarding-disneyland-paris"),
            "en-US": absoluteUrl("/en/dog-boarding-disneyland-paris"),
            "x-default": absoluteUrl("/garde-chien-disneyland-paris"),
          },
        }
      : {}),
  });
}

export default async function LocalSeoPage({ params }: SeoPageProps) {
  const { slug } = await params;
  const page = getLocalSeoPage(slug);

  if (!page) notFound();

  const isDisneyPage = page.slug === "garde-chien-disneyland-paris";
  const isDogFocused = page.slug.includes("chien");
  const pagePhotos = getLocalPagePhotos(page.slug);

  const boardingPrice = getServiceDisplayPrice("BOARDING");
  const dayCarePrice = getServiceDisplayPrice("DAY_CARE");
  const dropInPrice = getServiceDisplayPrice("DROP_IN");
  const walkingPrice = getServiceDisplayPrice("DOG_WALKING");
  const dropInTwoHourCatPrice = getServiceDisplayPriceForDuration("DROP_IN", "CAT", 120);

  const relatedPages = localSeoPages
    .filter((relatedPage) => relatedPage.slug !== page.slug)
    .sort((a, b) => {
      if (!isDogFocused) return 0;
      const aScore = a.slug.includes("chien") ? 0 : a.slug.includes("animaux") ? 1 : 2;
      const bScore = b.slug.includes("chien") ? 0 : b.slug.includes("animaux") ? 1 : 2;
      return aScore - bScore;
    })
    .slice(0, 3);

  const proofIcons = [ShieldCheck, Home, Camera, CalendarCheck];

  const priceHighlights = isDisneyPage
    ? [
        {
          label: "Garderie de jour chien (jusqu’à 10 h)",
          value: `${dayCarePrice.dogPrice} €`,
        },
        {
          label: "Hébergement familial 24 h",
          value: `${boardingPrice.dogPrice} € / 24 h`,
        },
        {
          label: "Promenade 30 min",
          value: `${walkingPrice.dogPrice} € / ${walkingPrice.durationMinutes || 30} min`,
        },
        {
          label: "Visite 30 min",
          value: `${dropInPrice.dogPrice} € / ${dropInPrice.durationMinutes || 30} min`,
        },
        {
          label: "Garde à votre domicile / hôtel",
          value: `${HOUSE_SITTING_DURATION_TIERS[0].prices.DOG} à ${HOUSE_SITTING_DURATION_TIERS[2].prices.DOG} € / jour`,
        },
      ]
    : [
        {
          label: "Hébergement chien",
          value: `${boardingPrice.dogPrice} € / période de 24 h`,
        },
        {
          label: "Hébergement chat",
          value: `${boardingPrice.catPrice} € / période de 24 h`,
        },
        {
          label: "Garderie chien",
          value: `${dayCarePrice.dogPrice} € / jusqu’à 10 h`,
        },
        {
          label: "Garderie chat",
          value: `${dayCarePrice.catPrice} € / jusqu’à 10 h`,
        },
        {
          label: "Visite chien",
          value: `${dropInPrice.dogPrice} € / ${dropInPrice.durationMinutes || 30} min`,
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
        {
          label: "Garde à votre domicile",
          value: `${HOUSE_SITTING_DURATION_TIERS[0].prices.CAT} à ${HOUSE_SITTING_DURATION_TIERS[2].prices.DOG} € / jour`,
        },
      ];

  return (
    <div className="min-h-screen bg-[#FDFbf7] text-gray-950">

      <main className="pt-24 md:pt-32">
        <section className="border-b border-orange-100 bg-white">
          <div className="container mx-auto grid gap-10 px-6 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              {isDisneyPage && (
                <div className="mb-4 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                    <Award className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    Diplômée d’État ACACED Chien &amp; Chat
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
                    <MapPin className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />
                    RER A Bussy-Saint-Georges (8 min) · A4 sortie 12 (10 min)
                  </span>
                </div>
              )}

              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">{page.eyebrow}</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight text-gray-950 sm:text-5xl">
                {page.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{page.lead}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/booking"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-950 px-6 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                >
                  {page.ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href={isDisneyPage ? "/tarifs" : "/auth/signup"}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-bold text-gray-800 transition-colors hover:border-orange-200 hover:text-orange-700"
                >
                  {isDisneyPage ? "Simuler mon tarif" : "Créer mon espace client"}
                </Link>
              </div>

              {isDisneyPage && (
                <div className="mt-4">
                  <Link
                    href="/en/dog-boarding-disneyland-paris"
                    data-no-translate
                    className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50/70 px-3.5 py-2 text-xs sm:text-sm font-bold text-orange-900 transition-colors hover:bg-orange-100"
                  >
                    <span aria-hidden="true">🇬🇧</span>
                    <span>Visiting from abroad? Read this page in English</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              )}

              {page.disneyDisclaimer && (
                <p className="mt-4 max-w-2xl text-xs leading-5 text-gray-500">
                  Service indépendant de garde d'animaux certifié ACACED, non affilié à Disneyland Paris.
                </p>
              )}

              <figure className="mt-8 overflow-hidden rounded-2xl border border-orange-100 bg-[#FDFbf7] shadow-sm">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-orange-50/50">
                  <Image
                    src={pagePhotos.hero.src}
                    alt={pagePhotos.hero.alt}
                    width={pagePhotos.hero.width}
                    height={pagePhotos.hero.height}
                    priority
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white/95 px-3 py-1 text-xs font-bold text-orange-900 shadow-sm backdrop-blur-sm">
                    <Camera className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />
                    <span>{pagePhotos.hero.badge}</span>
                  </span>
                </div>
                <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium text-gray-700">
                  <span>{pagePhotos.hero.caption}</span>
                  <span className="shrink-0 font-bold text-orange-800">Bussy-Saint-Georges (77)</span>
                </figcaption>
              </figure>
            </div>

            <aside className="rounded-2xl border border-gray-200 bg-[#FDFbf7] p-5 shadow-sm">
              <div className="flex items-center gap-3 border-b border-orange-100 pb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-600 text-white">
                  <PawPrint className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-950">La Patte Dorée</p>
                  <p className="text-xs text-gray-500">
                    {isDisneyPage
                      ? "Garde familiale chien · À 10 min de Disneyland Paris"
                      : "Garde chien et chat dans le 77"}
                  </p>
                </div>
              </div>

              {isDisneyPage && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-semibold text-emerald-900">
                  ✓ Diplômée ACACED · ✓ Bussy-Saint-Georges (RER A 8 min / A4 sortie 12 10 min)
                </div>
              )}

              <div className="mt-5 space-y-3">
                {priceHighlights.map((price) => (
                  <div key={price.label} className="flex items-center justify-between gap-4 rounded-lg bg-white px-4 py-3 text-sm">
                    <span className="text-gray-600">{price.label}</span>
                    <span className="font-bold text-gray-950">{price.value}</span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                {isDisneyPage
                  ? "Horaires réels : la période de 24 h démarre à l’heure de dépôt (le passage de minuit ne déclenche jamais une seconde journée facturée)."
                  : "Tarifs de base issus de la grille en vigueur. Le prix final est calculé selon les dates, horaires et animaux choisis, puis affiché avant la demande."}
              </p>
              <Link href="/tarifs" className="mt-3 inline-flex text-sm font-bold text-orange-700 underline underline-offset-4">
                Voir tous les tarifs et conditions
              </Link>
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

        <section className="container mx-auto px-6 pb-12">
          <div className="mb-6 max-w-2xl">
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-800">
              <Camera className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />
              <span>Vraies photos · Cadre 100 % familial</span>
            </p>
            <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl">{pagePhotos.galleryHeading}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">{pagePhotos.gallerySubheading}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {pagePhotos.gallery.map((photo) => (
              <figure
                key={photo.src}
                className="group flex flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-orange-50/50">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={800}
                    height={600}
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute top-2.5 left-2.5 rounded-full border border-orange-100 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-orange-900 shadow-sm backdrop-blur-sm">
                    {photo.badge}
                  </span>
                </div>
                <figcaption className="p-3.5 text-xs sm:text-sm font-medium leading-snug text-gray-700">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white">
          <div className="container mx-auto grid gap-10 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
                {isDisneyPage ? "Formules & Tarifs clairs" : "Nos solutions"}
              </p>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">
                {isDisneyPage
                  ? "Quelle garde choisir pendant votre séjour à Disneyland Paris ?"
                  : "Une garde adaptée à votre compagnon"}
              </h2>
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
                <dt>
                  <h3 className="text-base font-bold text-gray-950">{faq.question}</h3>
                </dt>
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
