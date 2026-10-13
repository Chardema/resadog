"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BadgePercent,
  CalendarDays,
  CircleDollarSign,
  Crown,
  LoaderCircle,
  Mail,
  FileText,
  PawPrint,
  Plus,
  RefreshCw,
  Search,
  Star,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL";
  discountValue: number;
  isActive: boolean;
}

interface Subscription {
  status: string;
  price?: number;
}

interface ClientPet {
  id: string;
  name: string;
  species: "DOG" | "CAT";
  birthDate: string | null;
  birthDateProofUrl: string | null;
  birthDateVerifiedAt: string | null;
}

interface Client {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  autoApplyCoupon: Coupon | null;
  subscription: Subscription | null;
  pets: ClientPet[];
  stats: {
    totalBookings: number;
    completedBookings: number;
    validatedBookings: number;
    totalSpent: number;
    loyaltyPaws: number;
    loyalty: {
      tier: {
        name: string;
        benefits: string[];
      };
      nextTier: { name: string } | null;
      pawsToNextTier: number;
      nextReward: { label: string } | null;
      pawsToNextReward: number;
    };
    lastBooking: {
      id: string;
      status: string;
      paymentStatus: string | null;
      totalPrice: number;
      startDate: string;
    } | null;
  };
}

type SubscriptionRefundInvoice = {
  id: string;
  number: string | null;
  createdAt: string;
  currency: string;
  amountPaid: number;
  alreadyRefunded: number;
  refundableAmount: number;
  latestRefundStatus: string | null;
};

type SubscriptionRefundDialog = {
  client: Client;
  invoice: SubscriptionRefundInvoice;
};

type ClientFilter = "ALL" | "PREMIUM" | "VIP" | "ACTIVE";

