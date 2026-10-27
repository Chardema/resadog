import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
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
import { LocaleBookingLink, LocaleSync } from "@/components/seo/LocaleSync";
import { absoluteUrl, buildMetadata, getSiteUrl, SITE_NAME } from "@/lib/seo";

const EN_PATH = "/en/dog-boarding-disneyland-paris";
const FR_PATH = "/garde-chien-disneyland-paris";

const enKeywords = [
  "dog boarding Disneyland Paris",
  "Disneyland Paris kennel alternative",
  "dog daycare near Disneyland Paris",
  "Disneyland Paris pet care center alternative",
  "Disneyland Paris Animal Care Center alternative",
  "dog sitter Disneyland Paris",
  "overnight dog boarding near Disneyland Paris",
];

const enAreas = [
  "Disneyland Paris",
  "Bussy-Saint-Georges",
  "Marne-la-Vallée Chessy",
  "Val d'Europe",
  "Serris",
  "Montévrain",
  "Magny-le-Hongre",
  "Coupvray",
  "Bailly-Romainvilliers",
  "Villages Nature Paris",
];

const enProofPoints = [
  {
    icon: Home,
    text: "100% Cage-Free Family Home & Enclosed Garden",
  },
  {
    icon: MapPin,
    text: "2 RER A Stops (8 mins) or 10-Min Drive from Disneyland Paris",
  },
  {
    icon: Camera,
    text: "Daily Walks Included & Photo Updates Sent to Your Phone",
  },
  {
    icon: ShieldCheck,
    text: "French State-Certified Pet Sitter (ACACED) & Secure Stripe Booking",
  },
];

const enServices = [
  {
    title: "Dog Day Care — €35 (Up to 10 Hours)",
    text: "Drop your dog off in the morning before rope drop and pick them up in the evening (up to 10 hours total). Includes walks, playtime in the garden, rest inside our home, and photo updates.",
  },
  {
    title: "24-Hour Family Boarding — €45 (10h to 24h, Overnight Included)",
    text: "Staying for the night-time fireworks show or sleeping at a nearby hotel? For €45 per rolling 24-hour period, your dog enjoys a full day of care plus a peaceful night indoors with us — or late pick-up without stress.",
  },
  {
    title: "Multi-Day Holiday Boarding",
    text: "Travelling from the UK, Ireland, Belgium, the Netherlands, or across Europe? Leave your dog in a loving home environment for your entire Disney holiday, with daily routines and feeding instructions strictly followed.",
  },
  {
    title: "Hotel & Rental Drop-In Visits / Walks",
    text: "Staying in a pet-friendly Airbnb or aparthotel in Chessy, Serris, Val d'Europe, or Bussy-Saint-Georges? We can visit your accommodation for walks, feeding, and cuddles while you're at the parks.",
  },
];

const enSections = [
  {
    title: "Why Pet Owners Choose La Patte Dorée Over the Official Park Kennel",
    body: "Many international visitors don't realise until they arrive that the official Disneyland Paris Animal Care Center is a traditional kennel: dogs are kept in individual cages, and cast members do not walk the dogs (owners are expected to leave the parks during the day to walk their pet themselves). At La Patte Dorée, your dog stays in a calm, cage-free home and we handle every walk for you.",
    bullets: [
      "No cages, no concrete runs: your dog relaxes on the sofa and plays in our enclosed garden",
      "Walks are included: stay inside the parks all day without having to leave at lunchtime",
      "Stay for the evening fireworks: our €45 / 24h boarding lets you enjoy the night show or pick up the next morning",
      "Regular photo and message updates so your whole family can enjoy the rides worry-free",
    ],
  },
  {
    title: "Easy Drop-Off by Car (A4 Motorway) or RER A Train",
    body: "Our home is located in Bussy-Saint-Georges (77600), right on the main route to Disneyland Paris. Drop-off and pick-up are arranged by appointment to make your park morning smooth and fast.",
    bullets: [
      "By Car: 10 minutes from the Disneyland Paris car parks and Disney hotels via the A4 motorway (Exit 12 – Bussy-Saint-Georges)",
      "By Train (RER A): Bussy-Saint-Georges station is just 2 stops (8 minutes) from Marne-la-Vallée Chessy (Disneyland Paris train station)",
      "Convenient for guests staying in Val d'Europe, Serris, Chessy, Magny-le-Hongre, Coupvray, Bailly-Romainvilliers, and Villages Nature Paris",
      "Every dog's profile (health, vaccination record, temperament) is reviewed before confirmation for everyone's safety",
    ],
  },
];

