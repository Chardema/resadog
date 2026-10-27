"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { LocationSection } from "@/components/home/LocationSection";
import {
  ArrowRight,
  Award,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  Footprints,
  Gift,
  HeartPulse,
  Home as HomeIcon,
  MapPin,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
} from "lucide-react";
import { getServiceDisplayPrice } from "@/lib/pricing";
import type { PublicGooglePlaceSummary, SerializedReview } from "@/lib/public-reviews";

// Définir le chemin vers "/images/hero-famille.webp" dès que la photo est disponible
const HERO_PHOTO_SRC: string | null = null; // "/images/hero-famille.webp"

interface HomePageClientProps {
  initialReviews: SerializedReview[];
  initialGooglePlace: PublicGooglePlaceSummary | null;
}

export function HomePageClient({
  initialReviews,
  initialGooglePlace,
}: HomePageClientProps) {
  const { data: session } = useSession();
  const boardingPrice = getServiceDisplayPrice("BOARDING");
  const dayCarePrice = getServiceDisplayPrice("DAY_CARE");

  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200 overflow-x-hidden font-sans">
      {/* Hero Section */}
      <main>
        <section className="relative z-10 pt-28 md:pt-32 pb-12 md:pb-16 container mx-auto px-6">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            {/* Colonne gauche */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-orange-800 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  <MapPin className="h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" />
                  <span>Bussy-Saint-Georges · Val d’Europe · Disneyland Paris</span>
                </div>

                <Link
                  href="#avis"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-bold text-gray-800 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/60"
                >
                  <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    ))}
                  </span>
                  <span>
                    <span data-no-translate>5,0/5</span> · Avis vérifiés
                  </span>
                </Link>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1] mb-6 tracking-tight">
                Garde familiale de chiens &amp; chats près de Disneyland Paris,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-amber-700 relative inline-block">
                  comme à la maison.
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-orange-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                  </svg>
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl leading-relaxed">
                Hébergement familial <strong className="font-semibold text-gray-800">100 % sans box ni cage</strong>, garderie de jour, visites à domicile et promenades en Seine-et-Marne (77). Partez l’esprit tranquille avec des photos et nouvelles chaque jour.
              </p>

              <div className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto">
                <Link
                  href="/booking"
                  className="px-7 py-4 bg-orange-700 text-white rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-orange-600/25 hover:bg-orange-800 transition-all inline-flex items-center justify-center gap-2"
                >
                  <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                  Vérifier mes dates &amp; simuler mon tarif
                </Link>
                <Link
                  href={session?.user ? "/dashboard" : "#services"}
                  className="px-7 py-4 bg-white text-gray-800 border-2 border-gray-200 rounded-2xl font-bold text-base sm:text-lg hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 transition-all inline-flex items-center justify-center"
                >
                  {session?.user ? "Accéder à mon espace" : "Découvrir les services & tarifs"}
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-medium text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  Tarif calculé à la durée réelle
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  Consignes santé &amp; habitudes vérifiées avant chaque garde
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-gray-600 md:hidden">
                <Link href="#services" className="inline-flex min-h-11 items-center hover:text-orange-700">Services</Link>
                <Link href="/tarifs" className="inline-flex min-h-11 items-center hover:text-orange-700">Tarifs</Link>
                <Link href="#avis" className="inline-flex min-h-11 items-center hover:text-orange-700">Avis</Link>
                <Link href="#nous-trouver" className="inline-flex min-h-11 items-center hover:text-orange-700">Contact</Link>
              </div>
            </div>

            {/* Colonne droite */}
            <div className="rounded-[2rem] border border-orange-200/80 bg-gradient-to-br from-orange-50 via-[#FDFBF7] to-amber-50/70 p-6 sm:p-8 shadow-2xl shadow-orange-950/10">
              {HERO_PHOTO_SRC && (
                <div className="mb-5 overflow-hidden rounded-2xl border border-orange-100">
                  <Image
                    src={HERO_PHOTO_SRC}
                    alt="Garde familiale de chiens et chats chez La Patte Dorée"
                    width={640}
                    height={420}
                    className="h-56 w-full object-cover"
                    priority
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-700 text-white shadow-md shadow-orange-700/20">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Cadre 100 % familial</p>
                    <p className="text-xs font-medium text-gray-600">Maison &amp; suivi personnalisé</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-orange-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-orange-800 shadow-sm">
                  Dès <span data-no-translate>{dayCarePrice.dogPrice} €</span>
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-white/90 p-4 rounded-2xl border border-orange-100 flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                    <HomeIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Zéro box, zéro cage</p>
                    <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-gray-600">
                      Votre compagnon vit avec nous dans la maison, à son rythme, avec sorties et moments de jeu adaptés.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-2xl border border-orange-100 flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Photos &amp; nouvelles quotidiennes</p>
                    <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-gray-600">
                      Vous suivez son séjour chaque jour pendant votre visite à Disneyland Paris ou vos vacances.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-2xl border border-orange-100 flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Titulaire ACACED Chien &amp; Chat</p>
                    <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-gray-600">
                      Certificat officiel de capacité, vérification du carnet de santé et respect strict des consignes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-emerald-950 px-4 py-3 rounded-2xl text-white flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-emerald-100">
                  <HeartPulse className="h-4 w-4 text-emerald-300 shrink-0" aria-hidden="true" />
                  Bussy-Saint-Georges · à 10 min des parcs Disney
                </span>
                <Link href="#avis" className="font-bold text-amber-300 hover:text-amber-200 transition-colors">
                  Lire les avis →
                </Link>
              </div>
            </div>
          </div>

          {/* Barre des 4 piliers de réassurance */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="flex items-center gap-3.5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Qualifié ACACED</p>
                <p className="text-xs text-gray-500">Chien &amp; chat certifié</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                <HomeIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">100 % sans box</p>
                <p className="text-xs text-gray-500">Cadre familial calme</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                <Camera className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Suivi quotidien</p>
                <p className="text-xs text-gray-500">Photos &amp; nouvelles</p>
              </div>
            </div>

            <Link
              href="#avis"
              className="flex items-center gap-3.5 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Note 5,0 / 5</p>
                <p className="text-xs font-semibold text-orange-700">Voir les avis clients →</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Services & Tarifs (Chantier 3 : grille 2+3 allégée + bandeau synthétique unique) */}
        <section id="services" className="container mx-auto scroll-mt-28 px-6 py-16 md:py-20">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-orange-800">
                Nos prestations &amp; tarifs
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Services sur-mesure
              </h2>
              <p className="text-gray-600 text-base sm:text-lg">
                Une garde familiale attentive, sans box ni chenil. Choisissez un service pour simuler votre tarif exact selon vos dates et horaires.
              </p>
            </div>
            <Link
              href="/tarifs"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-100"
            >
              Voir tous les tarifs et conditions
            </Link>
          </div>

          {/* Ligne 1 : 2 grandes cartes — Chez nous à Bussy-Saint-Georges */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Carte 1 : Hébergement familial (24 h) */}
            <article className="flex flex-col justify-between rounded-3xl border border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/40 p-6 sm:p-8 shadow-sm transition-shadow hover:shadow-md">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100/90 px-3 py-1 text-xs font-bold text-orange-900">
                    <HomeIcon className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />
                    <span>Chez nous · Nuit incluse</span>
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                    -10 % dès 14 périodes
                  </span>
                </div>

                <h3 className="mt-4 text-2xl font-extrabold text-gray-900">
                  Hébergement familial (24 h)
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Votre compagnon vit à la maison avec nous et profite du jardin clos, des sorties et d’une présence rassurante jour et nuit, avec photos chaque jour.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-orange-100 bg-white p-3.5">
                    <p className="text-xs font-semibold text-gray-500">🐕 Chien</p>
                    <p className="mt-1 text-xl font-extrabold text-gray-900">
                      <span data-no-translate>{boardingPrice.dogPrice} €</span>
                      <span className="text-xs font-medium text-gray-500"> / 24 h</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-white p-3.5">
                    <p className="text-xs font-semibold text-gray-500">🐈 Chat</p>
                    <p className="mt-1 text-xl font-extrabold text-gray-900">
                      <span data-no-translate>{boardingPrice.catPrice} €</span>
                      <span className="text-xs font-medium text-gray-500"> / 24 h</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-orange-100/80 pt-4">
                <span className="text-xs text-gray-500">Compteur 24 h dès l’heure de dépôt</span>
                <Link
                  href="/booking?service=BOARDING"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-800"
                >
                  <span>Simuler un séjour →</span>
                </Link>
              </div>
            </article>

            {/* Carte 2 : Garderie de jour */}
            <article className="flex flex-col justify-between rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 p-6 sm:p-8 shadow-sm transition-shadow hover:shadow-md">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-3 py-1 text-xs font-bold text-amber-900">
                    <Sun className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                    <span>Chez nous · Journée jusqu’à 10 h</span>
                  </span>
                  <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800">
                    Idéal journée Disneyland Paris
                  </span>
                </div>

                <h3 className="mt-4 text-2xl font-extrabold text-gray-900">
                  Garderie de jour
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Accueil dès 6h30 à 10 minutes des parcs Disney : jeux au jardin, repos au calme et compagnie continue jusqu’à 10 h de garde en journée.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-amber-100 bg-white p-3.5">
                    <p className="text-xs font-semibold text-gray-500">🐕 Chien</p>
                    <p className="mt-1 text-xl font-extrabold text-gray-900">
                      <span data-no-translate>{dayCarePrice.dogPrice} €</span>
                      <span className="text-xs font-medium text-gray-500"> / jour</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-white p-3.5">
                    <p className="text-xs font-semibold text-gray-500">🐈 Chat</p>
                    <p className="mt-1 text-xl font-extrabold text-gray-900">
                      <span data-no-translate>{dayCarePrice.catPrice} €</span>
                      <span className="text-xs font-medium text-gray-500"> / jour</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-amber-100/80 pt-4">
                <span className="text-xs text-gray-500">Dépose dès 6h30 · Retour jusqu’à 20h30</span>
                <Link
                  href="/booking?service=DAY_CARE"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  <span>Réserver une journée →</span>
                </Link>
              </div>
            </article>
          </div>

          {/* Ligne 2 : 3 cartes compactes — À votre domicile */}
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {/* Carte 3 : Garde à votre domicile */}
            <article className="flex flex-col justify-between rounded-3xl border border-gray-200/90 bg-white p-6 shadow-sm transition-colors hover:border-orange-200">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-800">
                    Chez vous · Présence prolongée
                  </span>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-extrabold text-emerald-900">
                    Dès 40 € / jour
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-gray-900">
                  Garde à votre domicile
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">
                  Nous veillons sur vos animaux directement chez vous pour préserver toutes leurs habitudes (paliers jusqu’à 6 h, 10 h ou +10 h).
                </p>
              </div>
              <div className="mt-5 border-t border-orange-100 pt-3.5">
                <Link
                  href="/booking?service=HOUSE_SITTING"
                  className="inline-flex items-center text-sm font-bold text-orange-800 hover:text-orange-600"
                >
                  <span>Choisir mes horaires →</span>
                </Link>
              </div>
            </article>

            {/* Carte 4 : Visites à domicile */}
            <article className="flex flex-col justify-between rounded-3xl border border-gray-200/90 bg-white p-6 shadow-sm transition-colors hover:border-orange-200">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-orange-800">
                    Chez vous · 30 min à 2 h
                  </span>
                  <span className="rounded-full bg-orange-50 border border-orange-200/80 px-2.5 py-1 text-xs font-extrabold text-orange-900">
                    Chien 16 € · Chat 15 €
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-gray-900">
                  Visites à domicile
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">
                  Repas, eau fraîche, litière, câlins et nouvelles en photo à chaque passage (2 chats inclus au tarif de base).
                </p>
              </div>
              <div className="mt-5 border-t border-orange-100 pt-3.5">
                <Link
                  href="/booking?service=DROP_IN"
                  className="inline-flex items-center text-sm font-bold text-orange-800 hover:text-orange-600"
                >
                  <span>Composer mes visites →</span>
                </Link>
              </div>
            </article>

            {/* Carte 5 : Promenades chien */}
            <article className="flex flex-col justify-between rounded-3xl border border-gray-200/90 bg-white p-6 shadow-sm transition-colors hover:border-orange-200">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                    <Footprints className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                    <span>Autour de chez vous · 30 min à 2 h</span>
                  </span>
                  <span className="rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs font-extrabold text-amber-900">
                    Dès 15 € / 30 min
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-gray-900">
                  Promenades chien
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">
                  Balade attentive au rythme de votre chien autour de votre domicile, avec compte-rendu et photo au retour.
                </p>
              </div>
              <div className="mt-5 border-t border-orange-100 pt-3.5">
                <Link
                  href="/booking?service=DOG_WALKING"
                  className="inline-flex items-center text-sm font-bold text-orange-800 hover:text-orange-600"
                >
                  <span>Planifier une balade →</span>
                </Link>
              </div>
            </article>
          </div>

          {/* Bandeau synthétique unique en pied de #services */}
          <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-orange-200/80 bg-white p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
                <Check className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm leading-6 text-gray-700">
                {"Tarif calculé à la durée réelle : le compteur démarre à l’heure de dépôt (aucune double facturation au passage de minuit). Supplément chiot/chaton (< 1 an) : +5 €."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/tarifs"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 transition-colors hover:bg-orange-50"
              >
                Détail des tarifs &amp; remises
              </Link>
              <Link
                href="/booking"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-800"
              >
                Simuler mon prix
              </Link>
            </div>
          </div>
        </section>

        {/* Reviews Section - Dynamic + SSR preloaded */}
        <ReviewsSection
          initialReviews={initialReviews}
          initialGooglePlace={initialGooglePlace}
        />

        {/* Location Section + Maillage SEO local */}
        <LocationSection />

        {/* Section Fidélité & Avantages Premium condensée (placée après la preuve sociale) */}
        <section className="container mx-auto px-6 py-12 md:py-16">
          <div className="rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/70 to-white p-6 sm:p-10 border border-orange-200/70 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-orange-800 font-bold text-xs uppercase tracking-wider mb-3 shadow-sm">
                  <Award className="h-3.5 w-3.5 text-orange-600" aria-hidden="true" />
                  <span>Fidélité &amp; Avantages Premium</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  Chaque séjour récompense votre fidélité
                </h2>
                <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed">
                  Gagnez gratuitement 1 Patte par euro dépensé dès votre première garde (jusqu’à 24 € de remise fidélité). Besoin de gardes régulières ? L’abonnement Premium offre -10 % jusqu’à 20 € par réservation, les Pattes doublées et la priorité vacances.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/concept"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-orange-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-900 transition-colors hover:bg-orange-50"
                  >
                    Découvrir le programme Pattes
                  </Link>
                  <Link
                    href="/subscriptions"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-amber-300" aria-hidden="true" />
                    <span>Voir les avantages Premium</span>
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4 border border-orange-100 shadow-sm">
                  <Gift className="h-5 w-5 text-emerald-600 mb-1.5" aria-hidden="true" />
                  <p className="text-sm font-extrabold text-gray-900">-10 % Bienvenue</p>
                  <p className="text-xs text-gray-600 mt-0.5">Code BIENVENUE10 sur votre 1re réservation</p>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-orange-100 shadow-sm">
                  <PawPrint className="h-5 w-5 text-orange-600 mb-1.5" aria-hidden="true" />
                  <p className="text-sm font-extrabold text-gray-900">1 € = 1 Patte</p>
                  <p className="text-xs text-gray-600 mt-0.5">Jusqu’à 24 € de remise fidélité cumulable</p>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-orange-100 shadow-sm">
                  <Sparkles className="h-5 w-5 text-amber-500 mb-1.5" aria-hidden="true" />
                  <p className="text-sm font-extrabold text-gray-900">Premium -10 %</p>
                  <p className="text-xs text-gray-600 mt-0.5">Jusqu’à 20 € de remise par réservation</p>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-orange-100 shadow-sm">
                  <ShieldCheck className="h-5 w-5 text-blue-600 mb-1.5" aria-hidden="true" />
                  <p className="text-sm font-extrabold text-gray-900">Priorité vacances</p>
                  <p className="text-xs text-gray-600 mt-0.5">Pattes doublées &amp; accès prioritaire aux périodes fortes</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 pb-32">
          <div className="bg-gray-900 rounded-3xl px-6 py-12 sm:p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-gray-900" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Prêt à planifier le séjour de votre compagnon ?
              </h2>
              <p className="text-gray-300 text-lg sm:text-xl mb-10 leading-relaxed">
                Vérifiez nos disponibilités en temps réel et simulez votre tarif exact selon vos horaires en moins d&apos;une minute, avant même de créer votre compte.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/booking"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-orange-700 text-white px-8 py-4 rounded-full font-bold text-base sm:text-lg shadow-lg hover:bg-orange-800 transition-all"
                >
                  Vérifier les disponibilités &amp; tarifs
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href={session?.user ? "/dashboard" : "/tarifs"}
                  className="w-full sm:w-auto inline-flex items-center justify-center bg-white/10 text-white border border-white/20 px-7 py-4 rounded-full font-bold text-base sm:text-lg hover:bg-white/20 transition-all"
                >
                  {session?.user ? "Accéder à mon espace" : "Voir la grille tarifaire"}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
