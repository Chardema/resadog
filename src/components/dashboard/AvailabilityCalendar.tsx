"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Availability {
  date: string;
  available: boolean;
}

type ServiceType = "BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING";

export function AvailabilityCalendar() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType>("BOARDING");
  const [availabilities, setAvailabilities] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAvailabilities();
  }, [selectedMonth, selectedServiceType]);

  const fetchAvailabilities = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/availability?month=${selectedMonth.getMonth() + 1}&year=${selectedMonth.getFullYear()}&serviceType=${selectedServiceType}`
      );

      if (response.ok) {
        const data = await response.json();
        const availabilityMap: Record<string, boolean> = {};

        console.log(`📥 Client: Chargement ${data.availabilities.length} disponibilités pour ${selectedServiceType}`);

        data.availabilities.forEach((availability: any) => {
          const dateKey = availability.date.split("T")[0];
          availabilityMap[dateKey] = availability.available;
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

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const services = [
    { value: "BOARDING" as ServiceType, name: "Hébergement", icon: "🏠", color: "purple" },
    { value: "DAY_CARE" as ServiceType, name: "Garde de jour", icon: "☀️", color: "yellow" },
    { value: "DROP_IN" as ServiceType, name: "Visite", icon: "🚪", color: "blue" },
    { value: "DOG_WALKING" as ServiceType, name: "Promenade", icon: "🦮", color: "green" },
  ];

  const selectedService = services.find(s => s.value === selectedServiceType);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <span className="text-3xl">📅</span>
          Disponibilités du gardien
        </h2>

        {/* Sélecteur de type de service */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            📋 Voir les disponibilités pour :
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {services.map((service) => (
              <motion.button
                key={service.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedServiceType(service.value)}
                className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  selectedServiceType === service.value
                    ? service.color === "purple"
                      ? "border-purple-500 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-900 shadow-md"
                      : service.color === "yellow"
                      ? "border-yellow-500 bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-900 shadow-md"
                      : service.color === "blue"
                      ? "border-blue-500 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900 shadow-md"
                      : "border-green-500 bg-gradient-to-br from-green-100 to-green-200 text-green-900 shadow-md"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="text-2xl mb-1">{service.icon}</div>
                <div className="text-xs">{service.name}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Contrôles du calendrier */}
      <div className="flex items-center justify-between mb-6">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handlePrevMonth}
            variant="outline"
            size="sm"
            className="border-2 border-orange-200 hover:bg-orange-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
        </motion.div>

        <h3 className="text-xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
          {monthNames[month]} {year}
        </h3>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleNextMonth}
            variant="outline"
            size="sm"
            className="border-2 border-orange-200 hover:bg-orange-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </motion.div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-green-600 rounded"></div>
          <span className="font-medium text-gray-700">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gradient-to-br from-red-400 to-red-600 rounded"></div>
          <span className="font-medium text-gray-700">Indisponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <span className="font-medium text-gray-700">Passé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white rounded border-2 border-orange-400"></div>
          <span className="font-medium text-gray-700">Aujourd'hui</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Grille du calendrier */}
          <div className="grid grid-cols-7 gap-2">
            {/* Jours de la semaine */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center font-bold text-orange-600 py-2 text-xs"
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
              // PAR DÉFAUT: disponible si pas défini dans la BDD
              const isAvailable = availabilities[dateKey] !== undefined ? availabilities[dateKey] : true;
              const isPast = date < today;
              const isToday = date.getTime() === today.getTime();

              return (
                <motion.div
                  key={day}
                  whileHover={!isPast && isAvailable ? { scale: 1.1 } : {}}
                  className={`aspect-square rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
                    isPast
                      ? "bg-gray-100 text-gray-400"
                      : isAvailable
                      ? "bg-gradient-to-br from-green-100 to-green-200 text-green-700 border-2 border-green-400 shadow-sm"
                      : "bg-gradient-to-br from-red-100 to-red-200 text-red-700 border-2 border-red-400"
                  } ${isToday ? "ring-2 ring-orange-500" : ""}`}
                >
                  {day}
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl">
            <p className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-xl">💡</span>
              <span>
                <span className="font-semibold">Astuce:</span> Cliquez sur "Nouvelle réservation" pour réserver aux dates disponibles en vert!
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