const enFaqs = [
  {
    question: "How is La Patte Dorée different from the Disneyland Paris Animal Care Center (kennel)?",
    answer:
      "At the official Disneyland Paris Animal Care Center, dogs stay in individual kennel cages and staff do not walk them — owners must leave the parks during the day to walk their dogs themselves. At La Patte Dorée, your dog stays in our family home in Bussy-Saint-Georges (10 minutes away) with zero cages, garden access, real walks included, and photo updates sent to you while you enjoy the parks.",
  },
  {
    question: "Should I book Day Care (€35) or 24-Hour Boarding (€45) for a full park day?",
    answer:
      "Day Care (€35) covers up to 10 hours on the same day. Because a full day at Disneyland Paris — from morning opening to the night-time fireworks show — often lasts 12 to 14 hours, most park visitors choose our 24-Hour Family Boarding (€45). It covers any stay from 10 to 24 hours, including overnight if you prefer to pick your dog up the next morning.",
  },
  {
    question: "How far are you from Disneyland Paris and how do I get there?",
    answer:
      "We are located in Bussy-Saint-Georges (77600), just a 10-minute drive from Disneyland Paris and the Disney/Val d'Europe hotels via the A4 motorway (Exit 12). By public transport, we are just 2 stops (8 minutes) on the RER A train from Marne-la-Vallée Chessy station (right at the park gates).",
  },
  {
    question: "Will my dog be kept in a cage or crate?",
    answer:
      "Never. We provide 100% cage-free family boarding. Your dog lives indoors with us as part of the family, with access to our enclosed garden and regular walks. Two dog-friendly cats also live in our house and have their own separate space whenever needed.",
  },
  {
    question: "Can I drop my dog off early before the parks open?",
    answer:
      "Yes! When you book online, you select your exact arrival and departure times so you can drop your dog off before heading to the park entrance.",
  },
  {
    question: "What do I need to bring for my dog's stay?",
    answer:
      "Please bring your dog's usual food (to avoid upset stomachs), leash, collar or harness, up-to-date vaccination/health record (or EU Pet Passport / Animal Health Certificate for UK & international travellers), and a familiar blanket or toy if you like.",
  },
  {
    question: "Is La Patte Dorée affiliated with Disneyland Paris?",
    answer:
      "No. La Patte Dorée is an independent, French state-certified (ACACED) pet sitting and boarding service located in Seine-et-Marne (77), with no affiliation with Disneyland Paris.",
  },
];

const priceHighlights = [
  {
    label: "Dog Day Care (up to 10 hrs)",
    value: "€35",
    note: "Ideal for a daytime park visit",
  },
  {
    label: "24-Hour Family Boarding (overnight)",
    value: "€45 / 24h",
    note: "Ideal for late fireworks or hotel stays",
  },
  {
    label: "Puppy Surcharge (< 1 year old)",
    value: "+€5 / day or 24h",
  },
  {
    label: "Long Stay Discount (14+ days)",
    value: "-10% automatic",
  },
  {
    label: "30-Min Dog Walk / Drop-In Visit",
    value: "€15 – €16",
  },
];

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Dog Boarding & Daycare Near Disneyland Paris (Cage-Free)",
    description:
      "Looking for a cage-free alternative to the Disneyland Paris kennel? Family dog daycare (€35/10h) & 24h boarding (€45) just 10 mins from the parks. Walks included.",
    path: EN_PATH,
    keywords: enKeywords,
    locale: "en_GB",
    alternatesLanguages: {
      fr: absoluteUrl(FR_PATH),
      "fr-FR": absoluteUrl(FR_PATH),
      en: absoluteUrl(EN_PATH),
      "en-GB": absoluteUrl(EN_PATH),
      "en-US": absoluteUrl(EN_PATH),
      "x-default": absoluteUrl(FR_PATH),
    },
  });
}

