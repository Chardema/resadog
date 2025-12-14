"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { AvailabilityCalendar } from "@/components/dashboard/AvailabilityCalendar";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
    // Rediriger les admins/gardiens vers leur dashboard spécifique
    if (session?.user?.role === "ADMIN" || session?.user?.role === "SITTER") {
      router.push("/admin/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🐾</div>
          <p className="text-gray-700 font-semibold">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Navigation */}
      <DashboardNav />

      {/* Contenu principal */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Tableau de bord 🐾
            </h1>
            <p className="text-gray-700 text-lg">
              Bienvenue sur votre espace personnel <span className="font-semibold text-orange-600">La Patte Dorée</span>
            </p>
          </motion.div>

          {/* Cartes de statistiques avec animations 3D */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            className="grid md:grid-cols-3 gap-6 mb-10"
          >
            {/* Card 1 - Réservations */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 transform-gpu"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Réservations à venir
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">📅</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">0</p>
              <p className="text-sm text-gray-600">Aucune réservation</p>
            </motion.div>

            {/* Card 2 - Mes animaux */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 transform-gpu"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Mes animaux
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">🐕</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">0</p>
              <p className="text-sm text-gray-600">Aucun profil créé</p>
            </motion.div>

            {/* Card 3 - Messages */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 transform-gpu"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Messages
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">💬</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">0</p>
              <p className="text-sm text-gray-600">Aucun message</p>
            </motion.div>
          </motion.div>

          {/* Calendrier des disponibilités */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-10"
          >
            <AvailabilityCalendar />
          </motion.div>

          {/* Actions rapides */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Actions rapides ⚡
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                whileHover={{ x: 5, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  href="/booking"
                  className="flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-yellow-50 hover:border-orange-300 transition-all group"
                >
                  <div className="h-14 w-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-3xl">⭐</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      Nouvelle réservation
                    </h3>
                    <p className="text-sm text-gray-600">
                      Réserver une garde premium pour votre chien
                    </p>
                  </div>
                </Link>
              </motion.div>

              <motion.div
                whileHover={{ x: 5, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  href="/pets/new"
                  className="flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:border-green-300 transition-all group"
                >
                  <div className="h-14 w-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🐶</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      Ajouter un animal
                    </h3>
                    <p className="text-sm text-gray-600">
                      Créer le profil de votre compagnon
                    </p>
                  </div>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
