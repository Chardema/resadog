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
  serviceType: string;
  serviceDetails?: {
    visitSlots?: {
      date: string;
      startTime: string;
      duration: number;
    }[];
  } | null;
  pets: { name: string; breed?: string }[];
  totalPrice: number;
  creditsUsed?: number;
  createdAt: string;
}

const SERVICE_LABELS: Record<string, string> = {
  BOARDING: "Pension",
  DAY_CARE: "Garderie",
  DROP_IN: "Visite",
  DOG_WALKING: "Promenade",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "Confirmée", color: "bg-green-100 text-green-700" },
  IN_PROGRESS: { label: "En cours", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Terminée", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Annulée", color: "bg-red-100 text-red-700" },
};

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchBookings();
    }
  }, [status, router]);

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error("Erreur chargement historique:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === "all") return true;
    if (filter === "past") return ["COMPLETED", "CANCELLED"].includes(b.status);
    if (filter === "active") return ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status);
    return b.status === filter;
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center">
        <div className="text-6xl animate-bounce">🐾</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />

      <main className="container mx-auto px-6 pt-32">
        <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold text-gray-900 mb-2"
            >
              Historique
            </motion.h1>
            <p className="text-gray-500">Toutes vos réservations</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-bold text-gray-600 hover:text-orange-600 bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all self-start"
          >
            ← Retour au dashboard
          </Link>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { key: "all", label: "Toutes" },
            { key: "active", label: "En cours" },
            { key: "past", label: "Terminées" },
            { key: "CANCELLED", label: "Annulées" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                filter === key
                  ? "bg-gray-900 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 grayscale">📂</div>
            <p className="text-gray-500 font-medium">Aucune réservation trouvée</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking, index) => {
              const statusInfo = STATUS_LABELS[booking.status] || STATUS_LABELS.PENDING;
              const petNames = booking.pets.map((p) => p.name).join(", ") || "Animal";
              const visitSlots = booking.serviceDetails?.visitSlots?.filter((slot) => slot.date) || [];

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {booking.serviceType === "BOARDING" && "🏠"}
                        {booking.serviceType === "DAY_CARE" && "☀️"}
                        {booking.serviceType === "DROP_IN" && "🚪"}
                        {booking.serviceType === "DOG_WALKING" && "🐾"}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{petNames}</p>
                        <p className="text-sm text-gray-500">
                          {SERVICE_LABELS[booking.serviceType] || booking.serviceType} — {" "}
                          {new Date(booking.startDate).toLocaleDateString("fr-FR")} au{" "}
                          {new Date(booking.endDate).toLocaleDateString("fr-FR")}
                        </p>
                        {visitSlots.length > 0 && (
                          <p className="text-xs text-blue-700 font-medium mt-1">
                            {visitSlots.length} passage{visitSlots.length > 1 ? "s" : ""} · prochain : {new Date(visitSlots[0].date).toLocaleDateString("fr-FR")} à {visitSlots[0].startTime} ({visitSlots[0].duration} min)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {booking.creditsUsed && booking.creditsUsed > 0 ? (
                          <p className="font-bold text-gray-900">{booking.creditsUsed} crédits</p>
                        ) : (
                          <p className="font-bold text-gray-900">{booking.totalPrice}€</p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
