"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Euro,
  PawPrint,
  ShieldCheck,
  TicketPercent,
  UsersRound,
} from "lucide-react";
import { getServiceLabel } from "@/lib/services";

interface Stats {
  totalBookings: number;
  pendingBookings: number;
  totalClients: number;
  totalRevenue: number;
}

interface Booking {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  serviceType: string;
  totalPrice: number;
  pets: { name: string }[];
  pet?: { name: string } | null;
  client: {
    name: string | null;
    subscription?: { status: string } | null;
  };
}

interface AdminDashboardClientProps {
  stats: Stats;
  upcomingBookings: Booking[];
}

const formatMoney = (amount: number) =>
  amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });

const statusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "À traiter", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  CONFIRMED: { label: "Confirmée", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  IN_PROGRESS: { label: "En cours", className: "bg-blue-50 text-blue-800 ring-blue-200" },
  COMPLETED: { label: "Terminée", className: "bg-gray-100 text-gray-700 ring-gray-200" },
  CANCELLED: { label: "Annulée", className: "bg-red-50 text-red-800 ring-red-200" },
};

function getPetNames(booking: Booking) {
  if (booking.pets.length > 0) return booking.pets.map((pet) => pet.name).join(", ");
  return booking.pet?.name || "Animal non renseigné";
}

export function AdminDashboardClient({ stats, upcomingBookings }: AdminDashboardClientProps) {
  const hasPendingBookings = stats.pendingBookings > 0;

  const metrics = [
    {
      label: "Réservations",
      value: stats.totalBookings.toString(),
      detail: `${stats.pendingBookings} à traiter`,
      href: "/admin/bookings",
      icon: CalendarDays,
    },
    {
      label: "Demandes en attente",
      value: stats.pendingBookings.toString(),
      detail: hasPendingBookings ? "Action requise" : "File claire",
      href: "/admin/bookings?filter=pending",
      icon: Clock3,
      urgent: hasPendingBookings,
    },
    {
      label: "Clients",
      value: stats.totalClients.toString(),
      detail: "Comptes clients",
      href: "/admin/clients",
      icon: UsersRound,
    },
    {
      label: "Revenus encaissés",
      value: `${formatMoney(stats.totalRevenue)} €`,
      detail: "Paiements réussis",
      href: "/admin/revenue",
      icon: Euro,
    },
  ];

  const actions = [
    {
      title: "Traiter les réservations",
      description: "Accepter, refuser et vérifier les paiements.",
      href: "/admin/bookings",
      icon: CheckCircle2,
      primary: true,
    },
    {
      title: "Gérer le calendrier",
      description: "Disponibilités, vacances et blocages.",
      href: "/admin/calendar",
      icon: CalendarClock,
    },
    {
      title: "Suivre les clients",
      description: "Abonnements, crédits et profils.",
      href: "/admin/clients",
      icon: UsersRound,
    },
    {
      title: "Codes promo",
      description: "Créer et contrôler les remises.",
      href: "/admin/coupons",
      icon: TicketPercent,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-orange-700">Administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
            Vue d&apos;ensemble
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Pilotez les réservations, les disponibilités et les revenus depuis un espace aligné avec l&apos;expérience client.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/admin/bookings"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Réservations
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/admin/calendar"
            className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            Calendrier
          </Link>
        </div>
      </section>

      {hasPendingBookings && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="font-bold">
                  {stats.pendingBookings} demande{stats.pendingBookings > 1 ? "s" : ""} à traiter
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Traitez-les avant qu&apos;un client reste bloqué dans le paiement ou l&apos;attente de confirmation.
                </p>
              </div>
            </div>
            <Link
              href="/admin/bookings"
              className="inline-flex h-9 items-center justify-center rounded-md bg-amber-900 px-3 text-sm font-semibold text-white transition hover:bg-amber-800"
            >
              Ouvrir
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link
              key={metric.label}
              href={metric.href}
              className={`rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                metric.urgent ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-950">{metric.value}</p>
                </div>
                <span className={`rounded-md p-2 ${metric.urgent ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <p className={`mt-3 text-sm font-medium ${metric.urgent ? "text-amber-800" : "text-gray-500"}`}>
                {metric.detail}
              </p>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-950">Actions rapides</h2>
            <p className="mt-1 text-sm text-gray-600">Les tâches d&apos;exploitation les plus fréquentes.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`group rounded-lg border p-4 transition hover:border-gray-300 hover:bg-gray-50 ${
                    action.primary ? "border-gray-950 bg-gray-950 text-white hover:bg-gray-900" : "border-gray-200 bg-white text-gray-950"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`rounded-md p-2 ${action.primary ? "bg-white/10 text-white" : "bg-orange-50 text-orange-700"}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{action.title}</p>
                      <p className={`mt-1 text-sm leading-5 ${action.primary ? "text-gray-300" : "text-gray-600"}`}>
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className={`mt-1 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${action.primary ? "text-white" : "text-gray-400"}`} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-5">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Prochaines réservations</h2>
              <p className="mt-1 text-sm text-gray-600">Les 5 prochaines prestations à surveiller.</p>
            </div>
            <Link href="/admin/bookings" className="text-sm font-bold text-orange-700 hover:text-orange-800">
              Voir tout
            </Link>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="p-10 text-center">
              <PawPrint className="mx-auto h-9 w-9 text-gray-400" aria-hidden="true" />
              <h3 className="mt-3 font-bold text-gray-950">Aucune réservation à venir</h3>
              <p className="mt-1 text-sm text-gray-600">Les prochaines demandes apparaîtront ici.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingBookings.map((booking) => {
                const meta = statusMeta[booking.status] || { label: booking.status, className: "bg-gray-100 text-gray-700 ring-gray-200" };
                const isClub = booking.client.subscription?.status === "ACTIVE";

                return (
                  <Link
                    key={booking.id}
                    href="/admin/bookings"
                    className="block p-4 transition hover:bg-gray-50 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${meta.className}`}>
                            {meta.label}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {getServiceLabel(booking.serviceType)}
                          </span>
                          {isClub && (
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200">
                              Club
                            </span>
                          )}
                        </div>
                        <p className="mt-2 truncate font-bold text-gray-950">{getPetNames(booking)}</p>
                        <p className="mt-1 truncate text-sm text-gray-600">
                          {booking.client.name || "Client sans nom"}
                        </p>
                      </div>

                      <div className="flex items-end justify-between gap-4 sm:block sm:text-right">
                        <p className="text-sm font-bold text-gray-950">
                          {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-600">
                          {formatMoney(booking.totalPrice)} €
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Link href="/admin/calendar-sync" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50">
          <CalendarClock className="h-5 w-5 text-gray-700" aria-hidden="true" />
          <p className="mt-3 font-bold text-gray-950">Synchronisation calendrier</p>
          <p className="mt-1 text-sm text-gray-600">Brancher le planning externe et éviter les doubles réservations.</p>
        </Link>
        <Link href="/admin/reviews" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50">
          <ShieldCheck className="h-5 w-5 text-gray-700" aria-hidden="true" />
          <p className="mt-3 font-bold text-gray-950">Avis clients</p>
          <p className="mt-1 text-sm text-gray-600">Contrôler la preuve sociale affichée sur le site.</p>
        </Link>
        <Link href="/admin/revenue" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50">
          <CreditCard className="h-5 w-5 text-gray-700" aria-hidden="true" />
          <p className="mt-3 font-bold text-gray-950">Finance</p>
          <p className="mt-1 text-sm text-gray-600">Suivre les paiements capturés et les revenus.</p>
        </Link>
      </section>
    </div>
  );
}
