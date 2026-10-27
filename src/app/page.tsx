"use client";
import { LAST_MINUTE_DESCRIPTION } from "@/lib/pricing";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRef } from "react";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { LocationSection } from "@/components/home/LocationSection";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Award, Clock3, HeartPulse, MoonStar, ShieldCheck } from "lucide-react";
import { getServiceDisplayPrice, getServiceDisplayPriceForDuration, HOUSE_SITTING_DURATION_TIERS } from "@/lib/pricing";

export default function Home() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const boardingPrice = getServiceDisplayPrice("BOARDING");
  const houseSittingPrice = getServiceDisplayPrice("HOUSE_SITTING");
  const walkingPrice = getServiceDisplayPrice("DOG_WALKING");
  const dropInPrice = getServiceDisplayPrice("DROP_IN");
  const dropInTwoHourDogPrice = getServiceDisplayPriceForDuration("DROP_IN", "DOG", 120);
  const dropInTwoHourCatPrice = getServiceDisplayPriceForDuration("DROP_IN", "CAT", 120);
  const dayCarePrice = getServiceDisplayPrice("DAY_CARE");

  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200 overflow-x-hidden font-sans">

      {/* Hero Section */}
      <main>
      <section className="relative z-10 pt-32 pb-20 container mx-auto px-6" ref={ref}>
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-950 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <Award className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Garde familiale et suivi personnalisé
          </motion.div>

          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-700 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Bussy-Saint-Georges · Val d’Europe
          </motion.div>

          <motion.h1
            initial={{ y: 20 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] mb-6 tracking-tight"
          >
            Comme à la maison, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-amber-700 relative">
              même quand vous êtes loin.
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-orange-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ y: 20 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 mb-10 max-w-2xl leading-relaxed"
          >
            Hébergement familial sans box, visites à domicile et promenades,
            tout près de Disneyland Paris. Partez l&apos;esprit tranquille, on s&apos;occupe du reste.
          </motion.p>

          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link
              href="/booking"
              className="px-8 py-4 bg-orange-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/30 hover:bg-orange-800 hover:shadow-orange-500/50 hover:scale-105 hover:-rotate-1 transition-all flex items-center justify-center gap-2"
            >
              <span>🐾</span> Réserver un séjour
            </Link>
            <Link
              href={session?.user ? "/dashboard" : "/auth/signup"}
              className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-100 rounded-2xl font-bold text-lg hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:scale-105 transition-all flex items-center justify-center"
            >
              {session?.user ? "Accéder à mon espace" : "Créer un compte"}
            </Link>
          </motion.div>
        </div>

        {/* 3D Floating Elements (Decorative) */}
        <motion.div style={{ y }} className="absolute top-40 left-10 md:left-20 hidden lg:block pointer-events-none">
          <motion.div 
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} 
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="text-8xl filter drop-shadow-2xl opacity-80"
          >
            🎾
          </motion.div>
        </motion.div>
        <motion.div style={{ y }} className="absolute top-60 right-10 md:right-20 hidden lg:block pointer-events-none">
          <motion.div 
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }} 
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="text-8xl filter drop-shadow-2xl opacity-80"
          >
            🦴
          </motion.div>
        </motion.div>
        <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-gray-600 md:hidden">
          <Link href="#services" className="inline-flex min-h-11 items-center hover:text-orange-700">Services</Link>
          <Link href="/tarifs" className="inline-flex min-h-11 items-center hover:text-orange-700">Tarifs</Link>
          <Link href="#avis" className="inline-flex min-h-11 items-center hover:text-orange-700">Avis</Link>
          <Link href="#nous-trouver" className="inline-flex min-h-11 items-center hover:text-orange-700">Contact</Link>
        </div>
      </section>

      <section className="border-y border-emerald-900 bg-emerald-950 text-white">
        <div className="container mx-auto grid gap-8 px-6 py-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-3 text-emerald-200">
              <Award className="h-6 w-6" aria-hidden="true" />
              <span className="text-sm font-bold uppercase">Prise en charge personnalisée</span>
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">Des consignes précises pour chaque animal</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100">
              Le profil, la santé, les habitudes et les besoins de votre compagnon sont vérifiés avant toute confirmation de garde.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Qualification ACACED chien et chat</div>
            <div className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-emerald-300" /> Besoins individualisés</div>
            <div className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-emerald-300" /> Photos et nouvelles</div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Paiement sécurisé</div>
          </div>
        </div>
      </section>

      {/* Bento Grid Services Section */}
      <section id="services" className="container mx-auto scroll-mt-28 px-6 py-16 md:py-20">
        <div className="mb-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Services sur-mesure</h2>
              <p className="text-gray-500 text-lg">Tout ce qu&apos;il faut pour son bonheur.</p>
            </div>
            <Link href="/tarifs" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-100">
              Voir tous les tarifs et conditions
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Card 1: Hébergement (Large) */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-100 to-transparent rounded-full blur-3xl opacity-50 -mr-10 -mt-10" />
            <div className="flex-1 relative z-10">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-3xl mb-4">🏠</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Hébergement Familial</h3>
              <p data-no-translate className="mb-3 text-sm font-bold text-orange-700">
                {t("Chien")} {boardingPrice.dogPrice} € · {t("Chat")} {boardingPrice.catPrice} € / {t("période de 24 h")}
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                Votre compagnon est accueilli dans un cadre familial, sans box. Repos, jeux et attention au quotidien, dans le respect de ses habitudes.
              </p>
              <ul className="space-y-2">
                {["Un cadre familial", "Promenades incluses", "Photos et nouvelles"].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/3 aspect-square bg-orange-50 rounded-2xl flex items-center justify-center text-[8rem] shadow-inner relative group">
              <motion.div 
                animate={{ rotate: [0, 5, 0] }} 
                transition={{ duration: 4, repeat: Infinity }}
                className="filter drop-shadow-2xl"
              >
                🐾
              </motion.div>
            </div>
          </motion.div>

          {/* Card 2: Garde au domicile du client */}
          <motion.div
            whileHover={{ y: -5 }}
            className="md:col-span-2 bg-white rounded-[2rem] p-8 border border-emerald-100 shadow-xl shadow-emerald-100/60 relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[4rem] bg-emerald-50" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-3xl mb-4">🛋️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Garde à votre domicile</h3>
              <p data-no-translate className="mb-4 text-2xl font-bold text-emerald-700">{t("À partir de")} {Math.min(houseSittingPrice.dogPrice, houseSittingPrice.catPrice)} €</p>
              <div className="mb-4 space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm">
                {HOUSE_SITTING_DURATION_TIERS.map((tier) => (
                  <div key={tier.label} className="flex flex-col gap-1 border-b border-emerald-100 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <span data-no-translate className="font-semibold text-gray-800">{t(tier.label)}</span>
                    <span data-no-translate className="text-emerald-800">{t("Chien")} {tier.prices.DOG} € · {t("Chat")} {tier.prices.CAT} €</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-600 leading-relaxed">
                Une présence prolongée chez vous : repas, sorties, compagnie, surveillance et respect de la routine habituelle de votre animal.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Promenade (Tall) */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-[2rem] p-8 shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mb-4 backdrop-blur-sm">🐾</div>
              <h3 className="text-2xl font-bold mb-2">Promenades</h3>
              <p className="text-gray-300 text-sm">
                Besoin de se dépenser ? Je viens chercher votre compagnon pour une balade active.
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-white/10">
              <p data-no-translate className="text-3xl font-bold">{t("À partir de")} {walkingPrice.dogPrice} €</p>
              <p data-no-translate className="text-gray-400 text-sm">{t("Chien")} · {walkingPrice.durationMinutes || 30} {t("minutes")}</p>
              <p data-no-translate className="text-gray-400 text-sm">{t("Chat : sur demande")}</p>
            </div>
          </motion.div>

          {/* Card 3: Visite (Small) */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="bg-orange-50 rounded-[2rem] p-8 border border-orange-100 flex flex-col justify-center items-center text-center"
          >
            <div className="text-5xl mb-4 filter drop-shadow-lg">🐱</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Visites à domicile</h3>
            <p data-no-translate className="mb-2 text-sm font-bold text-orange-700">{t("Chien")} {dropInPrice.dogPrice} € · {t("Chat")} {dropInPrice.catPrice} € / {dropInPrice.durationMinutes || 30} min</p>
            <p data-no-translate className="mb-2 text-xs font-bold text-gray-700">
              2 h : {t("chien")} {dropInTwoHourDogPrice} € · {t("chat")} {dropInTwoHourCatPrice} €
            </p>
            <p className="text-gray-600 text-sm">Un passage ponctuel chez vous pour les repas, la litière, les soins simples, les sorties et un moment de présence.</p>
          </motion.div>

          {/* Card 4: Garde Jour (Wide) */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden"
          >
             <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-4xl flex-shrink-0">☀️</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">Garderie de jour au domicile du pet-sitter</h3>
                  <p data-no-translate className="mb-2 text-sm font-bold text-orange-700">
                    {t("Chien")} {dayCarePrice.dogPrice} € · {t("Chat")} {dayCarePrice.catPrice} € / {t("garde de jour jusqu’à 10 h")}
                  </p>
                  <p className="text-gray-600">
                    Déposez votre compagnon le matin et récupérez-le le soir. Repas, jeux, repos et promenades selon ses habitudes.
                  </p>
                  <p className="mt-2 text-xs text-gray-500">Prestation soumise à disponibilité et à compatibilité avec les animaux déjà présents.</p>
                </div>
             </div>
          </motion.div>
        </div>

        <div data-no-translate className="mt-8 overflow-hidden rounded-[2rem] border border-orange-200 bg-white shadow-xl shadow-orange-900/5">
          <div className="grid md:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-gradient-to-br from-orange-800 to-amber-900 p-7 text-white sm:p-8">
              <p className="text-sm font-extrabold uppercase tracking-wide text-orange-100">{t("Garde de chien")}</p>
              <h3 className="mt-2 text-2xl font-extrabold sm:text-3xl">{t("Un tarif calculé sur la durée réelle")}</h3>
              <p className="mt-3 text-sm leading-6 text-orange-50">
                {t("Le compteur commence au moment du dépôt et s’arrête à la reprise. Le changement de date à minuit ne déclenche jamais une nouvelle facturation.")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                  <Clock3 className="h-5 w-5 text-orange-100" aria-hidden="true" />
                  <p data-no-translate className="mt-3 text-2xl font-extrabold">{dayCarePrice.dogPrice} €</p>
                  <p className="mt-1 text-sm font-semibold">{t("Garde de jour, jusqu’à 10 h")}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                  <MoonStar className="h-5 w-5 text-orange-100" aria-hidden="true" />
                  <p data-no-translate className="mt-3 text-2xl font-extrabold">{boardingPrice.dogPrice} €</p>
                  <p className="mt-1 text-sm font-semibold">{t("Période de 24 h, avec nuit")}</p>
                </div>
              </div>
              <p className="mt-4 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold leading-6 text-white backdrop-blur-sm">
                {t("Chiot de moins d’un an : supplément de 5 € par garde de jour ou par période de 24 h commencée.")}
              </p>
            </div>

            <div className="p-7 sm:p-8">
              <h4 className="text-lg font-extrabold text-gray-950">{t("Comment sont comptés les dépassements ?")}</h4>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {t("Dès qu’une période de 24 h est dépassée, même de quelques minutes, une nouvelle période commence. Les durées intermédiaires restent ainsi simples et prévisibles.")}
              </p>
              <div className="mt-5 space-y-3">
                <div className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-gray-800">{t("Vendredi 18 h → samedi 18 h")}</span>
                  <span data-no-translate className="shrink-0 text-lg font-extrabold text-emerald-800">{boardingPrice.dogPrice} €</span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-gray-800">{t("10 h 01 à 24 h de garde")}</span>
                  <span data-no-translate className="shrink-0 text-lg font-extrabold text-emerald-800">{boardingPrice.dogPrice} €</span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-gray-800">{t("Vendredi 18 h → dimanche 18 h")}</span>
                  <span data-no-translate className="shrink-0 text-lg font-extrabold text-emerald-800">{boardingPrice.dogPrice * 2} €</span>
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-5 text-gray-500">
                {t("Exemple de dépassement : samedi 18 h 01 démarre une deuxième période de 24 h.")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-2 border-t border-gray-200 pt-5 text-xs leading-5 text-gray-500">
          <p>Les horaires exacts doivent être indiqués lors de la réservation. Les frais exceptionnels nécessaires à la prestation, notamment le parking, les péages ou les transports, sont facturés en supplément après accord préalable.</p>
          <p>{LAST_MINUTE_DESCRIPTION}</p>
          <p>Chaque animal est facturé au tarif complet correspondant à son espèce et au service choisi. Pour les visites et promenades partagées, le supplément de durée n’est compté qu’une seule fois.</p>
          <p><Link href="/tarifs" className="font-bold text-orange-700 underline underline-offset-4">Consulter la grille complète, les remises et les conditions d’annulation.</Link></p>
        </div>
      </section>

      {/* Subscription Teaser Section */}
      <section className="container mx-auto px-6 pb-16 md:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-orange-700 to-amber-800 rounded-3xl p-6 sm:p-10 md:p-14 text-white relative overflow-hidden shadow-xl"
        >
          {/* Decorative Circles */}
          <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-white/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-yellow-400/20 rounded-full blur-[60px]" />

          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="inline-block bg-white/20 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6"
              >
                Premium La Patte Dorée
              </motion.span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                Plus d&apos;avantages,<br /> plus de Pattes.
              </h2>
              <p className="text-orange-50 text-xl mb-10 leading-relaxed max-w-lg">
                Activez Premium pour obtenir <span className="font-bold border-b-2 border-white">-10% jusqu’à 20 € par réservation</span>, des Pattes doublées et une priorité pendant les vacances.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/concept" className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-6 py-3 text-base font-bold text-orange-800 transition-colors hover:bg-orange-50">
                  Découvrir le concept
                </Link>
                <Link href="/subscriptions" className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/50 px-6 py-3 text-base font-bold text-white transition-colors hover:bg-white/10">
                  Voir Premium
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: "🐾", title: "Pattes doublées", desc: "1 euro dépensé rapporte 2 Pattes avec Premium." },
                { icon: "📉", title: "-10% plafonné", desc: "Jusqu’à 20 € par réservation, sans cumul avec une autre remise." },
                { icon: "🏅", title: "Badge Premium", desc: "Votre statut est visible dans votre espace client." },
                { icon: "📅", title: "Priorité vacances", desc: "Vos demandes sont priorisées sur les périodes chargées." }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 shadow-inner"
                >
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3 className="font-bold text-lg mb-1">{feature.title}</h3>
                  <p className="text-orange-100 text-xs leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Reviews Section - Dynamic */}
      <ReviewsSection />
      <LocationSection />

      {/* CTA Section */}
      <section className="container mx-auto px-6 pb-32">
        <div className="bg-gray-900 rounded-3xl px-6 py-12 sm:p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-gray-900" />
          </div>
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Rejoignez la famille.
            </h2>
            <p className="text-gray-400 text-xl mb-10">
              Créez votre compte gratuitement, renseignez les besoins de votre compagnon et envoyez votre demande. Chaque garde est confirmée après vérification des disponibilités.
            </p>
            <div>
              <Link
                href={session?.user ? "/dashboard" : "/auth/signup"}
                className="inline-block bg-orange-700 text-white px-8 py-5 rounded-full font-bold text-lg shadow-lg hover:bg-orange-800 transition-all"
              >
                {session?.user ? "Accéder à mon espace" : "Créer mon compte"}
              </Link>
            </div>
          </div>
        </div>
      </section>
      </main>
    </div>
  );
}
