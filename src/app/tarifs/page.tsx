import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  BadgeEuro,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Info,
  MoonStar,
  PawPrint,
  Percent,
  ShieldCheck,
} from "lucide-react";
import {
  LAST_MINUTE_DESCRIPTION,
  CAT_VISIT_PRICING_DESCRIPTION,
  OTHER_ANIMAL_PRICING_DESCRIPTION,
  DOG_24_HOUR_RATE,
  DOG_DAY_CARE_MAX_MINUTES,
  DOG_DAY_CARE_RATE,
  EXTRA_DURATION,
  getServiceDisplayPrice,
  getServiceDisplayPriceForDuration,
  HOUSE_SITTING_DURATION_TIERS,
  LONG_BOARDING_DISCOUNT_RATE,
  LONG_BOARDING_MIN_PERIODS,
  YOUNG_ANIMAL_SURCHARGE,
} from "@/lib/pricing";
import { PREMIUM_SUBSCRIPTION } from "@/lib/subscription-pricing";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Tarifs de garde d’animaux",
  description:
    "Tous les tarifs de La Patte Dorée : hébergement, garderie, garde à domicile, visites, promenades, suppléments, remises et annulation.",
  path: "/tarifs",
  keywords: [
    "tarif garde chien 77",
    "tarif garde chat 77",
    "prix pet-sitter Disneyland Paris",
    "prix pension chien Seine-et-Marne",
  ],
});

const PRICING_PHOTOS = [
  {
    src: "/images/galerie/jardin-golden.webp",
    badge: "Pension & Garderie chien",
    caption: "Golden Retriever en promenade dans le jardin clos ensoleillé",
    alt: "Golden Retriever en promenade dans le jardin ensoleillé chez La Patte Dorée",
  },
  {
    src: "/images/galerie/chat-tigre-canape.webp",
    badge: "Pension & Visites chat",
    caption: "Chat tigré détendu sur le canapé familial au calme",
    alt: "Chat tigré détendu sur le canapé familial chez La Patte Dorée",
  },
  {
    src: "/images/galerie/balade-golden-creme.webp",
    badge: "Promenades & Jardin clos",
    caption: "Sorties quotidiennes en pleine nature incluses dans l’accueil",
    alt: "Balade quotidienne en pleine nature avec un chien gardé par La Patte Dorée",
  },
] as const;

const formatPrice = (amount: number) =>
  amount.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function Price({ amount }: { amount: number }) {
  return <span data-no-translate>{formatPrice(amount)} €</span>;
}