function getEnglishJsonLd() {
  const siteUrl = getSiteUrl();
  const enUrl = absoluteUrl(EN_PATH);

  return [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${enUrl}#service`,
      name: "Cage-Free Dog Boarding & Daycare Near Disneyland Paris",
      description:
        "Cage-free family dog daycare (€35 up to 10h) and 24-hour dog boarding (€45) in Bussy-Saint-Georges, 10 minutes from Disneyland Paris. Walks and photo updates included.",
      url: enUrl,
      inLanguage: "en",
      provider: {
        "@id": `${siteUrl}/#localbusiness`,
        "@type": "LocalBusiness",
        name: SITE_NAME,
        telephone: "+33771593016",
        address: {
          "@type": "PostalAddress",
          streetAddress: "29 boulevard des 100 Arpents",
          postalCode: "77600",
          addressLocality: "Bussy-Saint-Georges",
          addressCountry: "FR",
        },
      },
      serviceType: "Dog Boarding and Daycare near Disneyland Paris",
      areaServed: enAreas.slice(0, 9).map((name) => ({
        "@type": "Place",
        name,
      })),
      offers: [
        {
          "@type": "Offer",
          name: "Dog Day Care (up to 10 hours)",
          price: "35.00",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          url: absoluteUrl("/booking"),
        },
        {
          "@type": "Offer",
          name: "24-Hour Cage-Free Family Dog Boarding",
          price: "45.00",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          url: absoluteUrl("/booking"),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "en",
      mainEntity: enFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Dog Boarding & Daycare Near Disneyland Paris",
          item: enUrl,
        },
      ],
    },
  ];
}

