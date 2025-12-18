"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { motion } from "framer-motion";
import { AppNav } from "@/components/layout/AppNav";
import confetti from "canvas-confetti";

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
  credits: number;
  subscription: any;
  portalUrl: string | null;
  stats: {
    totalBookings: number;
    totalSpent: number;
  };
}

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status, router]);

  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Polling pour attendre le webhook
      let attempts = 0;
      const interval = setInterval(async () => {
          attempts++;
          await fetchDashboardData();
          if (attempts >= 5) { // Stop après 10s
              clearInterval(interval);
              // Clean URL après tentative
              router.replace("/dashboard");
          }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [searchParams, router]);

  const fetchDashboardData = async () => {
    try {
      const [bookingsRes, subRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/user/subscription")
      ]);

      if (bookingsRes.ok && subRes.ok) {
        const bookingsData = await bookingsRes.json();
        const subData = await subRes.json();
        
        const bookings = bookingsData.bookings || [];
        const now = new Date();
        const upcoming = bookings.filter((b: any) => new Date(b.endDate) >= now);
        const totalSpent = bookings.reduce((acc: number, b: any) => acc + (b.totalPrice || 0), 0);

        setData({
          upcomingBookings: upcoming,
          credits: subData.credits,
          subscription: subData.subscription,
          portalUrl: subData.portalUrl,
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

  const isSubscribed = data?.subscription && data.subscription.status === 'ACTIVE';
  const hasCanceledSub = data?.subscription && data.subscription.status === 'CANCELED';

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />

      {/* Decorative Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-200/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[100px]" />
      </div>

      <main className="container mx-auto px-6 pt-32 relative z-10">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
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
              Votre espace personnel
            </motion.p>
          </div>
          
          {data?.portalUrl && isSubscribed && (
            <motion.a
              href={data.portalUrl}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-orange-600 bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all self-start md:self-end"
            >
              ⚙️ Gérer mon abonnement
            </motion.a>
          )}
        </div>

        {/* Subscription Messages */}
        {searchParams.get("subscription") === "success" && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-100 border border-green-200 text-green-800 px-6 py-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4 text-center md:text-left"
          >
            <div>
              <p className="font-bold text-lg">🎉 Félicitations ! Vous avez rejoint le club !</p>
              <p className="text-sm text-green-700">Vos crédits sont disponibles. Vous pouvez dès maintenant réserver sans sortir votre carte bancaire.</p>
            </div>
            <Link href="/booking" className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors whitespace-nowrap">
              Utiliser mes crédits
            </Link>
          </motion.div>
        )}

        {hasCanceledSub && (
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-100 border border-gray-200 text-gray-800 px-6 py-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4"
            >
                <div>
                    <p className="font-bold">Abonnement résilié 🛑</p>
                    <p className="text-sm text-gray-600">Votre abonnement est inactif. Vos crédits restants ({data.credits}) sont toujours utilisables sans limite de temps.</p>
                </div>
                <Link href="/subscriptions" className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors">
                    Me ré-abonner
                </Link>
            </motion.div>
        )}

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Crédits & Abonnement */}
          {isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2rem] p-8 text-white shadow-xl shadow-gray-900/20 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-150" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl mb-4">
                      🪙
                    </div>
                    <h2 className="text-3xl font-bold mb-1">{data?.credits} Crédits</h2>
                    <p className="text-gray-400 text-sm">
                      Disponibles pour vos réservations
                    </p>
                  </div>
                  <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    {data?.subscription.billingPeriod === "YEARLY" ? "Annuel" : "Mensuel"}
                  </div>
                </div>
                
                <div className="mt-8 flex items-center gap-3">
                  <Link href="/booking" className="flex-1 text-center bg-white text-gray-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors shadow-lg">
                    Réserver avec mes crédits
                  </Link>
                  {data?.portalUrl && (
                    <a href={data.portalUrl} className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white font-bold text-lg">
                      ⚙️
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            // Card Promo Abonnement (Si pas abonné ou résilié)
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className={`md:col-span-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-[2rem] p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden group cursor-pointer ${hasCanceledSub ? 'grayscale-[0.5]' : ''}`}
              onClick={() => router.push('/subscriptions')}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-3xl font-bold">
                        {hasCanceledSub ? "Relancer mon Club" : "Rejoignez le Club"}
                    </h2>
                    {data?.credits > 0 && (
                        <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                            Restant : {data.credits} crédits 🪙
                        </div>
                    )}
                  </div>
                  <p className="text-orange-100 max-w-md italic">
                    {hasCanceledSub 
                        ? "Votre abonnement est terminé, mais vous pouvez toujours utiliser vos crédits ou reprendre une formule pour économiser à nouveau."
                        : "Économisez jusqu'à 20% sur vos gardes et profitez de la priorité de réservation."}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <span className="bg-white text-orange-600 px-6 py-3 rounded-full font-bold text-sm group-hover:bg-orange-50 transition-all shadow-md">
                    Voir les offres →
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 2: Mes Animaux */}
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

          {/* Card 3: À venir */}
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
              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin">
                {data?.upcomingBookings.map((booking) => {
                  const displayImage = booking.pets.length > 0 ? booking.pets[0].imageUrl : booking.pet?.imageUrl;
                  const displayName = booking.pets.length > 0 
                      ? booking.pets.map(p => p.name).join(", ") 
                      : (booking.pet?.name || "Inconnu");

                  return (
                  <div key={booking.id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4 border border-transparent hover:border-orange-100 transition-all">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                      {displayImage ? (
                        <img src={displayImage} alt="" className="w-full h-full object-cover" />
                      ) : "🐕"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{displayName}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(booking.startDate).toLocaleDateString("fr-FR")} - {new Date(booking.endDate).toLocaleDateString("fr-FR")}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block font-bold ${
                        booking.status === "PENDING" ? "bg-orange-100 text-orange-700" :
                        booking.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-200"
                      }`}>
                        {booking.status === "PENDING" ? "Attente" : "Confirmée"}
                      </span>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </motion.div>

          {/* Card 4: Historique */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-orange-100 rounded-[2rem] p-8 flex items-center justify-between cursor-pointer group"
            onClick={() => router.push('/dashboard')} // Placeholder
          >
            <div className="flex items-center gap-6 text-left">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm">
                📂
              </div>
              <div>
                <h3 className="text-xl font-bold text-orange-900">Historique</h3>
                <p className="text-orange-700/80 text-sm">Retrouvez vos anciennes gardes</p>
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">🐕</div>}>
      <DashboardContent />
    </Suspense>
  );
}