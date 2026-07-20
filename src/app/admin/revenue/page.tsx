"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  BarChart3,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type RevenueSummary = {
  totalRevenue: number;
  monthRevenue: number;
  averagePayment: number;
  succeededCount: number;
  pendingAmount: number;
};

type MonthlyRevenue = {
  key: string;
  label: string;
  amount: number;
};

type Transaction = {
  id: string;
  kind: "BOOKING" | "CHARGE";
  amount: number;
  netAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  refundAmount: number;
  serviceType: string;
  bookingId: string;
  clientName: string | null;
  clientEmail: string;
  pets: string[];
  reason?: string;
};

type RevenueData = {
  summary: RevenueSummary;
  monthly: MonthlyRevenue[];
  transactions: Transaction[];
};

const emptyData: RevenueData = {
  summary: {
    totalRevenue: 0,
    monthRevenue: 0,
    averagePayment: 0,
    succeededCount: 0,
    pendingAmount: 0,
  },
  monthly: [],
  transactions: [],
};

const serviceLabels: Record<string, string> = {
  BOARDING: "Hébergement",
  HOUSE_SITTING: "Garde au domicile",
  DAY_CARE: "Garderie",
  DROP_IN: "Visite",
  DOG_WALKING: "Promenade",
};

const statusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-gray-100 text-gray-700" },
  PROCESSING: { label: "Empreinte", className: "bg-blue-50 text-blue-800" },
  SUCCEEDED: { label: "Encaissé", className: "bg-emerald-50 text-emerald-800" },
  FAILED: { label: "Échec", className: "bg-red-50 text-red-800" },
  REFUNDED: { label: "Remboursé", className: "bg-amber-50 text-amber-800" },
  PARTIALLY_REFUNDED: { label: "Partiel", className: "bg-orange-50 text-orange-800" },
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return "Non encaissé";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

export default function AdminRevenuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<RevenueData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (status === "authenticated") fetchRevenue();
  }, [status]);

  const fetchRevenue = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/revenue");
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Impossible de charger les revenus.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de chargement.");
    } finally {
      setIsLoading(false);
    }
  };

  const maxMonthlyAmount = useMemo(
    () => Math.max(1, ...data.monthly.map((month) => month.amount)),
    [data.monthly]
  );

  if (status === "loading" || isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-3 text-sm font-semibold text-gray-600">Chargement des finances...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Administration</p>
          <h1 className="mt-1 text-3xl font-extrabold text-gray-950">Finance</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Vue opérationnelle des encaissements, empreintes actives, remboursements et suppléments.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={fetchRevenue} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Revenus totaux", value: formatMoney(data.summary.totalRevenue), icon: WalletCards },
          { label: "Ce mois", value: formatMoney(data.summary.monthRevenue), icon: BarChart3 },
          { label: "Panier moyen", value: formatMoney(data.summary.averagePayment), icon: ArrowDownUp },
          { label: "Paiements encaissés", value: data.summary.succeededCount.toString(), icon: CheckCircle2 },
          { label: "Empreintes actives", value: formatMoney(data.summary.pendingAmount), icon: CreditCard },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
              <p className="mt-2 truncate text-2xl font-bold text-gray-950">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Évolution</h2>
              <p className="mt-1 text-sm text-gray-600">Encaissements nets sur 6 mois.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          {data.monthly.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-600">
              Les revenus apparaîtront après les premiers paiements.
            </div>
          ) : (
            <div className="mt-6 flex h-56 items-end gap-3">
              {data.monthly.map((month) => {
                const height = Math.max(8, Math.round((month.amount / maxMonthlyAmount) * 100));
                return (
                  <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end rounded-md bg-gray-100 px-2 pb-2">
                      <div
                        className="w-full rounded-md bg-gray-950 transition-all"
                        style={{ height: `${height}%` }}
                        aria-label={`${month.label}: ${formatMoney(month.amount)}`}
                      />
                    </div>
                    <p className="truncate text-xs font-semibold text-gray-500">{month.label}</p>
                    <p className="text-xs font-bold text-gray-950">{formatMoney(month.amount)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Transactions récentes</h2>
              <p className="mt-1 text-sm text-gray-600">Réservations et suppléments, triés du plus récent au plus ancien.</p>
            </div>
            <CreditCard className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
            {data.transactions.length === 0 ? (
              <div className="p-10 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-3 text-sm font-semibold text-gray-600">Aucun paiement pour le moment.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {data.transactions.map((transaction) => {
                  const meta = statusMeta[transaction.status] || statusMeta.PENDING;
                  const title = transaction.kind === "CHARGE"
                    ? transaction.reason || "Supplément"
                    : serviceLabels[transaction.serviceType] || transaction.serviceType;
                  const displayedAmount =
                    transaction.status === "SUCCEEDED" ||
                    transaction.status === "PARTIALLY_REFUNDED" ||
                    transaction.status === "REFUNDED"
                      ? transaction.netAmount
                      : transaction.amount;
                  return (
                    <div key={`${transaction.kind}-${transaction.id}`} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.8fr_0.6fr] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-950">{title}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-600">
                          {transaction.clientName || transaction.clientEmail}
                          {transaction.pets.length > 0 ? ` · ${transaction.pets.join(", ")}` : ""}
                        </p>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Créé : {formatDate(transaction.createdAt)}</p>
                        <p>Encaissé : {formatDate(transaction.paidAt)}</p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-lg font-bold text-gray-950">{formatMoney(displayedAmount)}</p>
                        {transaction.refundAmount > 0 && (
                          <p className="text-xs font-semibold text-amber-700">Remboursé : {formatMoney(transaction.refundAmount)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