function PriceRow({
  label,
  dog,
  cat,
  unit,
  note,
}: {
  label: string;
  dog: number | string;
  cat: number | string;
  unit: string;
  note?: string;
}) {
  return (
    <div className="grid gap-3 border-b border-gray-100 py-5 last:border-0 md:grid-cols-[1.25fr_0.75fr_0.75fr] md:items-start">
      <div>
        <p className="font-bold text-gray-950">{label}</p>
        <p className="mt-1 text-sm leading-6 text-gray-500">{unit}</p>
        {note && <p className="mt-1 text-xs leading-5 text-gray-500">{note}</p>}
      </div>
      <div className="rounded-lg bg-orange-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Chien</p>
        <p className="mt-1 text-xl font-extrabold text-gray-950">
          {typeof dog === "number" ? <Price amount={dog} /> : dog}
        </p>
      </div>
      <div className="rounded-lg bg-amber-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Chat</p>
        <p className="mt-1 text-xl font-extrabold text-gray-950">
          {typeof cat === "number" ? <Price amount={cat} /> : cat}
        </p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const boarding = getServiceDisplayPrice("BOARDING");
  const dayCare = getServiceDisplayPrice("DAY_CARE");
  const dropIn = getServiceDisplayPrice("DROP_IN");
  const walking = getServiceDisplayPrice("DOG_WALKING");
  const visitPrices = [30, 60, 90, 120].map((duration) => ({
    duration,
    dog: getServiceDisplayPriceForDuration("DROP_IN", "DOG", duration) || 0,
    cat: getServiceDisplayPriceForDuration("DROP_IN", "CAT", duration) || 0,
  }));
  const dogWalk60 = getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 60) || 0;
  const dogWalk90 = getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 90) || 0;
  const dogWalk120 = getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 120) || 0;

  return (
    <div className="min-h-screen bg-[#FDFbf7] text-gray-950">

      <main className="pt-24 md:pt-32">
        <section className="border-b border-orange-100 bg-white">
          <div className="container mx-auto grid gap-8 px-6 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-orange-700">Tarifs en vigueur</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
                Tous les prix, avant de réserver
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
                La grille ci-dessous reprend les prix réellement utilisés par le calculateur de réservation. Le total exact dépend des dates, horaires, animaux et options choisis, puis reste affiché avant l’envoi de la demande.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/booking"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-950 px-6 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                >
                  Calculer ma réservation
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/legal/cgv"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-bold text-gray-800 transition-colors hover:border-orange-200 hover:text-orange-700"
                >
                  Voir les CGV
                </Link>
              </div>
            </div>

            <aside className="rounded-2xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-xl shadow-emerald-950/10">
              <ShieldCheck className="h-7 w-7 text-emerald-300" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-bold">Des suppléments annoncés avant validation</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-100">
                {LAST_MINUTE_DESCRIPTION}
              </p>
            </aside>
          </div>
        </section>

        <section className="container mx-auto px-6 pt-12">
          <div className="mb-6 max-w-2xl">
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-800">
              <Camera className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />
              <span>Cadre réel · Maison familiale sans box</span>
            </p>
            <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl">
              Chaque tarif inclut un vrai accueil familial
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">
              Zéro cage ni chenil : vos chiens et chats profitent du salon familial, du jardin clos et de vraies sorties quotidiennes à Bussy-Saint-Georges (77).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PRICING_PHOTOS.map((photo) => (
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

        <section className="container mx-auto px-6 py-14">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  <MoonStar className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Chez le pet-sitter</p>
                  <h2 className="text-2xl font-bold">Hébergement et garderie</h2>
                </div>
              </div>

              <PriceRow
                label="Hébergement avec nuit"
                dog={boarding.dogPrice}
                cat={boarding.catPrice}
                unit="Par période de 24 h commencée"
                note="Le calcul se fait sur la durée réelle entre le dépôt et la reprise, sans nouvelle facturation au simple passage de minuit."
              />
              <PriceRow
                label="Garderie de jour"
                dog={dayCare.dogPrice}
                cat={dayCare.catPrice}
                unit={`Par jour, jusqu’à ${DOG_DAY_CARE_MAX_MINUTES / 60} h`}
                note="Plusieurs jours peuvent être réservés : chaque journée respecte les mêmes horaires et reste limitée à 10 h."
              />

              <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-950">
                <p className="font-bold">Règle chien à retenir</p>
                <p className="mt-1">
                  Jusqu’à 10 h le même jour : <Price amount={DOG_DAY_CARE_RATE} />. De 10 h 01 à 24 h : <Price amount={DOG_24_HOUR_RATE} />. À 24 h 01, une deuxième période commence, soit <Price amount={DOG_24_HOUR_RATE * 2} />.
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Chez vous</p>
                  <h2 className="text-2xl font-bold">Garde au domicile du client</h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {HOUSE_SITTING_DURATION_TIERS.map((tier) => (
                  <div key={tier.label} className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <p className="font-bold text-gray-900">{tier.label}</p>
                    <p className="text-sm text-gray-700">Chien : <strong><Price amount={tier.prices.DOG} /></strong></p>
                    <p className="text-sm text-gray-700">Chat : <strong><Price amount={tier.prices.CAT} /></strong></p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-500">
                Tarif par jour, selon la durée quotidienne choisie. La présence comprend la compagnie, les repas, les sorties et le respect de la routine habituelle.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Passage ponctuel</p>
                  <h2 className="text-2xl font-bold">Visites à domicile</h2>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {visitPrices.map((item) => (
                  <div key={item.duration} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                    <p className="text-xs font-bold text-gray-500">{item.duration} min</p>
                    <p className="mt-2 text-sm font-bold text-orange-700">Chien <Price amount={item.dog} /></p>
                    <p className="mt-1 text-sm font-bold text-amber-700">Chat <Price amount={item.cat} /></p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-500">
                Tarif de départ pour {dropIn.durationMinutes || 30} minutes, puis <Price amount={EXTRA_DURATION.DROP_IN.extraRate} /> par tranche supplémentaire de {EXTRA_DURATION.DROP_IN.increment} minutes commencée.
              </p>
              <p className="mt-3 text-sm leading-6 text-orange-800">{CAT_VISIT_PRICING_DESCRIPTION}</p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <PawPrint className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Sortie individuelle</p>
                  <h2 className="text-2xl font-bold">Promenade</h2>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { duration: 30, price: walking.dogPrice },
                  { duration: 60, price: dogWalk60 },
                  { duration: 90, price: dogWalk90 },
                  { duration: 120, price: dogWalk120 },
                ].map((item) => (
                  <div key={item.duration} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                    <p className="text-xs font-bold text-gray-500">{item.duration} min</p>
                    <p className="mt-1 text-xl font-extrabold"><Price amount={item.price} /></p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-500">
                Chien : <Price amount={walking.dogPrice} /> les 30 premières minutes, puis <Price amount={EXTRA_DURATION.DOG_WALKING.extraRate} /> par tranche supplémentaire de 30 minutes commencée. Promenade de chat : sur demande.
              </p>
            </article>
          </div>
        </section>

        <section className="border-y border-orange-100 bg-white">
          <div className="container mx-auto px-6 py-14">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">Règles et suppléments</p>
              <h2 className="mt-2 text-3xl font-bold">Ce qui peut modifier le total</h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  icon: PawPrint,
                  title: "Chiot de moins d’un an",
                  text: `${YOUNG_ANIMAL_SURCHARGE} € par jour de garderie ou par période de 24 h commencée en hébergement. Aucun supplément jeune animal pour les chats ni pour les autres services.`,
                },
                {
                  icon: BadgeEuro,
                  title: "Animal supplémentaire",
                  text: `${CAT_VISIT_PRICING_DESCRIPTION} ${OTHER_ANIMAL_PRICING_DESCRIPTION}`,
                },
                {
                  icon: Percent,
                  title: "Long hébergement",
                  text: `Remise automatique de ${LONG_BOARDING_DISCOUNT_RATE * 100} % à partir de ${LONG_BOARDING_MIN_PERIODS} périodes de 24 h commencées.`,
                },
                {
                  icon: Info,
                  title: "Déplacements et frais réels",
                  text: "Le parking, les péages ou les transports exceptionnellement nécessaires sont facturés uniquement après information et accord préalable.",
                },
                {
                  icon: CheckCircle2,
                  title: "Réservation de dernière minute",
                  text: LAST_MINUTE_DESCRIPTION,
                },
                {
                  icon: Clock3,
                  title: "Prix final",
                  text: "Les dates, les heures, la durée, le nombre d’animaux et les remises apparaissent dans le détail avant l’envoi de la réservation.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-xl border border-gray-200 bg-[#FDFbf7] p-5">
                  <Icon className="h-5 w-5 text-orange-600" aria-hidden="true" />
                  <h3 className="mt-3 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-6 py-14 lg:grid-cols-2">
          <article className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-7 text-white sm:p-8">
            <Percent className="h-7 w-7 text-orange-100" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-bold">Offres et Premium</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-orange-50">
              <li><strong>Premium</strong> : <Price amount={PREMIUM_SUBSCRIPTION.monthlyPrice} /> par mois, engagement initial de trois mois ({PREMIUM_SUBSCRIPTION.minimumCommitmentTotal.toFixed(2).replace(".", ",")} € au total), puis renouvellement mensuel sans engagement ; -10 % jusqu’à {PREMIUM_SUBSCRIPTION.maximumDiscountPerBooking} € par réservation.</li>
              <li>Les remises ne sont pas cumulables. Le système compare votre avantage fidélité ou Premium et les remises automatiques, puis conserve l’avantage le plus favorable.</li>
            </ul>
            <Link href="/subscriptions" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-50">
              Découvrir Premium
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-7 sm:p-8">
            <CalendarClock className="h-7 w-7 text-emerald-700" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-bold">Annulation</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-gray-600">
              <li><strong className="text-gray-950">Tarif standard :</strong> annulation gratuite au moins 48 h avant le début ; à moins de 48 h, 50 % du montant est retenu.</li>
              <li><strong className="text-gray-950">Client Premium :</strong> même règle d’annulation ; possibilité de demander en priorité un report au moins 24 h avant, sous réserve de disponibilité.</li>
              <li><strong className="text-gray-950">Non-présentation :</strong> 100 % de la prestation est due.</li>
            </ul>
            <Link href="/legal/cgv" className="mt-6 inline-flex text-sm font-bold text-orange-700 underline underline-offset-4">
              Lire les conditions complètes
            </Link>
          </article>
        </section>
      </main>
    </div>
  );
}
