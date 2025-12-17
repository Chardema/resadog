"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppNav } from "@/components/layout/AppNav";

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  pets: {
    name: string;
    imageUrl?: string | null;
  }[];
  pet?: {
    name: string;
    imageUrl?: string | null;
  } | null;
  totalPrice: number;
}

interface DashboardData {
  upcomingBookings: Booking[];
  stats: {
    totalBookings: number;
    totalSpent: number;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status, router]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/bookings");
      if (response.ok) {
        const jsonData = await response.json();
        const bookings = jsonData.bookings || [];
        
        const now = new Date();
        // Filtrer les réservations futures ou en cours
        const upcoming = bookings.filter((b: any) => new Date(b.endDate) >= now);
        
        // Calculer les stats
        const totalSpent = bookings.reduce((acc: number, b: any) => acc + (b.totalPrice || 0), 0);

        setData({
          upcomingBookings: upcoming,
          stats: {
            totalBookings: bookings.length,
            totalSpent: totalSpent,
          },
        });
      }
    } catch (error) {
      console.error("Erreur chargement dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl animate-bounce">🐕</div>
          <p className="text-gray-500 font-medium animate-pulse">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-20">
      <AppNav userName={session?.user?.name} />

      {/* Decorative Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-200/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[100px]" />
      </div>

      <main className="container mx-auto px-6 pt-32 relative z-10">
        {/* Header */}
        <div className="mb-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-2"
          >
            Bon retour, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">{session?.user?.name?.split(' ')[0]}</span> 👋
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-500"
          >
            Voici ce qui se passe aujourd'hui.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Nouvelle Réservation (Call to Action) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2rem] p-8 text-white shadow-xl shadow-gray-900/20 relative overflow-hidden group cursor-pointer"
            onClick={() => router.push('/booking')}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-150" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl mb-4">
                  📅
                </div>
                <h2 className="text-3xl font-bold mb-2">Planifier une garde</h2>
                <p className="text-gray-300 max-w-md">
                  Besoin de partir quelques jours ? Réservez un séjour ou une promenade en quelques clics.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <span className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold text-sm group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  Commencer →
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Mes Animaux (Stats) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-lg shadow-orange-100/50 flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer"
            onClick={() => router.push('/pets')}
          >
            <div className="absolute inset-0 bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform">🐕</div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Mes Animaux</h3>
              <p className="text-gray-500 text-sm">Gérer les profils</p>
            </div>
          </motion.div>

          {/* Card 3: Prochaine Réservation (Status) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="md:row-span-2 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-lg shadow-blue-100/50 flex flex-col relative overflow-hidden"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              À venir
            </h3>
            
            {data?.upcomingBookings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <div className="text-6xl mb-4 grayscale">💤</div>
                <p className="text-gray-500 font-medium">Aucune réservation prévue</p>
                <p className="text-sm text-gray-400 mt-2">Profitez du calme !</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.upcomingBookings.slice(0, 2).map((booking) => {
                  // Determine display data (handle multi-pet)
                  const displayImage = booking.pets.length > 0 ? booking.pets[0].imageUrl : booking.pet?.imageUrl;
                  const displayName = booking.pets.length > 0 
                      ? booking.pets.map(p => p.name).join(", ") 
                      : (booking.pet?.name || "Inconnu");

                  return (
                  <div key={booking.id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
                      {displayImage ? (
                        <img src={displayImage} alt="" className="w-full h-full object-cover" />
                      ) : "🐕"}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(booking.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} - {new Date(booking.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${
                        booking.status === "PENDING" ? "bg-orange-100 text-orange-700" :
                        booking.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-200"
                      }`}>
                        {booking.status === "PENDING" ? "En attente" : "Confirmée"}
                      </span>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </motion.div>

          {/* Card 4: Historique / Factures (Link) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-orange-100 rounded-[2rem] p-8 flex items-center justify-between cursor-pointer group"
            onClick={() => router.push('/booking')} // Ou page historique
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm">
                📂
              </div>
              <div>
                <h3 className="text-xl font-bold text-orange-900">Historique & Factures</h3>
                <p className="text-orange-700/80 text-sm">Retrouvez toutes vos anciennes gardes</p>
              </div>
            </div>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-orange-600 font-bold shadow-sm group-hover:translate-x-2 transition-transform">
              →
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
