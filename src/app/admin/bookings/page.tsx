"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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

type BookingStatus = "PENDING" | "ACCEPTING" | "CANCELLING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type BookingFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";
type AdminAction = "CONFIRMED" | "CANCELLED" | "COMPLETED";

interface PriceBreakdownLine {
  label: string;
  unitPrice: number;
  quantity: number;
  total: number;
  type: "base" | "surcharge" | "discount" | "info";
}

interface PriceBreakdown {
  subtotal: number;
  total: number;
  pets: {
    petId: string;
    petName: string;
    subtotal: number;
    lines: PriceBreakdownLine[];
  }[];
  sharedLines: PriceBreakdownLine[];
  adjustments: { label: string; amount: number }[];
}

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  status: BookingStatus;
  totalPrice: number;
  serviceType: string;
  priceBreakdown?: PriceBreakdown | null;
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
    } | null;
  };
  payment?: {
    status: string;
    amount: number;
    stripePaymentId?: string | null;
  } | null;
  reviewRequest?: {
    sentAt: string;
    submittedAt?: string | null;
    serviceRating?: number | null;
    serviceComment?: string | null;
    websiteRating?: number | null;
    websiteComment?: string | null;
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
  ACCEPTING: { label: "Validation en cours", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  CANCELLING: { label: "Annulation en cours", className: "bg-orange-50 text-orange-800 ring-orange-200" },
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

const getNightCount = (booking: Booking) =>
  Math.max(0, Math.round(
    (new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / (24 * 60 * 60 * 1000)
  ));

const getPriceUnit = (serviceType: string, quantity: number) => {
  if (serviceType === "BOARDING") return quantity > 1 ? "nuits" : "nuit";
  if (serviceType === "DROP_IN") return quantity > 1 ? "visites" : "visite";
  if (serviceType === "DOG_WALKING") return quantity > 1 ? "promenades" : "promenade";
  return quantity > 1 ? "jours" : "jour";
};

const formatSignedMoney = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatMoney(Math.abs(value))} €`;

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
  return `${formatMoney(booking.totalPrice)} €`;
};

const getReviewRequestMeta = (booking: Booking) => {
  if (!booking.reviewRequest) {
    return {
      label: "Avis non envoyé",
      className: "bg-gray-100 text-gray-700 ring-gray-200",
      detail: "Aucune demande d'avis envoyée",
    };
  }

  if (booking.reviewRequest.submittedAt) {
    return {
      label: "Réponse reçue",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      detail: `Répondu le ${formatDate(booking.reviewRequest.submittedAt)}`,
    };
  }

  return {
    label: "Avis demandé",
    className: "bg-orange-50 text-orange-800 ring-orange-200",
    detail: `Envoyé le ${formatDate(booking.reviewRequest.sentAt)}`,
  };
};

const getActionTitle = (action: AdminAction) =>
  action === "CONFIRMED"
    ? "Accepter la réservation"
    : action === "COMPLETED"
      ? "Terminer la prestation"
      : "Refuser la réservation";

export default function AdminBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  const [reviewEmailLoading, setReviewEmailLoading] = useState<string | null>(null);
  const [reviewPreviewEmailLoading, setReviewPreviewEmailLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionDialog, setActionDialog] = useState<{
    booking: Booking;
    action: AdminAction;
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionConfirmed, setActionConfirmed] = useState(false);
  const [expandedVisitBookingIds, setExpandedVisitBookingIds] = useState<Set<string>>(() => new Set());

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
      if (["PENDING", "ACCEPTING", "CANCELLING"].includes(booking.status)) base.pending += 1;
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
      if (
        statusFilter &&
        booking.status !== statusFilter &&
        !(filter === "pending" && ["ACCEPTING", "CANCELLING"].includes(booking.status))
      ) return false;
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

  const toggleVisitSlots = (bookingId: string) => {
    setExpandedVisitBookingIds((current) => {
      const next = new Set(current);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
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

      if (action === "CONFIRMED") {
        setNotice(
          data?.confirmationEmailSent === false
            ? `Réservation acceptée, mais l'email n'a pas pu partir : ${data?.confirmationEmailError || "erreur Resend"}`
            : "Réservation acceptée. Le paiement a été capturé si nécessaire et l'email de confirmation a été envoyé."
        );
      } else if (action === "COMPLETED") {
        setNotice(
          data?.reviewRequestEmailSent === false
            ? `Prestation terminée, mais l'email d'avis n'a pas pu partir : ${data?.reviewRequestEmailError || "erreur Resend"}`
            : "Prestation terminée. L'email de demande d'avis a été envoyé."
        );
      } else {
        setNotice(
          data?.rejectionEmailSent === false
            ? `Réservation refusée, mais l'email n'a pas pu partir : ${data?.rejectionEmailError || "erreur Resend"}`
            : "Réservation refusée. Le paiement a été traité et l'email avec le motif a été envoyé au client."
        );
      }
      setActionDialog(null);
      await fetchBookings();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de modifier cette réservation.");
    } finally {
      setActionLoading(null);
    }
  };

  const resendConfirmationEmail = async (booking: Booking) => {
    setEmailLoading(booking.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/resend-confirmation`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Impossible de renvoyer la confirmation.");
      }

      setNotice(`Email de confirmation renvoyé à ${booking.client.email}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de renvoyer la confirmation.");
    } finally {
      setEmailLoading(null);
    }
  };

  const sendReviewRequestEmail = async (booking: Booking) => {
    setReviewEmailLoading(booking.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/send-review-request`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Impossible d'envoyer la demande d'avis.");
      }

      setNotice(`Email de demande d'avis envoyé à ${booking.client.email}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible d'envoyer la demande d'avis.");
    } finally {
      setReviewEmailLoading(null);
    }
  };

  const sendReviewRequestPreviewEmail = async (booking: Booking) => {
    setReviewPreviewEmailLoading(booking.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/send-review-request-preview`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Impossible d'envoyer le test de demande d'avis.");
      }

      setNotice("Email test de demande d'avis envoyé à votre adresse admin.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible d'envoyer le test de demande d'avis.");
    } finally {
      setReviewPreviewEmailLoading(null);
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
    <>
        <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Administration</p>
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
              const isActionWorking = actionLoading === booking.id;
              const isEmailWorking = emailLoading === booking.id;
              const isReviewEmailWorking = reviewEmailLoading === booking.id;
              const isReviewPreviewEmailWorking = reviewPreviewEmailLoading === booking.id;
              const isWorking = isActionWorking || isEmailWorking || isReviewEmailWorking || isReviewPreviewEmailWorking;
              const isPremium = booking.client.subscription?.status === "ACTIVE";
              const isVisitSlotsExpanded = expandedVisitBookingIds.has(booking.id);
              const visibleVisitSlots = isVisitSlotsExpanded ? visitSlots : visitSlots.slice(0, 4);
              const hiddenVisitSlotsCount = Math.max(visitSlots.length - visibleVisitSlots.length, 0);
              const canResendConfirmation = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
              const canSendReviewRequest = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
              const reviewMeta = getReviewRequestMeta(booking);

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
                        {isPremium && (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            Priorité Premium
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
                        {booking.serviceType === "BOARDING" ? (
                          <div className="mt-2 space-y-1.5 text-sm text-gray-700">
                            <p>
                              <span className="font-bold text-gray-950">Arrivée :</span>{" "}
                              {formatDate(booking.startDate)} à {booking.startTime || "heure à convenir"}
                            </p>
                            <p>
                              <span className="font-bold text-gray-950">Départ :</span>{" "}
                              {formatDate(booking.endDate)} à {booking.endTime || "heure à convenir"}
                            </p>
                            <p className="pt-1 text-xs font-semibold text-orange-700">
                              {getNightCount(booking)} nuit{getNightCount(booking) > 1 ? "s" : ""}
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="mt-2 font-bold text-gray-950">
                              {formatDate(booking.startDate)} au {formatDate(booking.endDate)}
                            </p>
                            {(booking.startTime || booking.endTime) && !["DROP_IN", "DOG_WALKING"].includes(booking.serviceType) && (
                              <p className="mt-1 text-sm text-gray-600">
                                {booking.serviceType === "HOUSE_SITTING" ? "Horaires chaque jour : " : "Horaires : "}
                                {booking.startTime || "--:--"}–{booking.endTime || "--:--"}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {visitSlots.length > 0 && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                          <p className="font-bold">{visitSlots.length} passage{visitSlots.length > 1 ? "s" : ""}</p>
                          <div className={`mt-2 space-y-1 ${isVisitSlotsExpanded ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
                            {visibleVisitSlots.map((slot, index) => (
                              <p key={`${slot.date}-${slot.startTime}-${index}`}>
                                {formatDate(slot.date)} à {slot.startTime} · {slot.duration} min
                              </p>
                            ))}
                          </div>
                          {visitSlots.length > 4 && (
                            <button
                              type="button"
                              onClick={() => toggleVisitSlots(booking.id)}
                              className="mt-3 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-900 transition hover:border-blue-300 hover:bg-blue-100"
                            >
                              {isVisitSlotsExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" />
                                  Réduire la liste
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  Voir les {hiddenVisitSlotsCount} autre{hiddenVisitSlotsCount > 1 ? "s" : ""} date{hiddenVisitSlotsCount > 1 ? "s" : ""}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {booking.serviceDetails?.serviceAddress && (
                        <div className="flex gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                          <span>{booking.serviceDetails.serviceAddress}</span>
                        </div>
                      )}

                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <Mail className="h-4 w-4" />
                            Avis client
                          </p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${reviewMeta.className}`}>
                            {reviewMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{reviewMeta.detail}</p>
                        {booking.reviewRequest?.submittedAt && (
                          <div className="mt-3 space-y-3 text-sm">
                            <div className="rounded-md bg-emerald-50 p-3 text-emerald-950">
                              <p className="font-bold">
                                Prestation : {booking.reviewRequest.serviceRating || "-"} / 5
                              </p>
                              {booking.reviewRequest.serviceComment && (
                                <p className="mt-1 whitespace-pre-wrap leading-6 text-emerald-900">
                                  &ldquo;{booking.reviewRequest.serviceComment}&rdquo;
                                </p>
                              )}
                            </div>
                            {(booking.reviewRequest.websiteRating || booking.reviewRequest.websiteComment) && (
                              <div className="rounded-md bg-blue-50 p-3 text-blue-950">
                                <p className="font-bold">
                                  Site internet : {booking.reviewRequest.websiteRating || "-"} / 5
                                </p>
                                {booking.reviewRequest.websiteComment && (
                                  <p className="mt-1 whitespace-pre-wrap leading-6 text-blue-900">
                                    &ldquo;{booking.reviewRequest.websiteComment}&rdquo;
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
                        {booking.priceBreakdown && (
                          <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 text-xs">
                            <p className="font-bold uppercase tracking-wide text-gray-500">Détail du prix</p>
                            {booking.priceBreakdown.pets.map((pet) => (
                              <div key={pet.petId} className="rounded-md bg-gray-50 p-2.5">
                                <div className="mb-2 flex items-center justify-between gap-3 font-bold text-gray-950">
                                  <span>{pet.petName}</span>
                                  <span>{formatMoney(pet.subtotal)} €</span>
                                </div>
                                <div className="space-y-2 text-gray-600">
                                  {pet.lines.map((line, index) => (
                                    <div key={`${line.label}-${index}`} className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="font-medium text-gray-800">{line.label}</p>
                                        <p className="mt-0.5 text-[11px] text-gray-500">
                                          {line.type === "base"
                                            ? `${line.quantity} ${getPriceUnit(booking.serviceType, line.quantity)} × ${formatMoney(Math.abs(line.unitPrice))} €`
                                            : line.quantity > 1
                                              ? `${line.quantity} × ${formatMoney(Math.abs(line.unitPrice))} €`
                                              : `Tarif : ${formatMoney(Math.abs(line.unitPrice))} €`}
                                        </p>
                                      </div>
                                      <span className="shrink-0 font-semibold text-gray-800">
                                        {line.type === "base" ? `${formatMoney(line.total)} €` : formatSignedMoney(line.total)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {booking.priceBreakdown.sharedLines.map((line, index) => (
                              <div key={`${line.label}-${index}`} className="flex items-start justify-between gap-3 text-gray-700">
                                <span>{line.label}</span>
                                <span className="shrink-0 font-semibold">{formatSignedMoney(line.total)}</span>
                              </div>
                            ))}
                            {(booking.priceBreakdown.adjustments.length > 0 || booking.priceBreakdown.subtotal !== booking.priceBreakdown.total) && (
                              <div className="space-y-2 border-t border-gray-200 pt-2">
                                <div className="flex justify-between gap-3 text-gray-600">
                                  <span>Sous-total</span>
                                  <span>{formatMoney(booking.priceBreakdown.subtotal)} €</span>
                                </div>
                                {booking.priceBreakdown.adjustments.map((adjustment, index) => (
                                  <div key={`${adjustment.label}-${index}`} className={`flex justify-between gap-3 font-bold ${adjustment.amount <= 0 ? "text-emerald-700" : "text-orange-700"}`}>
                                    <span>{adjustment.label}</span>
                                    <span>{formatSignedMoney(adjustment.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex justify-between gap-3 border-t border-gray-200 pt-2 text-sm font-bold text-gray-950">
                              <span>Total vérifié</span>
                              <span>{formatMoney(booking.priceBreakdown.total)} €</span>
                            </div>
                          </div>
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

                        {canResendConfirmation && (
                          <Button
                            type="button"
                            onClick={() => resendConfirmationEmail(booking)}
                            disabled={isWorking}
                            variant="outline"
                          >
                            {isEmailWorking ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            Renvoyer confirmation
                          </Button>
                        )}

                        {canSendReviewRequest && (
                          <Button
                            type="button"
                            onClick={() => sendReviewRequestPreviewEmail(booking)}
                            disabled={isWorking}
                            variant="outline"
                            className="border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            {isReviewPreviewEmailWorking ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            M&apos;envoyer un test
                          </Button>
                        )}

                        {canSendReviewRequest && (
                          <Button
                            type="button"
                            onClick={() => sendReviewRequestEmail(booking)}
                            disabled={isWorking}
                            variant="outline"
                            className="border-orange-200 text-orange-700 hover:bg-orange-50"
                          >
                            {isReviewEmailWorking ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            Envoyer demande d&apos;avis
                          </Button>
                        )}

                        {booking.status === "CONFIRMED" && (
                          <Button
                            type="button"
                            onClick={() => openActionDialog(booking, "COMPLETED")}
                            disabled={isWorking}
                            className="bg-gray-900 text-white hover:bg-orange-600"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Terminer
                          </Button>
                        )}

                        {booking.status === "IN_PROGRESS" && (
                          <Button
                            type="button"
                            onClick={() => openActionDialog(booking, "COMPLETED")}
                            disabled={isWorking}
                            className="bg-gray-900 text-white hover:bg-orange-600"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Terminer
                          </Button>
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

                        {isActionWorking && (
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

      {actionDialog && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center">
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
                    Si une empreinte Stripe existe, elle sera libérée. Si le paiement a déjà été capturé, un remboursement sera demandé. Le client recevra ensuite un email avec le motif ci-dessous.
                  </p>
                </div>
                <div>
                  <label htmlFor="cancel-reason" className="text-sm font-bold text-gray-900">
                    Motif envoyé au client
                  </label>
                  <textarea
                    id="cancel-reason"
                    value={actionReason}
                    onChange={(event) => setActionReason(event.target.value)}
                    placeholder="Expliquez clairement pourquoi la demande ne peut pas être acceptée..."
                    className="mt-2 h-28 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none transition focus:border-gray-950"
                    maxLength={500}
                    required
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
                  <span>Je confirme le refus et le traitement associé du paiement.</span>
                </label>
              </div>
            ) : actionDialog.action === "COMPLETED" ? (
              <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
                <p className="font-bold">Cette action termine la prestation.</p>
                <p className="mt-1 leading-6">
                  La réservation passera en terminée et un email demandera au client son avis sur la prestation et sur le site internet.
                </p>
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
                disabled={
                  Boolean(actionLoading) ||
                  (actionDialog.action === "CANCELLED" && (!actionConfirmed || !actionReason.trim()))
                }
                className={
                  actionDialog.action === "CANCELLED"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : actionDialog.action === "COMPLETED"
                      ? "bg-orange-600 text-white hover:bg-orange-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                }
              >
                {actionLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Traitement
                  </>
                ) : actionDialog.action === "CANCELLED" ? (
                  "Confirmer le refus"
                ) : actionDialog.action === "COMPLETED" ? (
                  "Terminer la prestation"
                ) : (
                  "Confirmer l'acceptation"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
