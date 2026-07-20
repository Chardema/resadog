"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRef } from "react";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Award, HeartPulse, ShieldCheck, TicketPercent } from "lucide-react";
import { getServiceDisplayPrice, getServiceDisplayPriceForDuration, HOUSE_SITTING_DURATION_TIERS } from "@/lib/pricing";

export default function Home() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const isLoading = status === "loading";
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
  const canAccessAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SITTER";

  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200 overflow-x-hidden font-sans">
      <motion.nav
        initial={false}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 md:top-6"
      >
        <div className="flex w-full max-w-5xl items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg shadow-orange-900/5 backdrop-blur-xl sm:rounded-full sm:px-6 sm:py-3">
          <Link href="/" className="group flex min-w-0 items-center gap-2">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-orange-100 bg-[#FDFBF7] shadow-md transition-transform group-hover:rotate-6 sm:rounded-full">
              <Image
                src="/logo-mark.png"
                width={40}
                height={40}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <span className="truncate font-bold tracking-tight text-gray-800">La Patte Dorée</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-gray-100" />
            ) : session?.user ? (
              <>
                {canAccessAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="rounded-md border border-gray-200 px-2 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 sm:rounded-full sm:px-3"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-orange-600 hover:shadow-orange-500/30 sm:rounded-full sm:px-5"
                >
                  Mon espace
                </Link>
                <div className="home-signout-desktop">
                  <SignOutButton />
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-sm font-semibold text-gray-600 transition-colors hover:text-orange-600">
                  Connexion
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-orange-600 hover:shadow-orange-500/30 sm:rounded-full sm:px-5"
                >
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-32 pb-20 container mx-auto px-6" ref={ref}>
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-950 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <Award className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Professionnelle titulaire de l’ACACED
          </motion.div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-700 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Disponibilités ouvertes pour 2026
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] mb-6 tracking-tight"
          >
            Comme à la maison, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500 relative">
              même quand vous êtes loin.
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-orange-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 mb-10 max-w-2xl leading-relaxed"
          >
            Hébergement familial sans box, visites à domicile et promenades,
            tout près de Disneyland Paris. Partez l&apos;esprit tranquille, on s&apos;occupe du reste.
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link
              href="/booking"
              className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 hover:-rotate-1 transition-all flex items-center justify-center gap-2"
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
      </main>

      <section className="container mx-auto -mt-8 px-6 pb-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6 text-center shadow-lg shadow-orange-900/5 md:flex-row md:text-left">
          <div className="flex flex-col items-center gap-4 md:flex-row">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-500/25">
              <TicketPercent className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-orange-700">Offre de bienvenue</p>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">-10 % sur votre première réservation</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Réservée aux 5 premiers nouveaux clients · code <strong>BIENVENUE10</strong> · cumulable avec Premium.
              </p>
            </div>
          </div>
          <Link
            href="/booking"
            className="shrink-0 rounded-2xl bg-gray-900 px-6 py-3 font-bold text-white transition-colors hover:bg-orange-600"
          >
            J&apos;en profite
          </Link>
        </div>
      </section>

      <section className="border-y border-emerald-900 bg-emerald-950 text-white">
        <div className="container mx-auto grid gap-8 px-6 py-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-3 text-emerald-200">
              <Award className="h-6 w-6" aria-hidden="true" />
              <span className="text-sm font-bold uppercase">Compétence professionnelle</span>
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">Garde encadrée par une titulaire de l’ACACED</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100">
              Une prise en charge fondée sur la connaissance des besoins biologiques, physiologiques et comportementaux des chiens et des chats.
            </p>
            {process.env.NEXT_PUBLIC_ACACED_NUMBER && (
              <p className="mt-2 text-xs text-emerald-300">Attestation n° {process.env.NEXT_PUBLIC_ACACED_NUMBER}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /> ACACED</div>
            <div className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-emerald-300" /> Besoins individualisés</div>
            <div className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-emerald-300" /> Photos et nouvelles</div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Paiement sécurisé</div>
          </div>
        </div>
      </section>

      {/* Bento Grid Services Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Services sur-mesure</h2>
          <p className="text-gray-500 text-lg">Tout ce qu&apos;il faut pour son bonheur.</p>
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
              <p data-no-translate className="mb-3 text-sm font-bold text-orange-700">{t("Chien")} {boardingPrice.dogPrice}€ · {t("Chat")} {boardingPrice.catPrice}€ / {t("nuit")}</p>
              <p className="text-gray-600 leading-relaxed mb-6">
                Votre compagnon vit avec nous, dans la maison. Pas de box, accès jardin illimité et
                séances de câlins sur le canapé. C&apos;est comme chez vous, en mieux.
              </p>
              <ul className="space-y-2">
                {["Vie de famille 24/7", "Promenades incluses", "Photos tous les jours"].map(item => (
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
              <p data-no-translate className="mb-4 text-2xl font-bold text-emerald-700">{t("À partir de")} {houseSittingPrice.dogPrice} €</p>
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
              {t("Jusqu'à 2 h")} : {t("chien")} {dropInTwoHourDogPrice} € · {t("chat")} {dropInTwoHourCatPrice} €
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
                  <p data-no-translate className="mb-2 text-sm font-bold text-orange-700">{t("Chien")} {dayCarePrice.dogPrice} € · {t("Chat")} {dayCarePrice.catPrice} € / {t("jour")}</p>
                  <p className="text-gray-600">
                    Déposez votre compagnon le matin et récupérez-le le soir. Repas, jeux, repos et promenades selon ses habitudes.
                  </p>
                  <p className="mt-2 text-xs text-gray-500">Prestation soumise à disponibilité et à compatibilité avec les animaux déjà présents.</p>
                </div>
             </div>
          </motion.div>
        </div>

        <div className="mt-8 space-y-2 border-t border-gray-200 pt-5 text-xs leading-5 text-gray-500">
          <p>Les horaires exacts doivent être indiqués lors de la réservation. Les frais exceptionnels nécessaires à la prestation, notamment le parking, les péages ou les transports, sont facturés en supplément après accord préalable.</p>
          <p>Un supplément peut être appliqué les jours fériés et pour les demandes de dernière minute.</p>
        </div>
      </section>

      {/* Subscription Teaser Section */}
      <section className="container mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-[3rem] p-10 md:p-20 text-white relative overflow-hidden shadow-2xl"
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
              <h2 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
                Plus d&apos;avantages,<br /> plus de Pattes.
              </h2>
              <p className="text-orange-50 text-xl mb-10 leading-relaxed max-w-lg">
                Activez Premium pour obtenir <span className="font-bold border-b-2 border-white">-10% sur chaque réservation</span>, des Pattes doublées et une priorité pendant les vacances.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/concept">
                  <Button className="bg-white text-orange-600 hover:bg-orange-50 h-14 px-8 rounded-2xl font-bold text-lg shadow-xl">
                    Découvrir le concept
                  </Button>
                </Link>
                <Link href="/subscriptions">
                  <Button variant="outline" className="bg-white/20 text-white border border-white/40 hover:bg-white/30 h-14 px-8 rounded-2xl font-bold text-lg backdrop-blur-sm">
                    Voir Premium
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "🐾", title: "Pattes doublées", desc: "1 euro dépensé rapporte 2 Pattes avec Premium." },
                { icon: "📉", title: "-10% immédiat", desc: "La remise s'applique automatiquement sur les réservations." },
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
                  <h4 className="font-bold text-lg mb-1">{feature.title}</h4>
                  <p className="text-orange-100 text-xs leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Reviews Section - Dynamic */}
      <ReviewsSection />

      {/* CTA Section */}
      <section className="container mx-auto px-6 pb-32">
        <div className="bg-gray-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-gray-900" />
          </div>
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Rejoignez la famille.
            </h2>
            <p className="text-gray-400 text-xl mb-10">
              Créez votre compte gratuitement et réservez votre première garde en moins de 2 minutes.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href={session?.user ? "/dashboard" : "/auth/signup"}
                className="inline-block bg-orange-500 text-white px-10 py-5 rounded-full font-bold text-lg shadow-lg hover:bg-orange-400 transition-all"
              >
                {session?.user ? "Accéder à mon espace" : "Créer mon compte"}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}
