"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  Crown,
  LoaderCircle,
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

interface Client {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  autoApplyCoupon: Coupon | null;
  subscription: Subscription | null;
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
                        {client.autoApplyCoupon && (
                          <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-950">
                            Code VIP actuel : <span className="font-mono font-bold">{client.autoApplyCoupon.code}</span> · {formatDiscount(client.autoApplyCoupon)}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-2 xl:w-56">
                        {isPremium && (
                          <Button type="button" variant="outline" onClick={() => cancelSubscription(client.id)} className="justify-start border-amber-200 text-amber-900 hover:bg-amber-50">
                            <Crown className="h-4 w-4" />
                            Résilier Premium
                          </Button>
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
    </div>
  );
}
