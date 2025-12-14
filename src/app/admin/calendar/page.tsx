"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { UserMenu } from "@/components/layout/UserMenu";

interface Availability {
  id: string;
  date: Date;
  available: boolean;
  maxSlots: number;
  notes?: string | null;
}

export default function AdminCalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedServiceType, setSelectedServiceType] = useState<"BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING">("BOARDING");
  const [availabilities, setAvailabilities] = useState<Record<string, Availability>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
    if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SITTER") {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  useEffect(() => {
    fetchAvailabilities();
  }, [selectedMonth, selectedServiceType]);

  const fetchAvailabilities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/admin/availability?month=${selectedMonth.getMonth() + 1}&year=${selectedMonth.getFullYear()}&serviceType=${selectedServiceType}`
      );

      if (response.ok) {
        const data = await response.json();
        const availabilityMap: Record<string, Availability> = {};

        console.log(`📥 Chargement ${data.availabilities.length} disponibilités pour ${selectedServiceType}`);

        data.availabilities.forEach((availability: any) => {
          // Utiliser directement la date ISO de la BDD (déjà en UTC)
          const dateKey = availability.date.split("T")[0];
          availabilityMap[dateKey] = {
            id: availability.id,
            date: new Date(availability.date),
            available: availability.available,
            maxSlots: availability.maxSlots,
            notes: availability.notes,
          };
          console.log(`  ✓ ${dateKey}: ${availability.available ? "DISPO" : "INDISPO"}`);
        });

        setAvailabilities(availabilityMap);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des disponibilités:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    return { daysInMonth, startDayOfWeek, year, month };
  };

  const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(selectedMonth);

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(year, month + 1, 1));
  };

  const handleDayClick = async (day: number) => {
    // Créer la date en UTC pour éviter les problèmes de fuseau horaire
    const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const dateKey = date.toISOString().split("T")[0];

    const currentAvailability = availabilities[dateKey];

    // Logique simplifiée:
    // - Si pas défini OU disponible → marquer comme INDISPONIBLE
    // - Si indisponible → supprimer (retour au défaut = disponible)
    const isCurrentlyAvailable = currentAvailability ? currentAvailability.available : true;
    const newAvailability = !isCurrentlyAvailable;

    // Mise à jour optimiste de l'UI
    const newAvailabilityData = {
      id: currentAvailability?.id || "",
      date,
      available: newAvailability,
      maxSlots: 1,
      notes: null,
    };

    setAvailabilities({
      ...availabilities,
      [dateKey]: newAvailabilityData,
    });

    console.log(`📅 Clic sur le ${dateKey} - Nouveau statut: ${newAvailability ? "DISPONIBLE" : "INDISPONIBLE"}`);

    // Sauvegarder dans la base de données
    try {
      const response = await fetch("/api/admin/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: date.toISOString(),
          available: newAvailability,
          serviceType: selectedServiceType,
          maxSlots: 1,
        }),
      });

      if (!response.ok) {
        // En cas d'erreur, annuler le changement optimiste
        if (currentAvailability) {
          setAvailabilities({
            ...availabilities,
            [dateKey]: currentAvailability,
          });
        } else {
          // Supprimer l'entrée si elle n'existait pas avant
          const { [dateKey]: removed, ...rest } = availabilities;
          setAvailabilities(rest);
        }
        console.error("Erreur lors de la sauvegarde de la disponibilité");
      }
    } catch (error) {
      // En cas d'erreur, annuler le changement optimiste
      if (currentAvailability) {
        setAvailabilities({
          ...availabilities,
          [dateKey]: currentAvailability,
        });
      } else {
        const { [dateKey]: removed, ...rest } = availabilities;
        setAvailabilities(rest);
      }
      console.error("Erreur lors de la sauvegarde:", error);
    }
  };

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  if (status === "loading" || isLoading) {
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
                <p className="text-xs text-orange-600 font-medium">Gestion du calendrier</p>
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
          className="max-w-5xl mx-auto"
        >
          <div className="mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Gestion du calendrier 📅
            </h1>
            <p className="text-gray-700 text-lg">
              Définissez vos disponibilités pour les réservations
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200"
          >
            {/* Sélecteur de type de service */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                📋 Type de service à gérer
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedServiceType("BOARDING")}
                  className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    selectedServiceType === "BOARDING"
                      ? "border-purple-500 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-900 shadow-md"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">🏠</div>
                  <div>Hébergement</div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedServiceType("DAY_CARE")}
                  className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    selectedServiceType === "DAY_CARE"
                      ? "border-yellow-500 bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-900 shadow-md"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">☀️</div>
                  <div>Garde de jour</div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedServiceType("DROP_IN")}
                  className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    selectedServiceType === "DROP_IN"
                      ? "border-blue-500 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900 shadow-md"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">🚪</div>
                  <div>Visite</div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedServiceType("DOG_WALKING")}
                  className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    selectedServiceType === "DOG_WALKING"
                      ? "border-green-500 bg-gradient-to-br from-green-100 to-green-200 text-green-900 shadow-md"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">🦮</div>
                  <div>Promenade</div>
                </motion.button>
              </div>
            </div>

            {/* Contrôles du calendrier */}
            <div className="flex items-center justify-between mb-6">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handlePrevMonth}
                  variant="outline"
                  className="flex items-center gap-2 border-2 border-orange-200 hover:bg-orange-50 hover:border-orange-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Précédent
                </Button>
              </motion.div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                {monthNames[month]} {year}
              </h2>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleNextMonth}
                  variant="outline"
                  className="flex items-center gap-2 border-2 border-orange-200 hover:bg-orange-50 hover:border-orange-400"
                >
                  Suivant
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </motion.div>
            </div>

            {/* Légende */}
            <div className="flex items-center gap-6 mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-200">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-green-400 to-green-600 rounded-lg shadow-sm"></div>
                <span className="text-sm font-semibold text-gray-700">Disponible (par défaut)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-red-400 to-red-600 rounded-lg shadow-sm"></div>
                <span className="text-sm font-semibold text-gray-700">Indisponible</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-200 rounded-lg shadow-sm"></div>
                <span className="text-sm font-semibold text-gray-700">Passé</span>
              </div>
            </div>

            {/* Grille du calendrier */}
            <div className="grid grid-cols-7 gap-2">
              {/* Jours de la semaine */}
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center font-bold text-orange-600 py-2 text-sm"
                >
                  {day}
                </div>
              ))}

              {/* Espaces vides avant le premier jour */}
              {Array.from({ length: startDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square"></div>
              ))}

              {/* Jours du mois */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                // Utiliser UTC pour éviter les problèmes de fuseau horaire
                const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
                const dateKey = date.toISOString().split("T")[0];
                const availability = availabilities[dateKey];
                // PAR DÉFAUT: disponible (vert) si pas défini dans la BDD
                const isAvailable = availability ? availability.available : true;
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <motion.button
                    key={day}
                    whileHover={{ scale: isPast ? 1 : 1.1 }}
                    whileTap={{ scale: isPast ? 1 : 0.95 }}
                    onClick={() => !isPast && handleDayClick(day)}
                    disabled={isPast}
                    className={`aspect-square rounded-xl border-2 font-bold text-base transition-all shadow-sm ${
                      isPast
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                        : isAvailable
                        ? "bg-gradient-to-br from-green-100 to-green-200 border-green-500 text-green-700 hover:shadow-lg hover:from-green-200 hover:to-green-300"
                        : "bg-gradient-to-br from-red-100 to-red-200 border-red-500 text-red-700 hover:shadow-lg hover:from-red-200 hover:to-red-300"
                    }`}
                  >
                    {day}
                  </motion.button>
                );
              })}
            </div>

            {/* Instructions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 p-6 bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl"
            >
              <p className="text-sm text-orange-800 font-bold mb-3 flex items-center gap-2">
                <span className="text-2xl">💡</span>
                Instructions
              </p>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span><span className="font-semibold text-green-700">Par défaut, toutes les dates sont disponibles</span> (en vert)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span>Cliquez sur un jour disponible pour le marquer comme <span className="font-semibold text-red-700">indisponible</span> (en rouge)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">↩️</span>
                  <span>Cliquez sur un jour indisponible pour le remettre <span className="font-semibold text-green-700">disponible</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">💾</span>
                  <span>Les modifications sont sauvegardées automatiquement</span>
                </li>
              </ul>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