export default function EnglishDisneyDogBoardingPage() {
  return (
    <div className="min-h-screen bg-[#FDFbf7] text-gray-950">
      <LocaleSync locale="en" />

      <main data-no-translate className="pt-24 md:pt-32">
        <section className="border-b border-orange-100 bg-white">
          <div className="container mx-auto grid gap-10 px-6 py-14 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                  <Award className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  French State-Certified (ACACED)
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
                  <MapPin className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />
                  Bussy-Saint-Georges · RER A (8 mins) · A4 Exit 12 (10 mins)
                </span>
              </div>

              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
                Dog Boarding &amp; Daycare · 10 mins from Disneyland Paris
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight text-gray-950 sm:text-5xl">
                Cage-Free Dog Boarding &amp; Daycare Near Disneyland Paris
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
                Visiting Disneyland Paris for the day or staying at a nearby hotel? Treat your dog to a cosy,
                stress-free stay in a real family home while you enjoy the parks. Located in{" "}
                <strong className="font-semibold text-gray-900">Bussy-Saint-Georges</strong> — just{" "}
                <strong className="font-semibold text-gray-900">2 RER A train stops (8 minutes)</strong> or a{" "}
                <strong className="font-semibold text-gray-900">10-minute drive</strong> from Disneyland Paris —{" "}
                <strong className="font-semibold text-gray-900">La Patte Dorée</strong> offers cage-free family care,
                garden access, real walks, and photo updates throughout the day.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <LocaleBookingLink
                  href="/booking"
                  locale="en"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-950 px-6 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  Check Availability &amp; Book Online
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </LocaleBookingLink>
                <LocaleBookingLink
                  href="/tarifs"
                  locale="en"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-bold text-gray-800 transition-colors hover:border-orange-200 hover:text-orange-700"
                >
                  View Full Pricing
                </LocaleBookingLink>
              </div>

              <div className="mt-4">
                <Link
                  href={FR_PATH}
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50/70 px-3.5 py-2 text-xs sm:text-sm font-bold text-orange-900 transition-colors hover:bg-orange-100"
                >
                  <span aria-hidden="true">🇫🇷</span>
                  <span>Voir cette page en français</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              <p className="mt-4 max-w-2xl text-xs leading-5 text-gray-500">
                Independent, state-certified (ACACED) pet care service. Not affiliated with Disneyland Paris.
              </p>
            </div>

            <aside className="rounded-lg border border-gray-200 bg-[#FDFbf7] p-5">
              <div className="flex items-center gap-3 border-b border-orange-100 pb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-600 text-white">
                  <PawPrint className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-950">La Patte Dorée</p>
                  <p className="text-xs text-gray-500">Family Dog Care · 10 mins from the Parks</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {priceHighlights.map((price) => (
                  <div key={price.label} className="rounded-lg bg-white px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-gray-700 font-medium">{price.label}</span>
                      <span className="font-bold text-gray-950 shrink-0">{price.value}</span>
                    </div>
                    {price.note && <p className="mt-0.5 text-xs text-gray-500">{price.note}</p>}
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-600">
                <strong className="font-semibold text-gray-900">Fair 24-hour clock:</strong> For overnight boarding,
                your 24-hour period starts at drop-off time — crossing midnight never triggers an extra day&apos;s
                charge. Final price is calculated online before you confirm.
              </p>
              <LocaleBookingLink
                href="/tarifs"
                locale="en"
                className="mt-3 inline-flex text-sm font-bold text-orange-700 underline underline-offset-4"
              >
                View full rates &amp; terms
              </LocaleBookingLink>
            </aside>
          </div>
        </section>

        <section className="container mx-auto px-6 py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {enProofPoints.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="rounded-lg border border-orange-100 bg-white p-5">
                  <Icon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-gray-950">{item.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white">
          <div className="container mx-auto grid gap-10 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">Flexible Care Options</p>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">
                The Warm Alternative to the Disneyland Paris Kennel
              </h2>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Whether you are visiting Disneyland Park and Walt Disney Studios for a single day or spending a week at
                a Val d&apos;Europe or Disney hotel where pets aren&apos;t allowed, we match your schedule so you never
                have to rush back mid-day.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {enServices.map((service) => (
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
            {enSections.map((section) => (
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
                <p className="text-sm font-bold uppercase tracking-wide">Areas Served</p>
              </div>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">Convenient for All Disney &amp; Val d&apos;Europe Hotels</h2>
              <p className="mt-4 text-sm leading-7 text-gray-600">
                Located in Bussy-Saint-Georges (77600), we welcome dogs from visitors staying across the entire
                Marne-la-Vallée / Disneyland Paris resort area.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {enAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 py-14">
          <div className="mb-8 flex items-center gap-3">
            <Clock className="h-6 w-6 text-orange-600" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-gray-950">Frequently Asked Questions</h2>
          </div>

          <dl className="grid gap-4 lg:grid-cols-2">
            {enFaqs.map((faq) => (
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
                <h2 className="text-2xl font-bold">Ready to enjoy Disneyland Paris worry-free?</h2>
                <p className="mt-3 text-sm leading-6 text-gray-300">
                  Select your dates and times online, create your dog&apos;s profile, and book your cage-free stay in
                  minutes.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <LocaleBookingLink
                  href="/booking"
                  locale="en"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-gray-950 transition-colors hover:bg-orange-50"
                >
                  Check Availability &amp; Book
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </LocaleBookingLink>
                <Link
                  href={FR_PATH}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  🇫🇷 Version française
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <JsonLd data={getEnglishJsonLd()} />
    </div>
  );
}
