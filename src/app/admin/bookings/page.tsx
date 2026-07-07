"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";

type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type BookingFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";
type AdminAction = "CONFIRMED" | "CANCELLED";

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  status: BookingStatus;
  totalPrice: number;
  creditsUsed: number;
  serviceType: string;
  cancellationReason?: string | null;
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
    phone?: string | null;
    image?: string | null;
    subscription?: {
      status: string;
      serviceType: string;
      creditsPerMonth: number;
    } | null;
    creditBatches?: {
      remaining: number;
    }[];
  };
  payment?: {
    status: string;
    amount: number;
    stripePaymentId?: string | null;
  } | null;
}

const FILTERS: { id: BookingFilter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "pending", label: "À traiter" },
  { id: "confirmed", label: "Confirmées" },
  { id: "completed", label: "Terminées" },
  { id: "cancelled", label: "Refusées / annulées" },
];

const STATUS_META: Record<BookingStatus, { label: string; className: string }> = {
  PENDING: { label: "À traiter", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  CONFIRMED: { label: "Confirmée", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  IN_PROGRESS: { label: "En cours", className: "bg-blue-50 text-blue-800 ring-blue-200" },
  COMPLETED: { label: "Terminée", className: "bg-gray-100 text-gray-700 ring-gray-200" },
  CANCELLED: { label: "Refusée / annulée", className: "bg-red-50 text-red-800 ring-red-200" },
};

const SERVICE_LABELS: Record<string, string> = {
  BOARDING: "Hébergement",
  HOUSE_SITTING: "Garde au domicile",
  DAY_CARE: "Garderie",
  DROP_IN: "Visite à domicile",
  DOG_WALKING: "Promenade",
};

const PAYMENT_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-gray-100 text-gray-700" },
  PROCESSING: { label: "Empreinte active", className: "bg-blue-50 text-blue-800" },
  SUCCEEDED: { label: "Encaissé", className: "bg-emerald-50 text-emerald-800" },
  FAILED: { label: "Échoué", className: "bg-red-50 text-red-800" },
  REFUNDED: { label: "Libéré / remboursé", className: "bg-purple-50 text-purple-800" },
  PARTIALLY_REFUNDED: { label: "Remboursé partiel", className: "bg-purple-50 text-purple-800" },
};

const getVisitSlots = (booking: Booking) =>
  booking.serviceDetails?.visitSlots?.filter((slot) => slot.date) || [];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatMoney = (value: number) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getPetNames = (booking: Booking) =>
  booking.pets.length > 0
    ? booking.pets.map((pet) => pet.name).join(", ")
    : booking.pet?.name || "Animal non renseigné";

const getPetBreeds = (booking: Booking) =>
  booking.pets.length > 0
    ? booking.pets.map((pet) => pet.breed || "Race non renseignée").join(", ")
    : booking.pet?.breed || "Race non renseignée";

const getFilterStatus = (filter: BookingFilter): BookingStatus | null => {
  if (filter === "pending") return "PENDING";
  if (filter === "confirmed") return "CONFIRMED";
  if (filter === "completed") return "COMPLETED";
  if (filter === "cancelled") return "CANCELLED";
  return null;
};

const getPaymentLabel = (booking: Booking) => {
  if (booking.creditsUsed > 0) return `${booking.creditsUsed} crédit${booking.creditsUsed > 1 ? "s" : ""}`;
  return `${formatMoney(booking.totalPrice)} €`;
};

const getActionTitle = (action: AdminAction) =>
  action === "CONFIRMED" ? "Accepter la réservation" : "Refuser la réservation";

export default function AdminBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionDialog, setActionDialog] = useState<{
    booking: Booking;
    action: AdminAction;
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionConfirmed, setActionConfirmed] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  const fetchBookings = useCallback(async () => {
    if (status !== "authenticated") return;

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/bookings?filter=all");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Impossible de charger les réservations.");
      }
      setBookings(data.bookings || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger les réservations.");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (session?.user?.role === "ADMIN" || session?.user?.role === "SITTER") {
      fetchBookings();
    }
  }, [session, fetchBookings]);

  const counts = useMemo(() => {
    const base = { all: bookings.length, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookings.forEach((booking) => {
      if (booking.status === "PENDING") base.pending += 1;
      if (booking.status === "CONFIRMED") base.confirmed += 1;
      if (booking.status === "COMPLETED") base.completed += 1;
      if (booking.status === "CANCELLED") base.cancelled += 1;
    });
    return base;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const statusFilter = getFilterStatus(filter);
    const query = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (statusFilter && booking.status !== statusFilter) return false;
      if (!query) return true;

      return [
        booking.client.name,
        booking.client.email,
        booking.client.phone || "",
        getPetNames(booking),
        getPetBreeds(booking),
        SERVICE_LABELS[booking.serviceType] || booking.serviceType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bookings, filter, search]);

  const openActionDialog = (booking: Booking, action: AdminAction) => {
    setActionDialog({ booking, action });
    setActionReason("");
    setActionConfirmed(action === "CONFIRMED");
    setError("");
    setNotice("");
  };

  const closeActionDialog = () => {
    if (actionLoading) return;
    setActionDialog(null);
    setActionReason("");
    setActionConfirmed(false);
  };

  const submitStatusChange = async () => {
    if (!actionDialog) return;

    const { booking, action } = actionDialog;
    setActionLoading(booking.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: action,
          reason: actionReason.trim() || undefined,
          confirmed: action === "CANCELLED" ? actionConfirmed : undefined,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Impossible de modifier cette réservation.");
      }

      setNotice(
        action === "CONFIRMED"
          ? "Réservation acceptée. Le paiement a été capturé si nécessaire."
          : "Réservation refusée. L'empreinte, le paiement ou les crédits ont été traités."
      );
      setActionDialog(null);
      await fetchBookings();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de modifier cette réservation.");
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading") return null;

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SITTER") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-3 text-xl font-bold text-gray-950">Accès réservé</h1>
          <p className="mt-2 text-sm text-gray-600">Cette page est réservée à l&apos;équipe.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin/dashboard" className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Administration</p>
            <h1 className="truncate text-lg font-bold text-gray-950">Réservations</h1>
          </Link>
          <UserMenu variant="light" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">Demandes clients</h2>
            <p className="mt-1 text-sm text-gray-600">
              Acceptez uniquement quand la prestation est faisable. Refuser libère l&apos;empreinte Stripe ou recrédite le client.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Client, email, animal..."
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-950 outline-none transition focus:border-gray-950 sm:w-72"
              />
            </div>
            <Button type="button" variant="outline" onClick={fetchBookings} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  active
                    ? "border-gray-950 bg-gray-950 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className={`text-2xl font-bold ${active ? "text-white" : "text-gray-950"}`}>
                  {counts[item.id]}
                </span>
                <span className="mt-1 block text-sm font-semibold">{item.label}</span>
              </button>
            );
          })}
        </section>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {notice}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-gray-500" />
            <p className="mt-3 text-sm font-semibold text-gray-600">Chargement des réservations...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <CalendarDays className="mx-auto h-9 w-9 text-gray-400" />
            <h3 className="mt-3 text-lg font-bold text-gray-950">Aucune réservation</h3>
            <p className="mt-1 text-sm text-gray-600">Aucun résultat avec ces filtres.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBookings.map((booking) => {
              const statusMeta = STATUS_META[booking.status];
              const paymentMeta = booking.payment
                ? PAYMENT_META[booking.payment.status] || PAYMENT_META.PENDING
                : null;
              const visitSlots = getVisitSlots(booking);
              const isWorking = actionLoading === booking.id;
              const isClub = booking.client.subscription?.status === "ACTIVE";

              return (
                <article key={booking.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="grid gap-5 p-5 lg:grid-cols-3">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {SERVICE_LABELS[booking.serviceType] || booking.serviceType}
                        </span>
                        {isClub && (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            Club actif
                          </span>
                        )}
                      </div>

                      <h3 className="truncate text-lg font-bold text-gray-950">
                        {booking.client.name || "Client sans nom"}
                      </h3>
                      <div className="mt-2 grid gap-1 text-sm text-gray-600">
                        <a className="inline-flex min-w-0 items-center gap-2 hover:text-gray-950" href={`mailto:${booking.client.email}`}>
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{booking.client.email}</span>
                        </a>
                        {booking.client.phone && (
                          <a className="inline-flex items-center gap-2 hover:text-gray-950" href={`tel:${booking.client.phone}`}>
                            <Phone className="h-4 w-4 shrink-0" />
                            {booking.client.phone}
                          </a>
                        )}
                      </div>

                      <div className="mt-4 rounded-lg bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Animaux</p>
                        <p className="mt-1 font-bold text-gray-950">{getPetNames(booking)}</p>
                        <p className="text-sm text-gray-600">{getPetBreeds(booking)}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <Clock3 className="h-4 w-4" />
                          Période
                        </p>
                        <p className="mt-2 font-bold text-gray-950">
                          {formatDate(booking.startDate)} au {formatDate(booking.endDate)}
                        </p>
                        {(booking.startTime || booking.endTime) && (
                          <p className="mt-1 text-sm text-gray-600">
                            {booking.startTime || "--:--"} - {booking.endTime || "--:--"}
                          </p>
                        )}
                      </div>

                      {visitSlots.length > 0 && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                          <p className="font-bold">{visitSlots.length} passage{visitSlots.length > 1 ? "s" : ""}</p>
                          <div className="mt-2 space-y-1">
                            {visitSlots.slice(0, 4).map((slot, index) => (
                              <p key={`${slot.date}-${slot.startTime}-${index}`}>
                                {formatDate(slot.date)} à {slot.startTime} · {slot.duration} min
                              </p>
                            ))}
                            {visitSlots.length > 4 && <p>+ {visitSlots.length - 4} autre{visitSlots.length > 5 ? "s" : ""}</p>}
                          </div>
                        </div>
                      )}

                      {booking.serviceDetails?.serviceAddress && (
                        <div className="flex gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                          <span>{booking.serviceDetails.serviceAddress}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-between gap-4">
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <CreditCard className="h-4 w-4" />
                          Paiement
                        </p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{getPaymentLabel(booking)}</p>
                        {paymentMeta && (
                          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentMeta.className}`}>
                            {paymentMeta.label}
                          </span>
                        )}
                        {booking.payment?.stripePaymentId && (
                          <p className="mt-2 break-all font-mono text-[11px] text-gray-500">
                            {booking.payment.stripePaymentId}
                          </p>
                        )}
                        {booking.cancellationReason && (
                          <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-800">
                            Motif : {booking.cancellationReason}
                          </p>
                        )}
                      </div>

                      <div className="grid gap-2">
                        {booking.status === "PENDING" && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              onClick={() => openActionDialog(booking, "CONFIRMED")}
                              disabled={isWorking}
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Accepter
                            </Button>
                            <Button
                              type="button"
                              onClick={() => openActionDialog(booking, "CANCELLED")}
                              disabled={isWorking}
                              variant="destructive"
                            >
                              <XCircle className="h-4 w-4" />
                              Refuser
                            </Button>
                          </div>
                        )}

                        {booking.status === "CONFIRMED" && (
                          <Button
                            type="button"
                            onClick={() => openActionDialog(booking, "CANCELLED")}
                            disabled={isWorking}
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                            Annuler
                          </Button>
                        )}

                        {isWorking && (
                          <p className="text-center text-xs font-semibold text-gray-500">Traitement en cours...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {actionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-500">Action admin</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">{getActionTitle(actionDialog.action)}</h3>
              </div>
              <button
                type="button"
                onClick={closeActionDialog}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-bold text-gray-950">{actionDialog.booking.client.name}</p>
              <p className="mt-1">{SERVICE_LABELS[actionDialog.booking.serviceType] || actionDialog.booking.serviceType} · {getPetNames(actionDialog.booking)}</p>
              <p className="mt-1">{formatDate(actionDialog.booking.startDate)} au {formatDate(actionDialog.booking.endDate)}</p>
              <p className="mt-1 font-semibold">{getPaymentLabel(actionDialog.booking)}</p>
            </div>

            {actionDialog.action === "CANCELLED" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-bold">Ce refus va traiter le paiement.</p>
                  <p className="mt-1 leading-6">
                    Si une empreinte Stripe existe, elle sera libérée. Si le paiement a déjà été capturé, un remboursement sera demandé. Si la réservation a utilisé des crédits, ils seront recrédités.
                  </p>
                </div>
                <div>
                  <label htmlFor="cancel-reason" className="text-sm font-bold text-gray-900">
                    Motif interne
                  </label>
                  <textarea
                    id="cancel-reason"
                    value={actionReason}
                    onChange={(event) => setActionReason(event.target.value)}
                    placeholder="Ex : indisponibilité, doublon, informations client insuffisantes..."
                    className="mt-2 h-28 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none transition focus:border-gray-950"
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">{actionReason.length}/500 caractères</p>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={actionConfirmed}
                    onChange={(event) => setActionConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-red-600"
                  />
                  <span>Je confirme le refus et le traitement associé du paiement ou des crédits.</span>
                </label>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <p className="font-bold">Cette action confirme la prestation.</p>
                <p className="mt-1 leading-6">
                  Si une empreinte Stripe est présente, elle sera capturée. Un email de confirmation sera envoyé au client.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeActionDialog} disabled={Boolean(actionLoading)}>
                Retour
              </Button>
              <Button
                type="button"
                onClick={submitStatusChange}
                disabled={Boolean(actionLoading) || (actionDialog.action === "CANCELLED" && !actionConfirmed)}
                className={actionDialog.action === "CANCELLED" ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}
              >
                {actionLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Traitement
                  </>
                ) : actionDialog.action === "CANCELLED" ? (
                  "Confirmer le refus"
                ) : (
                  "Confirmer l'acceptation"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