const filters: Array<{ id: ClientFilter; label: string }> = [
  { id: "ALL", label: "Tous" },
  { id: "PREMIUM", label: "Premium" },
  { id: "VIP", label: "Code VIP" },
  { id: "ACTIVE", label: "Avec réservations" },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const formatDiscount = (coupon: Coupon) =>
  coupon.discountType === "CUSTOM_TOTAL"
    ? `${formatMoney(coupon.discountValue)} final`
    : coupon.discountType === "PERCENTAGE"
    ? `${coupon.discountValue}%`
    : formatMoney(coupon.discountValue);

const subscriptionLabels: Record<string, string> = {
  ACTIVE: "Premium actif",
  PAST_DUE: "Premium impayé",
  CANCELED: "Premium résilié",
  CANCELED_REMOTE: "Premium résilié",
};

const bookingStatusLabels: Record<string, string> = {
  PENDING: "Demande envoyée",
  ACCEPTING: "Validation en cours",
  CANCELLING: "Annulation en cours",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Paiement en attente",
  PROCESSING: "Empreinte active",
  SUCCEEDED: "Paiement encaissé",
  FAILED: "Paiement échoué",
  REFUNDED: "Remboursé/libéré",
  PARTIALLY_REFUNDED: "Remboursé partiel",
};

export default function AdminClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [selectedClientForVIP, setSelectedClientForVIP] = useState<string | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState("");
  const [reviewPreview, setReviewPreview] = useState<{ clientId: string; to: string; subject: string; html: string; bookingId: string; sentAt: string | null } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [sendingWelcomeTo, setSendingWelcomeTo] = useState<string | null>(null);
  const [verifyingPetId, setVerifyingPetId] = useState<string | null>(null);
  const [confirmingPetId, setConfirmingPetId] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    petId: string;
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [refundLoadingFor, setRefundLoadingFor] = useState<string | null>(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [refundDialog, setRefundDialog] = useState<SubscriptionRefundDialog | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("ALL");
  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discountType: "CUSTOM_TOTAL" as "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL",
    discountValue: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (
      status === "authenticated" &&
      session.user.role !== "ADMIN"
    ) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (status === "authenticated") loadData();
  }, [status]);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [clientsRes, couponsRes] = await Promise.all([
        fetch("/api/admin/clients"),
        fetch("/api/admin/coupons"),
      ]);

      const clientsData = await clientsRes.json().catch(() => null);
      const couponsData = await couponsRes.json().catch(() => null);

      if (!clientsRes.ok) throw new Error(clientsData?.error || "Impossible de charger les clients.");
      if (!couponsRes.ok) throw new Error(couponsData?.error || "Impossible de charger les codes promo.");

      setClients(clientsData.clients || []);
      setCoupons(couponsData.coupons || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de chargement.");
    } finally {
      setIsLoading(false);
    }
  };

  const createCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponForm.code.toUpperCase(),
          description: couponForm.description,
          discountType: couponForm.discountType,
          discountValue: parseFloat(couponForm.discountValue),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Le code promo n'a pas pu être créé.");

      setCouponForm({ code: "", description: "", discountType: "CUSTOM_TOTAL", discountValue: "" });
      setShowCreateCoupon(false);
      setNotice("Code promo créé.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur lors de la création.");
    }
  };

  const assignVIPCoupon = async (userId: string, couponId: string) => {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/clients/${userId}/vip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Le code VIP n'a pas pu être assigné.");

      setSelectedClientForVIP(null);
      setSelectedCoupon("");
      setNotice("Code VIP assigné.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur lors de l'assignation.");
    }
  };

  const removeVIPStatus = async (userId: string) => {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/clients/${userId}/vip`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Le code VIP n'a pas pu être retiré.");

      setNotice("Code VIP retiré.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur lors du retrait.");
    }
  };

  const cancelSubscription = async (userId: string) => {
    if (!confirm("Programmer la résiliation Premium à la fin de la période payée ?")) return;

    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/clients/${userId}/subscription`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Erreur lors de la résiliation.");

      setNotice("Résiliation Premium programmée à échéance.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur connexion.");
    }
  };

  const prepareSubscriptionRefund = async (client: Client) => {
    setError("");
    setNotice("");
    setRefundLoadingFor(client.id);
    setRefundConfirmed(false);

    try {
      const response = await fetch(`/api/admin/clients/${client.id}/subscription`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.invoice) {
        throw new Error(data?.error || "Impossible de préparer le remboursement Premium.");
      }

      setRefundDialog({ client, invoice: data.invoice });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur connexion.");
    } finally {
      setRefundLoadingFor(null);
    }
  };

  const refundSubscription = async () => {
    if (!refundDialog || !refundConfirmed) return;

    setError("");
    setNotice("");
    setRefundSubmitting(true);
    try {
      const response = await fetch(`/api/admin/clients/${refundDialog.client.id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "REFUND_LATEST_PAYMENT_AND_CANCEL" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Le remboursement Premium a échoué.");

      const totalRefunded = Number(data?.refundedAmount || 0) + Number(data?.alreadyRefunded || 0);
      const emailNotice = data?.emailStatus === "SENT"
        ? " Le client a été informé par email."
        : data?.emailStatus === "FAILED"
          ? " Le remboursement est confirmé, mais l'email direct a échoué ; le webhook Stripe va le relancer."
          : " Le client sera informé dès la confirmation finale de Stripe.";
      setNotice(
        `Remboursement Premium de ${formatMoney(totalRefunded)} accepté par Stripe. L'abonnement est résilié immédiatement.${emailNotice}`
      );
      setRefundDialog(null);
      setRefundConfirmed(false);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur connexion.");
    } finally {
      setRefundSubmitting(false);
    }
  };

  const prepareGoogleReview = async (client: Client) => {
    setReviewBusy(true);
    setError("");
    setReviewError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/clients/${client.id}/google-review`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReviewPreview({ ...data, clientId: client.id });
    } catch (error) { setError(error instanceof Error ? error.message : "Impossible de charger l’aperçu."); }
    finally { setReviewBusy(false); }
  };
  const sendGoogleReview = async () => {
    if (!reviewPreview || reviewBusy) return;
    setReviewBusy(true);
    setReviewError("");
    try {
      const response = await fetch(`/api/admin/clients/${reviewPreview.clientId}/google-review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: reviewPreview.bookingId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(data.message);
      setReviewPreview(null);
    } catch (error) { setReviewError(error instanceof Error ? error.message : "L’envoi a échoué."); }
    finally { setReviewBusy(false); }
  };

  const sendWelcomeEmail = async (client: Client) => {
    const displayName = client.name || client.email;
    if (!confirm(`Envoyer le mail explicatif bilingue à ${displayName} (${client.email}) ?`)) return;

    setError("");
    setNotice("");
    setSendingWelcomeTo(client.id);
    try {
      const response = await fetch(`/api/admin/clients/${client.id}/welcome-email`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Le mail explicatif n'a pas pu être envoyé.");
      }

      setNotice(data?.message || `Mail explicatif envoyé à ${client.email}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur lors de l'envoi du mail.");
    } finally {
      setSendingWelcomeTo(null);
    }
  };

  const setBirthDateVerification = async (pet: ClientPet, verified: boolean) => {
    const action = verified ? "valider" : "déverrouiller";

    setError("");
    setNotice("");
    setVerificationFeedback(null);
    setConfirmingPetId(null);
    setVerifyingPetId(pet.id);
    try {
      const response = await fetch(`/api/admin/pets/${pet.id}/verify-birth-date`, {
        method: verified ? "POST" : "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Impossible de ${action} cette date.`);

      const message = data?.message || `Date de naissance ${verified ? "validée" : "déverrouillée"}.`;
      setClients((currentClients) => currentClients.map((client) => ({
        ...client,
        pets: client.pets.map((currentPet) => currentPet.id === pet.id
          ? {
              ...currentPet,
              birthDateVerifiedAt: verified
                ? data?.pet?.birthDateVerifiedAt || new Date().toISOString()
                : null,
            }
          : currentPet),
      })));
      setVerificationFeedback({ petId: pet.id, type: "success", message });
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : `Impossible de ${action} cette date.`;
      setVerificationFeedback({ petId: pet.id, type: "error", message });
    } finally {
      setVerifyingPetId(null);
    }
  };

  const stats = useMemo(() => {
    const premiumClients = clients.filter((client) => client.subscription?.status === "ACTIVE").length;
    const vipClients = clients.filter((client) => client.autoApplyCoupon).length;
    const totalSpent = clients.reduce((sum, client) => sum + client.stats.totalSpent, 0);
    const loyaltyPaws = clients.reduce((sum, client) => sum + client.stats.loyaltyPaws, 0);
    return { premiumClients, vipClients, totalSpent, loyaltyPaws };
  }, [clients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = !query ||
        client.name?.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "PREMIUM" && client.subscription?.status === "ACTIVE") ||
        (filter === "VIP" && Boolean(client.autoApplyCoupon)) ||
        (filter === "ACTIVE" && client.stats.totalBookings > 0);
      return matchesSearch && matchesFilter;
    });
  }, [clients, filter, search]);

  if (status === "loading" || isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-3 text-sm font-semibold text-gray-600">Chargement des clients...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Administration</p>
          <h1 className="mt-1 text-3xl font-extrabold text-gray-950">Clients</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Suivez les clients, les avantages Premium, les codes VIP et la valeur fidélité.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button type="button" onClick={() => setShowCreateCoupon((value) => !value)}>
            {showCreateCoupon ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateCoupon ? "Fermer" : "Créer un code"}
          </Button>
        </div>
      </section>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-lg border p-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || notice}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clients", value: clients.length.toString(), icon: UsersRound },
          { label: "Premium actifs", value: stats.premiumClients.toString(), icon: Crown },
          { label: "Codes VIP", value: stats.vipClients.toString(), icon: BadgePercent },
          { label: "Pattes estimées", value: stats.loyaltyPaws.toString(), icon: PawPrint },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-950">{item.value}</p>
            </div>
          );
        })}
      </section>

      {showCreateCoupon && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-950">Nouveau code promo</h2>
            <p className="mt-1 text-sm text-gray-600">Le code pourra ensuite être assigné comme avantage VIP.</p>
          </div>
          <form onSubmit={createCoupon} className="grid gap-4 lg:grid-cols-4 lg:items-end">
            <div>
              <Label>Code</Label>
              <Input
                value={couponForm.code}
                onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })}
                placeholder="VIP2026"
                required
                className="mt-1 uppercase"
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                value={couponForm.discountType}
                onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value as "FIXED_AMOUNT" | "PERCENTAGE" | "CUSTOM_TOTAL" })}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none focus:border-gray-950"
              >
                <option value="CUSTOM_TOTAL">Tarif final à payer</option>
                <option value="FIXED_AMOUNT">Réduction en euros</option>
                <option value="PERCENTAGE">Réduction en pourcentage</option>
              </select>
            </div>
            <div>
              <Label>
                {couponForm.discountType === "CUSTOM_TOTAL"
                  ? "Total final à payer"
                  : couponForm.discountType === "FIXED_AMOUNT"
                    ? "Réduction"
                    : "Réduction (%)"}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={couponForm.discountValue}
                onChange={(event) => setCouponForm({ ...couponForm, discountValue: event.target.value })}
                placeholder={couponForm.discountType === "PERCENTAGE" ? "10" : couponForm.discountType === "CUSTOM_TOTAL" ? "40.00" : "5.00"}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Créer
              </Button>
            </div>
            <div className="lg:col-span-4">
              <Label>Description</Label>
              <Input
                value={couponForm.description}
                onChange={(event) => setCouponForm({ ...couponForm, description: event.target.value })}
                placeholder="Code réservé aux clients VIP"
                className="mt-1"
              />
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-[1.2fr_2fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-950">Codes disponibles</h2>
            <span className="text-sm font-semibold text-gray-500">{coupons.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {coupons.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Aucun code promo créé.</p>
            ) : (
              coupons.slice(0, 6).map((coupon) => (
                <div key={coupon.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-bold text-gray-950">{coupon.code}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${coupon.isActive ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                      {coupon.isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-700">{formatDiscount(coupon)} de réduction</p>
                  {coupon.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{coupon.description}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Liste clients</h2>
              <p className="mt-1 text-sm text-gray-600">{filteredClients.length} résultat(s), {formatMoney(stats.totalSpent)} validés au total.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom ou email..."
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-950 outline-none focus:border-gray-950 lg:w-72"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  filter === item.id
                    ? "border-gray-950 bg-gray-950 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {filteredClients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-3 text-sm font-semibold text-gray-600">Aucun client avec ces filtres.</p>
              </div>
            ) : (
              filteredClients.map((client) => {
                const isPremium = client.subscription?.status === "ACTIVE";
                const subscriptionLabel = client.subscription?.status
                  ? subscriptionLabels[client.subscription.status] || client.subscription.status
                  : "Premium non souscrit";
                const lastBookingLabel = client.stats.lastBooking
                  ? bookingStatusLabels[client.stats.lastBooking.status] || client.stats.lastBooking.status
                  : "Aucune réservation";
                const lastPaymentLabel = client.stats.lastBooking?.paymentStatus
                  ? paymentStatusLabels[client.stats.lastBooking.paymentStatus] || client.stats.lastBooking.paymentStatus
                  : "Aucun paiement";
                return (
                  <article key={client.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-bold text-gray-950">{client.name || "Sans nom"}</h3>
                          {isPremium && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                              <Star className="h-3.5 w-3.5" />
                              Premium
                            </span>
                          )}
                          {client.autoApplyCoupon && (
                            <span className="rounded-full bg-purple-50 px-2 py-1 text-xs font-bold text-purple-800">VIP</span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-600">{client.email}</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-semibold text-gray-500">Réservations</p>
                            <p className="mt-1 text-lg font-bold text-gray-950">{client.stats.totalBookings}</p>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-semibold text-gray-500">Validées</p>
                            <p className="mt-1 text-lg font-bold text-gray-950">{client.stats.validatedBookings}</p>
                            <p className="mt-1 text-[11px] font-medium text-gray-500">
                              {client.stats.completedBookings} terminée(s)
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-semibold text-gray-500">Montant validé</p>
                            <p className="mt-1 text-lg font-bold text-gray-950">{formatMoney(client.stats.totalSpent)}</p>
                          </div>
                          <div className="rounded-lg bg-gray-950 p-3 text-white">
                            <p className="text-xs font-semibold text-gray-300">Pattes</p>
                            <p className="mt-1 text-lg font-bold">{client.stats.loyaltyPaws}</p>
                            <p className="mt-1 text-[11px] font-medium text-gray-300">
                              {client.stats.loyalty.tier.name}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 lg:grid-cols-3">
                          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dernière réservation</p>
                            <p className="mt-1 font-bold text-gray-950">{lastBookingLabel}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {client.stats.lastBooking
                                ? `${lastPaymentLabel} · ${formatMoney(client.stats.lastBooking.totalPrice)}`
                                : lastPaymentLabel}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Premium</p>
                            <p className={`mt-1 font-bold ${isPremium ? "text-amber-800" : "text-gray-950"}`}>
                              {subscriptionLabel}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {isPremium ? "Remise 10 %, Pattes doublées" : "Aucun avantage Premium actif"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fidélité</p>
                            <p className="mt-1 font-bold text-gray-950">Niveau {client.stats.loyalty.tier.name}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {client.stats.loyalty.nextReward
                                ? `${client.stats.loyalty.pawsToNextReward} Pattes avant ${client.stats.loyalty.nextReward.label}`
                                : "Toutes les récompenses visibles sont atteintes"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vérification des âges</p>
                            <span className="text-xs font-bold text-gray-600">{client.pets.length} animal(aux)</span>
                          </div>
                          {client.pets.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-500">Aucun profil animal.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {client.pets.map((pet) => {
                                const verified = Boolean(pet.birthDateVerifiedAt);
                                return (
                                  <div key={pet.id} className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-bold text-gray-950">{pet.species === "DOG" ? "🐕" : "🐈"} {pet.name}</p>
                                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                          verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                        }`}>
                                          {verified ? "Vérifié" : "À vérifier"}
                                        </span>
                                      </div>
                                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {pet.birthDate
                                          ? new Date(pet.birthDate).toLocaleDateString("fr-FR", { timeZone: "UTC" })
                                          : "Date non renseignée"}
                                      </p>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      {pet.birthDateProofUrl ? (
                                        <a
                                          href={pet.birthDateProofUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
                                        >
                                          <FileText className="h-4 w-4" />
                                          Voir le justificatif
                                        </a>
                                      ) : (
                                        <span className="inline-flex min-h-9 items-center rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                                          Justificatif manquant
                                        </span>
                                      )}
                                      <div className="flex flex-col gap-1">
                                        {confirmingPetId === pet.id ? (
                                          <div className="flex gap-2">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant={verified ? "outline" : "default"}
                                              disabled={verifyingPetId !== null}
                                              onClick={() => setBirthDateVerification(pet, !verified)}
                                              className={verified ? "text-amber-800" : "bg-emerald-700 hover:bg-emerald-800"}
                                            >
                                              <BadgeCheck className="h-4 w-4" />
                                              Confirmer
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              disabled={verifyingPetId !== null}
                                              onClick={() => setConfirmingPetId(null)}
                                            >
                                              Annuler
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={verified ? "outline" : "default"}
                                            disabled={verifyingPetId !== null || !pet.birthDate || !pet.birthDateProofUrl}
                                            onClick={() => {
                                              setVerificationFeedback(null);
                                              setConfirmingPetId(pet.id);
                                            }}
                                            className={verified ? "text-amber-800" : "bg-emerald-700 hover:bg-emerald-800"}
                                          >
                                            {verifyingPetId === pet.id ? (
                                              <LoaderCircle className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <BadgeCheck className="h-4 w-4" />
                                            )}
                                            {verified ? "Déverrouiller" : "Valider l’âge"}
                                          </Button>
                                        )}
                                        {verificationFeedback?.petId === pet.id && (
                                          <p
                                            role={verificationFeedback.type === "error" ? "alert" : "status"}
                                            className={`max-w-64 text-xs font-semibold ${
                                              verificationFeedback.type === "error" ? "text-red-700" : "text-emerald-700"
                                            }`}
                                          >
                                            {verificationFeedback.message}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {client.autoApplyCoupon && (
                          <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-950">
                            Code VIP actuel : <span className="font-mono font-bold">{client.autoApplyCoupon.code}</span> · {formatDiscount(client.autoApplyCoupon)}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-2 xl:w-56">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => sendWelcomeEmail(client)}
                          disabled={sendingWelcomeTo !== null}
                          className="justify-start border-sky-200 text-sky-900 hover:bg-sky-50"
                        >
                          {sendingWelcomeTo === client.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                          {sendingWelcomeTo === client.id ? "Envoi en cours..." : "Envoyer le mail explicatif"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => prepareGoogleReview(client)} disabled={reviewBusy || client.stats.completedBookings === 0} title={client.stats.completedBookings === 0 ? "Disponible après une réservation terminée" : "Aperçu du mail français et anglais"} className="justify-start border-amber-300 text-amber-900 hover:bg-amber-50">
                          <Star className="h-4 w-4" /> Demander un avis Google
                        </Button>
                        {isPremium && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => prepareSubscriptionRefund(client)}
                              disabled={refundLoadingFor !== null || refundSubmitting}
                              className="justify-start border-red-200 text-red-800 hover:bg-red-50"
                            >
                              {refundLoadingFor === client.id ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <CircleDollarSign className="h-4 w-4" />
                              )}
                              {refundLoadingFor === client.id ? "Vérification Stripe..." : "Rembourser Premium"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => cancelSubscription(client.id)} className="justify-start border-amber-200 text-amber-900 hover:bg-amber-50">
                              <Crown className="h-4 w-4" />
                              Résilier à échéance
                            </Button>
                          </>
                        )}
                        {!client.autoApplyCoupon ? (
                          selectedClientForVIP === client.id ? (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                              <select
                                value={selectedCoupon}
                                onChange={(event) => setSelectedCoupon(event.target.value)}
                                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950"
                              >
                                <option value="">Sélectionner un code</option>
                                {coupons.filter((coupon) => coupon.isActive).map((coupon) => (
                                  <option key={coupon.id} value={coupon.id}>{coupon.code}</option>
                                ))}
                              </select>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <Button type="button" size="sm" onClick={() => assignVIPCoupon(client.id, selectedCoupon)} disabled={!selectedCoupon}>OK</Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedClientForVIP(null);
                                    setSelectedCoupon("");
                                  }}
                                >
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" onClick={() => setSelectedClientForVIP(client.id)} className="justify-start">
                              <WalletCards className="h-4 w-4" />
                              Assigner VIP
                            </Button>
                          )
                        ) : (
                          <Button type="button" variant="outline" onClick={() => removeVIPStatus(client.id)} className="justify-start text-red-700 hover:bg-red-50">
                            <X className="h-4 w-4" />
                            Retirer VIP
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      {reviewPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 p-3">
          <div role="dialog" aria-modal="true" aria-labelledby="google-review-title" className="flex max-h-[95dvh] w-full max-w-3xl flex-col rounded-xl bg-white p-4 text-gray-950 shadow-2xl" onKeyDown={event => {
            if (event.key === "Escape" && !reviewBusy) setReviewPreview(null);
            if (event.key === "Tab") {
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
              const first = buttons[0], last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          }}>
            <div className="flex items-center justify-between gap-3"><h2 id="google-review-title" className="text-lg font-bold">Demande d’avis Google · FR / EN</h2><Button autoFocus variant="ghost" disabled={reviewBusy} onClick={() => setReviewPreview(null)} aria-label="Fermer l’aperçu"><X className="h-5 w-5" /></Button></div>
            <p className="mt-2 break-all text-sm">À : <strong>{reviewPreview.to}</strong></p>
            <p className="my-2 text-sm">Objet : {reviewPreview.subject}</p>
            <iframe title="Aperçu du mail bilingue de demande d’avis Google" sandbox="" tabIndex={-1} srcDoc={reviewPreview.html} className="min-h-0 h-[60dvh] w-full rounded-lg border" />
            {reviewError && <p role="alert" className="mt-2 text-sm text-red-700">{reviewError}</p>}
            {reviewPreview.sentAt && <p className="mt-2 text-sm text-amber-900">Demande déjà envoyée le {new Date(reviewPreview.sentAt).toLocaleString("fr-FR")}.</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={reviewBusy} onClick={() => setReviewPreview(null)}>Fermer</Button><Button disabled={reviewBusy || Boolean(reviewPreview.sentAt)} onClick={sendGoogleReview}>{reviewBusy ? "Envoi en cours…" : "Envoyer le mail bilingue"}</Button></div>
          </div>
        </div>
      )}
      {refundDialog && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-gray-950/60 p-4 sm:items-center" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-refund-title"
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id="subscription-refund-title" className="text-xl font-bold text-gray-950">
              Rembourser et résilier Premium
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Client : <strong>{refundDialog.client.name || refundDialog.client.email}</strong>
            </p>

            <dl className="mt-5 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Dernière facture payée</dt>
                <dd className="mt-1 font-bold text-gray-950">{refundDialog.invoice.number || "Facture Stripe"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Date</dt>
                <dd className="mt-1 font-bold text-gray-950">
                  {new Date(refundDialog.invoice.createdAt).toLocaleDateString("fr-FR")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Montant payé</dt>
                <dd className="mt-1 font-bold text-gray-950">{formatMoney(refundDialog.invoice.amountPaid)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">À rembourser maintenant</dt>
                <dd className="mt-1 text-lg font-bold text-red-800">{formatMoney(refundDialog.invoice.refundableAmount)}</dd>
              </div>
            </dl>

            {refundDialog.invoice.refundableAmount > 0 ? (
              <>
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
                  Cette action rembourse la dernière échéance sur le moyen de paiement d&apos;origine et résilie immédiatement l&apos;abonnement. Elle ne rembourse aucune réservation.
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    checked={refundConfirmed}
                    onChange={(event) => setRefundConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-red-700"
                  />
                  <span>Je confirme le remboursement de {formatMoney(refundDialog.invoice.refundableAmount)} et la résiliation immédiate.</span>
                </label>
              </>
            ) : (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Cette dernière échéance a déjà été intégralement remboursée. Aucun second remboursement ne sera déclenché.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="destructive"
                disabled={!refundConfirmed || refundSubmitting || refundDialog.invoice.refundableAmount <= 0}
                onClick={refundSubscription}
                className="h-11"
              >
                {refundSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                {refundSubmitting ? "Traitement Stripe..." : "Rembourser et résilier"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={refundSubmitting}
                onClick={() => {
                  setRefundDialog(null);
                  setRefundConfirmed(false);
                }}
                className="h-11"
              >
                Ne rien changer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
