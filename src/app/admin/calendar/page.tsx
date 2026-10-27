"use client";

import { useCallback, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { isHourlyServiceType, type AppServiceType } from "@/lib/services";

interface Availability {
  id: string;
  date: Date;
  available: boolean;
  maxSlots: number;
  notes?: string | null;
}

type AvailabilityApiItem = Omit<Availability, "date"> & { date: string };
type BookedDateSummary = {
  count: number;
  bookings: Array<{
    id: string;
    clientName: string;
    petNames: string;
    timeLabel: string | null;
  }>;
};

const serviceOptions: Array<{ value: AppServiceType; label: string; shortLabel: string; icon: string }> = [
  { value: "BOARDING", label: "Hébergement", shortLabel: "Hébergement", icon: "🏠" },
  { value: "HOUSE_SITTING", label: "Garde au domicile", shortLabel: "Domicile", icon: "🛏️" },
  { value: "DAY_CARE", label: "Garderie", shortLabel: "Garderie", icon: "☀️" },
  { value: "DROP_IN", label: "Visite à domicile", shortLabel: "Visite", icon: "🚪" },
  { value: "DOG_WALKING", label: "Promenade", shortLabel: "Promenade", icon: "🐾" },
];

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminCalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedServiceType, setSelectedServiceType] = useState<AppServiceType>("BOARDING");
  const [availabilities, setAvailabilities] = useState<Record<string, Availability>>({});
  const [bookedDates, setBookedDates] = useState<Record<string, BookedDateSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationLabel, setVacationLabel] = useState("");
  const [vacationAction, setVacationAction] = useState<"BLOCK" | "RESTORE" | null>(null);
  const [vacationFeedback, setVacationFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (
      status === "authenticated" &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "SITTER"
    ) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  const fetchAvailabilities = useCallback(async (monthToFetch = selectedMonth) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/admin/availability?month=${monthToFetch.getMonth() + 1}&year=${monthToFetch.getFullYear()}&serviceType=${selectedServiceType}`
      );

      if (response.ok) {
        const data = await response.json();
        const availabilityMap: Record<string, Availability> = {};

        data.availabilities.forEach((availability: AvailabilityApiItem) => {
          // Utiliser directement la date ISO de la BDD (déjà en UTC)
          const dateKey = availability.date.split("T")[0];
          availabilityMap[dateKey] = {
            id: availability.id,
            date: new Date(availability.date),
            available: availability.available,
            maxSlots: availability.maxSlots,
            notes: availability.notes,
          };
        });

        setAvailabilities(availabilityMap);
        setBookedDates(data.bookedDates || {});
      }
    } catch (error) {
      console.error("Erreur lors du chargement des disponibilités:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedServiceType]);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

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
          const nextAvailabilities = { ...availabilities };
          delete nextAvailabilities[dateKey];
          setAvailabilities(nextAvailabilities);
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
        const nextAvailabilities = { ...availabilities };
        delete nextAvailabilities[dateKey];
        setAvailabilities(nextAvailabilities);
      }
      console.error("Erreur lors de la sauvegarde:", error);
    }
  };

  const handleVacation = async (action: "BLOCK" | "RESTORE") => {
    if (!vacationStart || !vacationEnd || vacationEnd < vacationStart) {
      setVacationFeedback({ type: "error", message: "Sélectionnez une période valide." });
      return;
    }

    try {
      setVacationAction(action);
      setVacationFeedback(null);
      const response = await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: vacationStart,
          endDate: vacationEnd,
          action,
          label: vacationLabel,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "La période n'a pas pu être modifiée.");
      }

      const [selectedYear, selectedMonthNumber] = vacationStart.split("-").map(Number);
      const vacationMonth = new Date(selectedYear, selectedMonthNumber - 1, 1);
      setSelectedMonth(vacationMonth);
      await fetchAvailabilities(vacationMonth);
      setVacationFeedback({
        type: "success",
        message: action === "BLOCK"
          ? `${data.affectedDates} jour(s) bloqué(s) pour tous les services.`
          : "La période est rouverte et les blocages manuels ont été conservés.",
      });
    } catch (error) {
      setVacationFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Une erreur est survenue.",
      });
    } finally {
      setVacationAction(null);
    }
  };

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const currentService = serviceOptions.find((service) => service.value === selectedServiceType) || serviceOptions[0];
  const isHourlyService = isHourlyServiceType(selectedServiceType);
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const currentMonthDateKeys = Array.from({ length: daysInMonth }).map((_, index) => {
    const day = index + 1;
    return new Date(Date.UTC(year, month, day, 12, 0, 0)).toISOString().split("T")[0];
  });
  const unavailableDateKeys = new Set(
    Object.entries(availabilities)
      .filter(([, availability]) => !availability.available || availability.maxSlots <= 0)
      .map(([dateKey]) => dateKey)
  );
  const bookedDateKeys = new Set(Object.keys(bookedDates).filter((dateKey) => bookedDates[dateKey]?.count > 0));
  const blockedDateKeys = new Set([
    ...unavailableDateKeys,
    ...(isHourlyService ? [] : bookedDateKeys),
  ]);
  const unavailableCount = currentMonthDateKeys.filter((dateKey) => unavailableDateKeys.has(dateKey)).length;
  const bookedCount = currentMonthDateKeys.filter((dateKey) => bookedDateKeys.has(dateKey)).length;
  const availableCount = currentMonthDateKeys.filter((dateKey) => {
    const [dateYear, dateMonth, dateDay] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(dateYear, dateMonth - 1, dateDay, 12, 0, 0));
    return date >= today && !blockedDateKeys.has(dateKey);
  }).length;

  if (status === "loading" || isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-3 text-sm font-semibold text-gray-600">Chargement du calendrier...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Administration</p>
          <h1 className="mt-1 text-3xl font-extrabold text-gray-950">Calendrier</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Gérez les disponibilités par service. Un clic bloque ou rouvre une date pour le service sélectionné.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => fetchAvailabilities()} disabled={isLoading}>
          <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Service actif", value: currentService.shortLabel, icon: CalendarDays },
          { label: "Disponibles", value: availableCount.toString(), icon: CheckCircle2 },
          { label: isHourlyService ? "Jours avec passage" : "Réservées", value: bookedCount.toString(), icon: CalendarDays },
          { label: "Bloquées", value: unavailableCount.toString(), icon: XCircle },
          { label: "Mois affiché", value: `${monthNames[month]} ${year}`, icon: CalendarDays },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
              <p className="mt-2 truncate text-2xl font-bold text-gray-950">{stat.value}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-gray-700" aria-hidden="true" />
              <h2 className="text-lg font-bold text-gray-950">Mode vacances</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">Bloque ou rouvre une période pour tous les services.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
          <label className="text-sm font-semibold text-gray-800">
            Du
            <input
              type="date"
              value={vacationStart}
              min={formatDateInput(new Date())}
              onChange={(event) => {
                setVacationStart(event.target.value);
                if (!vacationEnd || vacationEnd < event.target.value) {
                  setVacationEnd(event.target.value);
                }
              }}
              className="mt-1 block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900 outline-none focus:border-gray-950"
            />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Au
            <input
              type="date"
              value={vacationEnd}
              min={vacationStart || formatDateInput(new Date())}
              onChange={(event) => setVacationEnd(event.target.value)}
              className="mt-1 block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900 outline-none focus:border-gray-950"
            />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Libellé
            <input
              type="text"
              value={vacationLabel}
              maxLength={120}
              onChange={(event) => setVacationLabel(event.target.value)}
              placeholder="Vacances, formation, indisponibilité..."
              className="mt-1 block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900 outline-none focus:border-gray-950"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => handleVacation("BLOCK")} disabled={vacationAction !== null} className="bg-red-700 text-white hover:bg-red-800">
            {vacationAction === "BLOCK" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarOff className="h-4 w-4" />}
            Bloquer la période
          </Button>
          <Button type="button" variant="outline" onClick={() => handleVacation("RESTORE")} disabled={vacationAction !== null}>
            {vacationAction === "RESTORE" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Rouvrir la période
          </Button>
        </div>
        {vacationFeedback && (
          <p
            role="status"
            className={`mt-4 rounded-lg border px-3 py-2 text-sm font-semibold ${
              vacationFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {vacationFeedback.message}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-bold text-gray-950">Service à gérer</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {serviceOptions.map((service) => {
              const active = selectedServiceType === service.value;
              return (
                <button
                  key={service.value}
                  type="button"
                  onClick={() => setSelectedServiceType(service.value)}
                  className={`min-h-20 rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xl" aria-hidden="true">{service.icon}</span>
                  <span className="mt-1 block text-sm font-bold">{service.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" onClick={handlePrevMonth} variant="outline">
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-950">
                {monthNames[month]} {year}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{currentService.label}</p>
          </div>
          <Button type="button" onClick={handleNextMonth} variant="outline">
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Disponible par défaut</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-blue-500" />
            <span className="text-xs font-semibold text-gray-700">
              {isHourlyService ? "Passage accepté" : "Réservation acceptée"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-red-500" />
            <span className="text-xs font-semibold text-gray-700">Indisponible manuel</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-gray-300" />
            <span className="text-xs font-semibold text-gray-700">Passé</span>
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
                const bookedDate = bookedDates[dateKey];
                const isBooked = Boolean(bookedDate?.count);
                // PAR DÉFAUT: disponible (vert) si pas défini dans la BDD
                const isManuallyUnavailable = availability ? !availability.available || availability.maxSlots <= 0 : false;
                const isAvailable = !isManuallyUnavailable && (!isBooked || isHourlyService);
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                const bookingPreview = bookedDate?.bookings?.[0];
                const bookingTitle = bookedDate?.bookings?.length
                  ? bookedDate.bookings
                      .map((booking) => `${booking.clientName} · ${booking.petNames}${booking.timeLabel ? ` · ${booking.timeLabel}` : ""}`)
                      .join("\n")
                  : isBooked
                    ? `${bookedDate?.count} réservation(s) acceptée(s)`
                    : undefined;

                return (
                  <button
                    key={day}
                    onClick={() => !isPast && (!isBooked || isHourlyService) && handleDayClick(day)}
                    disabled={isPast || (isBooked && !isHourlyService)}
                    title={bookingTitle}
                    className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border p-1 text-center text-sm font-bold transition ${
                      isPast
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                        : isBooked && !isHourlyService
                        ? "cursor-not-allowed border-blue-300 bg-blue-50 text-blue-900 ring-1 ring-blue-100"
                        : isBooked
                        ? "border-blue-300 bg-blue-50 text-blue-900 ring-1 ring-blue-100 hover:border-blue-500 hover:bg-blue-100"
                        : isAvailable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-100"
                        : "border-red-200 bg-red-50 text-red-800 hover:border-red-500 hover:bg-red-100"
                    }`}
                  >
                    <span>{day}</span>
                    {isBooked && (
                      <>
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none text-white">
                          {isHourlyService ? "Passage" : "Réservé"}
                        </span>
                        {bookingPreview && (
                          <span className="hidden max-w-full truncate text-[10px] font-semibold leading-none text-blue-800 sm:block">
                            {bookingPreview.clientName}
                          </span>
                        )}
                      </>
                    )}
                    {!isBooked && isManuallyUnavailable && (
                      <span className="hidden text-[10px] font-semibold leading-none text-red-700 sm:block">
                        Bloqué
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          {isHourlyService
            ? "Les dates bleues contiennent déjà un passage accepté, mais seuls les créneaux horaires concernés sont occupés. Vous pouvez encore bloquer toute la journée manuellement si besoin."
            : "Les dates bleues viennent des réservations acceptées et bloquent la journée complète. Annulez la réservation pour libérer la date. Les blocages rouges restent des indisponibilités manuelles."}
        </div>
      </section>
    </div>
  );
}
