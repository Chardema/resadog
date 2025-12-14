"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { UserMenu } from "@/components/layout/UserMenu";

interface Stats {
  totalBookings: number;
  pendingBookings: number;
  totalClients: number;
  totalRevenue: number;
}

interface Booking {
  id: string;
  startDate: Date;
  status: string;
  pet: { name: string };
  client: { name: string | null };
}

interface AdminDashboardClientProps {
  stats: Stats;
  upcomingBookings: Booking[];
}

export function AdminDashboardClient({ stats, upcomingBookings }: AdminDashboardClientProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Navigation Admin */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-600 text-white shadow-2xl"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="h-12 w-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center font-bold text-2xl shadow-lg transform rotate-12">
                  🐾
                </div>
                <div className="absolute -top-1 -right-1 text-yellow-200 text-xl animate-pulse">
                  ✨
                </div>
              </motion.div>
              <div>
                <span className="text-2xl font-bold">La Patte Dorée</span>
                <p className="text-xs text-orange-200 font-medium">Dashboard Admin VIP</p>
              </div>
            </Link>
            <UserMenu variant="dark" />
          </div>
        </div>
      </motion.nav>

      {/* Contenu principal */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Tableau de bord Gardien 🐾✨
            </h1>
            <p className="text-gray-700 text-lg">
              Gérez vos réservations, disponibilités et revenus premium
            </p>
          </motion.div>

          {/* Statistiques principales avec effets 3D */}
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
            className="grid md:grid-cols-4 gap-6 mb-10"
          >
            {/* Card 1 - Réservations totales */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="group bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-blue-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Réservations totales
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">📅</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">{stats.totalBookings}</p>
              <p className="text-sm text-gray-600">
                {stats.pendingBookings} en attente
              </p>
            </motion.div>

            {/* Card 2 - En attente */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="group bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-orange-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  En attente
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">⏳</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">{stats.pendingBookings}</p>
              <p className="text-sm text-gray-600">À confirmer</p>
            </motion.div>

            {/* Card 3 - Clients actifs */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="group bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-green-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Clients VIP
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">👥</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">{stats.totalClients}</p>
              <p className="text-sm text-gray-600">Clients enregistrés</p>
            </motion.div>

            {/* Card 4 - Revenus */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: -15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{ y: -8, scale: 1.03, rotateY: 5 }}
              transition={{ duration: 0.3 }}
              className="group bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-xl hover:shadow-2xl p-6 border-l-4 border-yellow-500 transform-gpu"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Revenus totaux
                </h3>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="h-12 w-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-2xl">💰</span>
                </motion.div>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">
                {stats.totalRevenue.toFixed(2)} €
              </p>
              <p className="text-sm text-gray-600">Paiements réussis</p>
            </motion.div>
          </motion.div>

          {/* Actions rapides et Réservations */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Actions rapides */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Actions rapides ⚡
              </h2>
              <div className="space-y-4">
                <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
                  <Link
                    href="/admin/calendar"
                    className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-300 transition-all group"
                  >
                    <div className="h-14 w-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <span className="text-3xl">📅</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Gérer mon calendrier</h3>
                      <p className="text-sm text-gray-600">Définir mes disponibilités</p>
                    </div>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
                  <Link
                    href="/admin/bookings"
                    className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 hover:border-orange-300 transition-all group"
                  >
                    <div className="h-14 w-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <span className="text-3xl">📋</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Voir les réservations</h3>
                      <p className="text-sm text-gray-600">Gérer les demandes</p>
                    </div>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
                  <Link
                    href="/admin/revenue"
                    className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 hover:border-green-300 transition-all group"
                  >
                    <div className="h-14 w-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <span className="text-3xl">📊</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Statistiques & Revenus</h3>
                      <p className="text-sm text-gray-600">Analyser mes performances</p>
                    </div>
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {/* Prochaines réservations */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Prochaines réservations 📅
                </h2>
                <Link href="/admin/bookings" className="text-sm font-semibold text-orange-600 hover:text-orange-700 hover:underline">
                  Voir tout
                </Link>
              </div>
              
              {upcomingBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-7xl mb-4 animate-bounce">📭</div>
                  <p className="text-gray-700 font-semibold text-lg">Aucune réservation à venir</p>
                  <p className="text-sm text-gray-500 mt-2">Les nouvelles demandes apparaîtront ici</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking, index) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      whileHover={{ x: 5, scale: 1.02 }}
                    >
                      <Link 
                        href="/admin/bookings"
                        className="block p-4 border-2 border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-yellow-50 hover:border-orange-300 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-2xl">
                              🐕
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{booking.pet.name}</h3>
                              <p className="text-sm text-gray-600">{booking.client.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {new Date(booking.startDate).toLocaleDateString("fr-FR")}
                            </p>
                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                              booking.status === "PENDING" ? "bg-orange-100 text-orange-700" :
                              booking.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {booking.status === "PENDING" ? "En attente" :
                               booking.status === "CONFIRMED" ? "Confirmée" : booking.status}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
