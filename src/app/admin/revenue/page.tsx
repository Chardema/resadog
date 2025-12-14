"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { UserMenu } from "@/components/layout/UserMenu";

export default function AdminRevenuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
    if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SITTER") {
      router.push("/dashboard");
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
      {/* Navigation Admin */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-white to-orange-50 border-b border-orange-200 shadow-lg"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold text-xl shadow-lg transform rotate-12">
                  🐾
                </div>
                <div className="absolute -top-1 -right-1 text-yellow-400 text-lg animate-pulse">
                  ✨
                </div>
              </motion.div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                  La Patte Dorée
                </span>
                <p className="text-xs text-orange-600 font-medium">Gestion des revenus</p>
              </div>
            </Link>
            <UserMenu variant="light" />
          </div>
        </div>
      </motion.nav>

      {/* Contenu */}
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-7xl mx-auto"
        >
          <div className="mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Revenus & Statistiques 💰
            </h1>
            <p className="text-gray-700 text-lg">
              Analysez vos performances et revenus
            </p>
          </div>

          {/* Statistiques mensuelles avec animations 3D */}
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
            {/* Card 1 - Revenus ce mois */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-green-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Revenus ce mois
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">💵</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">0 €</p>
              <p className="text-sm text-gray-600">0 réservations payées</p>
            </motion.div>

            {/* Card 2 - Revenus totaux */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-orange-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Revenus totaux
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">💰</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">0 €</p>
              <p className="text-sm text-gray-600">Depuis le début</p>
            </motion.div>

            {/* Card 3 - Revenu moyen */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-yellow-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Revenu moyen
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">📊</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">0 €</p>
              <p className="text-sm text-gray-600">Par réservation</p>
            </motion.div>
          </motion.div>

          {/* Graphique */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200 mb-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              Évolution des revenus
              <span className="text-3xl">📈</span>
            </h2>
            <div className="text-center py-16 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl border-2 border-dashed border-orange-300">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-4"
              >
                📊
              </motion.div>
              <p className="text-gray-700 font-semibold text-lg mb-2">Graphique des revenus</p>
              <p className="text-sm text-gray-600">
                Les statistiques s'afficheront après vos premières réservations
              </p>
            </div>
          </motion.div>

          {/* Historique des paiements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              Historique des paiements
              <span className="text-3xl">💳</span>
            </h2>
            <div className="text-center py-16">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-4"
              >
                💸
              </motion.div>
              <p className="text-gray-700 font-semibold text-lg mb-2">Aucun paiement pour le moment</p>
              <p className="text-sm text-gray-600">
                L'historique apparaîtra ici après les premiers paiements
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
