"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useSession } from "next-auth/react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useRef } from "react";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200 overflow-x-hidden font-sans">
      {/* Background Elements (Ambiance) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-orange-300/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-yellow-200/30 rounded-full blur-[120px]" />
      </div>

      {/* Navigation Flottante */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-lg shadow-orange-900/5 rounded-full px-6 py-3 flex items-center gap-6 max-w-4xl w-full justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-orange-400 to-amber-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-md group-hover:rotate-12 transition-transform">
              🐕
            </div>
            <span className="font-bold text-gray-800 tracking-tight">La Patte Dorée</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
            ) : session?.user ? (
              <>
                <Link 
                  href="/dashboard" 
                  className="hidden md:block text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors"
                >
                  Mon Espace
                </Link>
                <div className="h-4 w-px bg-gray-300 hidden md:block" />
                <SignOutButton />
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors">
                  Connexion
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-orange-600 transition-colors shadow-lg hover:shadow-orange-500/30"
                >
                  S'inscrire
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
            className="mb-6 inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 text-orange-700 text-sm font-medium shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Disponibilités ouvertes pour 2025
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] mb-6 tracking-tight"
          >
            La meilleure colo <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500 relative">
              pour votre chien.
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
            Une garde familiale, sans box ni cage. Juste de l'amour, des promenades
            et un canapé confortable. Partez l'esprit tranquille.
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
              <span>🐶</span> Réserver un séjour
            </Link>
            <Link
              href={session?.user ? "/dashboard" : "/auth/signup"}
              className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-100 rounded-2xl font-bold text-lg hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:scale-105 transition-all flex items-center justify-center"
            >
              Créer un compte
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

      {/* Bento Grid Services Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Services sur-mesure</h2>
          <p className="text-gray-500 text-lg">Tout ce qu'il faut pour son bonheur.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Hébergement (Large) */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-100 to-transparent rounded-full blur-3xl opacity-50 -mr-10 -mt-10" />
            <div className="flex-1 relative z-10">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-3xl mb-4">🏠</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Hébergement Familial</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Votre chien vit avec nous, dans la maison. Pas de box, accès jardin illimité et
                séances de câlins sur le canapé. C'est comme chez vous, en mieux.
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
                🐕
              </motion.div>
            </div>
          </motion.div>

          {/* Card 2: Promenade (Tall) */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-[2rem] p-8 shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mb-4 backdrop-blur-sm">🦮</div>
              <h3 className="text-2xl font-bold mb-2">Promenades</h3>
              <p className="text-gray-300 text-sm">
                Besoin de se dépenser ? Je viens chercher votre compagnon pour une balade active.
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-white/10">
              <p className="text-3xl font-bold">dès 15€</p>
              <p className="text-gray-400 text-sm">la balade</p>
            </div>
          </motion.div>

          {/* Card 3: Visite (Small) */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="bg-orange-50 rounded-[2rem] p-8 border border-orange-100 flex flex-col justify-center items-center text-center"
          >
            <div className="text-5xl mb-4 filter drop-shadow-lg">🐱</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Visites à domicile</h3>
            <p className="text-gray-600 text-sm">Pour les chats et les chiens indépendants.</p>
          </motion.div>

          {/* Card 4: Garde Jour (Wide) */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden"
          >
             <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-4xl flex-shrink-0">☀️</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">Garderie de Jour</h3>
                  <p className="text-gray-600">
                    Déposez-le le matin, récupérez-le le soir. Idéal pour vos journées de travail.
                    Socialisation et jeux garantis.
                  </p>
                </div>
             </div>
          </motion.div>
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
                🐺 Le Club La Meute
              </motion.span>
              <h2 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
                Gardez-le souvent,<br /> payez moins cher.
              </h2>
              <p className="text-orange-50 text-xl mb-10 leading-relaxed max-w-lg">
                Rejoignez notre abonnement par crédits et économisez jusqu'à <span className="font-bold border-b-2 border-white">20% sur chaque garde</span>. Simple, flexible et sans stress.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/concept">
                  <Button className="bg-white text-orange-600 hover:bg-orange-50 h-14 px-8 rounded-2xl font-bold text-lg shadow-xl">
                    Découvrir le concept
                  </Button>
                </Link>
                <Link href="/subscriptions">
                  <Button variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 h-14 px-8 rounded-2xl font-bold text-lg">
                    Voir les tarifs
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "🪙", title: "1 Crédit = 1 Jour", desc: "Utilisez vos crédits pour n'importe quelle prestation." },
                { icon: "🔄", title: "Reportable", desc: "Vos crédits non utilisés sont valables 2 mois." },
                { icon: "⚡", title: "Priorité", desc: "Les membres du club sont prioritaires sur les réservations." },
                { icon: "📉", title: "-20% Garanti", desc: "Le tarif le plus bas, toute l'année, même en vacances." }
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

      {/* Footer Minimaliste */}
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-bold text-gray-900">La Patte Dorée</span>
          </div>
          <p className="text-gray-500 text-sm">
            © 2025 - Fait avec ❤️ pour les chiens.
          </p>
        </div>
      </footer>
    </div>
  );
}