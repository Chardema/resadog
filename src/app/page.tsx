"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-6 py-6"
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl"
            >
              R
            </motion.div>
            <span className="text-2xl font-bold text-gray-900">ResaDog</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/signin"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Connexion
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/auth/signup"
                className="inline-block bg-blue-500 text-white px-6 py-2.5 rounded-full hover:bg-blue-600 font-medium transition-colors shadow-sm"
              >
                S'inscrire
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight"
          >
            Votre compagnon en de{" "}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-blue-600"
            >
              bonnes mains
            </motion.span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Service professionnel de garde de chiens avec suivi en temps réel,
            photos quotidiennes et communication directe. Réservez facilement en
            ligne et restez connecté pendant toute la garde.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/calendar"
                className="inline-block bg-blue-500 text-white px-8 py-4 rounded-full hover:bg-blue-600 font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Voir le calendrier
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/booking"
                className="inline-block bg-white text-blue-600 px-8 py-4 rounded-full hover:bg-blue-50 font-semibold text-lg transition-all border-2 border-blue-200"
              >
                Réserver maintenant
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 pb-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.2,
              },
            },
          }}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
        >
          {/* Feature 1 */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Réservation Facile
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Consultez mes disponibilités en temps réel et réservez en
              quelques clics. Confirmation instantanée et paiement sécurisé.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Journal Quotidien
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Recevez des photos et des mises à jour quotidiennes sur les
              activités de votre chien : repas, promenades, moments de jeu.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Chat en Temps Réel
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Restez en contact direct avec moi pendant toute la durée de la
              garde. Posez vos questions et recevez des réponses rapides.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="bg-blue-600 py-20"
      >
        <div className="container mx-auto px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-white mb-6"
          >
            Prêt à offrir le meilleur à votre compagnon ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto"
          >
            Créez votre compte gratuitement et découvrez un service de garde
            professionnel et attentionné.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href="/auth/signup"
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-full hover:bg-blue-50 font-semibold text-lg transition-all shadow-lg"
            >
              Commencer maintenant
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-gray-50 py-12">
        <div className="container mx-auto px-6 text-center text-gray-600">
          <p>
            &copy; 2025 ResaDog. Tous droits réservés. Service professionnel de
            garde de chiens.
          </p>
        </div>
      </footer>
    </div>
  );
}
