"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { UserMenu } from "@/components/layout/UserMenu";

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  totalPrice: number;
  creditsUsed: number;
  serviceType: string;
  serviceDetails?: {
    serviceAddress?: string;
    visitSlots?: {
      date: string;
      startTime: string;
      duration: number;
    }[];
  } | null;
  pet?: {
    name: string;
    breed: string;
    imageUrl?: string;
  };
  pets: {
    name: string;
    breed: string;
    imageUrl?: string;
  }[];
  client: {
    name: string;
    email: string;
    phone?: string;
    image?: string;
    subscription?: {
        status: string;
        serviceType: string;
        creditsPerMonth: number;
    };
    creditBatches?: {
        remaining: number;
    }[];
  };
  payment?: {
    status: string;
    amount: number;
  };
}

const getVisitSlots = (booking: Booking) =>
  booking.serviceDetails?.visitSlots?.filter((slot) => slot.date) || [];

export default function AdminBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "completed" | "cancelled">("all");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/bookings?filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error("Erreur chargement réservations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === "ADMIN" || session?.user?.role === "SITTER") {
      fetchBookings();
    }
  }, [session, filter]);

  const handleDelete = async (bookingId: string) => {
    if (!confirm("Supprimer DÉFINITIVEMENT cette réservation ? (Irréversible)")) return;
    setActionLoading(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`, { method: "DELETE" });
      if (res.ok) fetchBookings();
      else alert("Erreur suppression");
    } catch (e) { alert("Erreur"); }
    setActionLoading(null);
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    if (!confirm(newStatus === "CONFIRMED" ? "Confirmer cette réservation ?" : "Refuser cette réservation et rembourser le client ?")) {
      return;
    }

    setActionLoading(bookingId);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchBookings();
      } else {
        alert("Erreur lors de la mise à jour du statut");
      }
    } catch (error) {
      console.error("Erreur:", error);
      alert("Une erreur est survenue");
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Navigation Admin */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-white to-orange-50 border-b border-orange-200 shadow-lg sticky top-0 z-50"
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
              </motion.div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                  La Patte Dorée
                </span>
                <p className="text-xs text-orange-600 font-medium">Gestion des réservations</p>
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
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
                Réservations 💳
              </h1>
              <p className="text-gray-700">
                Gérez les demandes confirmées par paiement
              </p>
            </div>
            
            {/* Filtres */}
            <div className="bg-white p-2 rounded-xl shadow-md border border-orange-100 flex gap-2 overflow-x-auto max-w-full">
              {[
                { id: "all", label: "Tout" },
                { id: "pending", label: "En attente" },
                { id: "confirmed", label: "Confirmé" },
                { id: "completed", label: "Terminé" },
                { id: "cancelled", label: "Annulé" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    filter === f.id
                      ? "bg-orange-500 text-white shadow-md"
                      : "text-gray-600 hover:bg-orange-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des réservations...</p>
            </div>
          ) : bookings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-12 text-center border border-orange-100"
            >
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Aucune réservation trouvée</h3>
              <p className="text-gray-600">Aucune réservation ne correspond aux critères actuels.</p>
            </motion.div>
          ) : (
            <div className="grid gap-6">
              {bookings.map((booking, index) => {
                const petsName = booking.pets.length > 0 
                    ? booking.pets.map(p => p.name).join(", ") 
                    : (booking.pet?.name || "Inconnu");
                const petsBreed = booking.pets.length > 0
                    ? booking.pets.map(p => p.breed || "?").join(", ")
                    : (booking.pet?.breed || "Race inconnue");
                
                const clientCredits = booking.client.creditBatches?.reduce((acc, b) => acc + b.remaining, 0) || 0;
                const isVip = booking.client.subscription?.status === 'ACTIVE';
                const visitSlots = getVisitSlots(booking);

                return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white rounded-2xl shadow-lg border-2 overflow-hidden hover:shadow-xl transition-all ${isVip ? "border-yellow-400 ring-2 ring-yellow-100" : "border-orange-100"}`}
                >
                  <div className="p-6 grid md:grid-cols-[2fr_1fr_1fr] gap-6">
                    {/* Info Client & Animal */}
                    <div className="flex gap-4">
                      <div className="h-16 w-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 relative">
                        {booking.serviceType === "DOG_WALKING" ? "🐾" : 
                         booking.serviceType === "DROP_IN" ? "🚪" : "🏠"}
                         {isVip && (
                             <div className="absolute -top-2 -left-2 bg-yellow-400 text-white rounded-full p-1 shadow-sm text-xs" title="Membre Club">👑</div>
                         )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900">{booking.client.name}</h3>
                          {isVip ? (
                              <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-bold shadow-sm">
                                  ⚡ CLUB
                              </span>
                          ) : (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                                Client
                              </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-2 flex flex-col gap-0.5">
                          <span>📧 {booking.client.email}</span>
                          {booking.client.phone && <span>📞 {booking.client.phone}</span>}
                          {isVip && <span className="text-green-600 font-medium text-xs">💰 Solde Crédits: {clientCredits}</span>}
                        </p>
                        <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-lg w-fit">
                          <span className="text-lg">🐾</span>
                          <span className="font-semibold text-orange-900">{petsName}</span>
                          <span className="text-orange-700 text-sm">({petsBreed})</span>
                        </div>
                      </div>
                    </div>

                    {/* Dates & Prix */}
                    <div className="flex flex-col justify-center">
                      <div className="mb-2">
                        <p className="text-sm text-gray-500 mb-1">Période</p>
                        <p className="font-bold text-gray-900">
                          {new Date(booking.startDate).toLocaleDateString("fr-FR")}
                          <span className="text-gray-400 mx-2">➔</span>
                          {new Date(booking.endDate).toLocaleDateString("fr-FR")}
                        </p>
                        {visitSlots.length > 0 && (
                          <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
                            <p className="font-bold">{visitSlots.length} passage{visitSlots.length > 1 ? "s" : ""} prévu{visitSlots.length > 1 ? "s" : ""}</p>
                            {visitSlots.slice(0, 4).map((slot, slotIndex) => (
                              <p key={`${slot.date}-${slot.startTime}-${slotIndex}`}>
                                {new Date(slot.date).toLocaleDateString("fr-FR")} à {slot.startTime} · {slot.duration} min
                              </p>
                            ))}
                            {visitSlots.length > 4 && <p>+ {visitSlots.length - 4} autre{visitSlots.length - 4 > 1 ? "s" : ""}</p>}
                          </div>
                        )}
                        {booking.serviceDetails?.serviceAddress && (
                          <p className="mt-2 text-xs font-medium text-gray-700">
                            Adresse : {booking.serviceDetails.serviceAddress}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Paiement</p>
                        {booking.creditsUsed > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-purple-600 text-lg">{booking.creditsUsed} Crédits</span>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Prépayé</span>
                            </div>
                        ) : (
                            <p className="font-bold text-green-600 text-lg">
                              {booking.totalPrice.toFixed(2)}€
                            </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-center gap-3">
                      <div className={`text-center px-4 py-1.5 rounded-full text-sm font-bold mb-2 ${
                        booking.status === "PENDING" ? "bg-orange-100 text-orange-700" :
                        booking.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                        booking.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {booking.status === "PENDING" ? "EN ATTENTE" :
                         booking.status === "CONFIRMED" ? "CONFIRMÉE" :
                         booking.status === "CANCELLED" ? "ANNULÉE" : "TERMINÉE"}
                      </div>

                      {booking.status === "PENDING" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => handleStatusChange(booking.id, "CONFIRMED")}
                            disabled={actionLoading === booking.id}
                            className="bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg transition-all"
                          >
                            Accepter
                          </Button>
                          <Button
                            onClick={() => handleStatusChange(booking.id, "CANCELLED")}
                            disabled={actionLoading === booking.id}
                            variant="destructive"
                            className="bg-red-500 hover:bg-red-600 shadow-md hover:shadow-lg transition-all"
                          >
                            Refuser
                          </Button>
                        </div>
                      )}
                      
                      {booking.status === "CONFIRMED" && (
                        <Button
                          onClick={() => handleStatusChange(booking.id, "CANCELLED")}
                          disabled={actionLoading === booking.id}
                          variant="destructive"
                          className="w-full bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                        >
                          Annuler {booking.creditsUsed > 0 ? "& Rembourser Crédits" : "& Rembourser"}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(booking.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
                      >
                        🗑️ Supprimer
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )})}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
