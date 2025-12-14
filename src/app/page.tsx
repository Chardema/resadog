"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-6 py-6 relative z-10"
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg transform rotate-12">
                🐾
              </div>
              <div className="absolute -top-1 -right-1 text-yellow-400 text-xl animate-pulse">
                ✨
              </div>
            </motion.div>
            <div>
              <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                La Patte Dorée
              </span>
              <p className="text-xs text-orange-600 font-medium">Garde de chiens de luxe</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="h-10 w-32 bg-orange-200/50 rounded-full animate-pulse"></div>
            ) : session?.user ? (
              <>
                <span className="text-sm font-medium text-gray-700">
                  Bonjour, <span className="font-semibold text-orange-700">{session.user.name}</span>
                </span>
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    href="/dashboard"
                    className="inline-block bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg font-semibold transition-all shadow-md"
                  >
                    Mon Dashboard
                  </Link>
                </motion.div>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
                >
                  Connexion
                </Link>
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    href="/auth/signup"
                    className="inline-block bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg font-semibold transition-all shadow-md"
                  >
                    S'inscrire
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section avec effet 3D */}
      <section className="container mx-auto px-6 pt-20 pb-32 relative">
        {/* Décorations de fond */}
        <div className="absolute top-20 left-10 text-6xl opacity-10 animate-bounce">🐕</div>
        <div className="absolute bottom-20 right-10 text-6xl opacity-10 animate-bounce" style={{ animationDelay: "0.5s" }}>🦴</div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-8"
          >
            <div className="inline-block p-8 bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl transform hover:scale-105 transition-transform duration-300">
              <div className="text-8xl mb-4 animate-pulse">🐾✨</div>
              <h1 className="text-6xl md:text-7xl font-bold mb-4 leading-tight">
                <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                  La Patte Dorée
                </span>
              </h1>
              <p className="text-xl text-orange-700 font-semibold">
                Garde de chiens premium • Suivi VIP • Tranquillité garantie
              </p>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-xl text-gray-700 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            🌟 Service <span className="font-bold text-orange-600">haut de gamme</span> de garde de chiens avec suivi en temps réel,
            photos quotidiennes et communication directe. Offrez à votre compagnon
            l'attention qu'il mérite.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-6 justify-center"
          >
            <motion.div
              whileHover={{ scale: 1.08, y: -5, rotateY: -5 }}
              whileTap={{ scale: 0.95 }}
              className="perspective-1000"
            >
              <Link
                href="/booking"
                className="inline-block bg-white text-orange-600 px-10 py-5 rounded-2xl hover:shadow-2xl font-bold text-lg transition-all border-3 border-orange-300 shadow-lg transform hover:-rotate-1"
              >
                ⭐ Réserver maintenant
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section avec cartes 3D */}
      <section className="container mx-auto px-6 pb-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {/* Feature 1 */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 50, rotateX: -15 },
              visible: { opacity: 1, y: 0, rotateX: 0 },
            }}
            whileHover={{ y: -10, scale: 1.05, rotateY: 5, z: 50 }}
            transition={{ duration: 0.4 }}
            className="group relative bg-gradient-to-br from-white to-orange-50 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all transform-gpu"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <motion.div
                whileHover={{ rotate: 360, scale: 1.2 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
              >
                <span className="text-3xl">📅</span>
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Réservation VIP
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Consultez mes disponibilités en temps réel et réservez en
                quelques clics. <span className="font-semibold text-orange-600">Confirmation instantanée</span> et paiement sécurisé ✨
              </p>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 50, rotateX: -15 },
              visible: { opacity: 1, y: 0, rotateX: 0 },
            }}
            whileHover={{ y: -10, scale: 1.05, rotateY: 5, z: 50 }}
            transition={{ duration: 0.4 }}
            className="group relative bg-gradient-to-br from-white to-orange-50 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all transform-gpu"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <motion.div
                whileHover={{ rotate: 360, scale: 1.2 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
              >
                <span className="text-3xl">📸</span>
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Journal Exclusif
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Recevez des <span className="font-semibold text-orange-600">photos quotidiennes</span> et des mises à jour sur les
                activités : repas 🍖, promenades 🦮, moments de jeu 🎾
              </p>
            </div>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 50, rotateX: -15 },
              visible: { opacity: 1, y: 0, rotateX: 0 },
            }}
            whileHover={{ y: -10, scale: 1.05, rotateY: 5, z: 50 }}
            transition={{ duration: 0.4 }}
            className="group relative bg-gradient-to-br from-white to-orange-50 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all transform-gpu"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <motion.div
                whileHover={{ rotate: 360, scale: 1.2 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
              >
                <span className="text-3xl">💬</span>
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Chat Premium
              </h3>
              <p className="text-gray-700 leading-relaxed">
                <span className="font-semibold text-orange-600">Contact direct</span> avec moi pendant toute la durée de la
                garde. Posez vos questions et recevez des réponses rapides 💨
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Avis Clients Section */}
      <section className="container mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-4"
          >
            Ils nous font confiance ❤️
          </motion.h2>
          <p className="text-xl text-gray-600">
            Retrouvez les avis vérifiés de mes clients sur mes plateformes partenaires
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Carte Rover */}
          <motion.a
            href="https://www.rover.com" // À remplacer par le vrai lien
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05, rotateY: 5 }}
            transition={{ duration: 0.5 }}
            className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all border-2 border-green-100 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-9xl">🐾</span>
            </div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-lg">
                R
              </div>
              <h3 className="text-2xl font-bold text-green-700 mb-2">Rover</h3>
              <div className="flex gap-1 text-yellow-400 text-2xl mb-4">
                ★★★★★
              </div>
              <p className="text-gray-600 italic mb-6">
                "Super expérience ! Mon chien a été chouchouté comme un roi. Je recommande vivement pour la tranquillité d'esprit."
              </p>
              <span className="text-green-600 font-semibold group-hover:underline">
                Voir mon profil Rover →
              </span>
            </div>
          </motion.a>

          {/* Carte AlloVoisins */}
          <motion.a
            href="https://www.allovoisins.com" // À remplacer par le vrai lien
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05, rotateY: -5 }}
            transition={{ duration: 0.5 }}
            className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all border-2 border-blue-100 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-9xl">🏘️</span>
            </div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-lg">
                AV
              </div>
              <h3 className="text-2xl font-bold text-blue-700 mb-2">AlloVoisins</h3>
              <div className="flex gap-1 text-yellow-400 text-2xl mb-4">
                ★★★★★
              </div>
              <p className="text-gray-600 italic mb-6">
                "Très professionnel et arrangeant. Des nouvelles régulières et un vrai amour des animaux. Merci encore !"
              </p>
              <span className="text-blue-600 font-semibold group-hover:underline">
                Voir mon profil AlloVoisins →
              </span>
            </div>
          </motion.a>
        </div>
      </section>

      {/* CTA Section avec effet glassmorphism */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative py-24 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold text-white mb-6"
          >
            Prêt à offrir le meilleur à votre compagnon ? 🐾✨
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl text-orange-100 mb-10 max-w-2xl mx-auto"
          >
            Créez votre compte gratuitement et découvrez un service de garde
            <span className="font-bold text-white"> premium et attentionné</span>.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            whileHover={{ scale: 1.08, y: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href={session?.user ? "/dashboard" : "/auth/signup"}
              className="inline-block bg-white text-orange-600 px-10 py-5 rounded-2xl hover:bg-orange-50 font-bold text-lg transition-all shadow-2xl"
            >
              🌟 Commencer maintenant
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-amber-100 to-orange-100 py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl">🐾</span>
            <span className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              La Patte Dorée
            </span>
            <span className="text-3xl">✨</span>
          </div>
          <p className="text-gray-700">
            &copy; 2025 La Patte Dorée. Tous droits réservés.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Service premium de garde de chiens • Made with ❤️
          </p>
        </div>
      </footer>
    </div>
  );
}