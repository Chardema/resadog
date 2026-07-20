"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileDown,
  FileText,
  PawPrint,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREMIUM_SUBSCRIPTION } from "@/lib/subscription-pricing";

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  amountDue: number;
  createdAt: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

type LoyaltyTier = {
  name: string;
  benefits: string[];
};

type LoyaltyReward = {
  threshold: number;
  label: string;
  discountEquivalent: number;
};

type RewardCoupon = {
  code: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  currentUses: number;
  maxUses: number | null;
  validUntil: string | null;
};

type SubscriptionData = {
  subscription: {
    status: string;
    price: number;
    benefits: string[];
  } | null;
  premium: {
    isPremium: boolean;
    monthlyPrice: number;
    pointsMultiplier: number;
    benefits: string[];
  };
  loyalty: {
    paws: number;
    tier: LoyaltyTier;
    nextTier: LoyaltyTier | null;
    nextTierProgress: number;
    pawsToNextTier: number;
    nextReward: LoyaltyReward | null;
    nextRewardProgress: number;
    pawsToNextReward: number;
  };
  rewards: LoyaltyReward[];
  rewardCoupons: RewardCoupon[];
  portalUrl: string | null;
  commitmentEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancellationEffectiveAt: string | null;
  cancelAtPeriodEnd: boolean;
  isLocked: boolean;
  invoices: Invoice[];
};

const formatMoney = (amount: number) =>
  amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleDateString("fr-FR") : "date à confirmer";

const invoiceStatus: Record<string, string> = {
  paid: "Payée",
  open: "À payer",
  void: "Annulée",
  uncollectible: "Impayée",
};

function ProgressBar({ value, className = "bg-orange-500" }: { value: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function SubscriptionManager() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [redeemingThreshold, setRedeemingThreshold] = useState<number | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      const response = await fetch("/api/user/subscription");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger l'espace fidélité.");
      setData(result);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Impossible de charger l'espace fidélité.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const manageSubscription = async (action: "cancel_at_period_end" | "resume") => {
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de modifier l'abonnement.");

      setMessage({
        type: "success",
        text: action === "cancel_at_period_end"
          ? `Résiliation programmée pour le ${formatDate(result.cancellationEffectiveAt || result.currentPeriodEnd)}.`
          : "La résiliation est annulée. Votre abonnement Premium continue normalement.",
      });
      setShowCancelConfirm(false);
      setCancelConfirmed(false);
      await loadSubscription();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Impossible de modifier l'abonnement.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const redeemReward = async (threshold: number) => {
    setRedeemingThreshold(threshold);
    setMessage(null);

    try {
      const response = await fetch("/api/user/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Impossible d'utiliser cette récompense.");

      setMessage({
        type: "success",
        text: `Code ${result.coupon.code} créé. Utilisez-le lors de votre prochaine réservation.`,
      });
      await loadSubscription();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Impossible d'utiliser cette récompense.",
      });
    } finally {
      setRedeemingThreshold(null);
    }
  };

  if (loading) {
    return (
      <section id="subscription" className="rounded-lg border border-gray-200 bg-white p-5" aria-busy="true">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-5 h-36 animate-pulse rounded bg-gray-100" />
      </section>
    );
  }

  const isPremium = Boolean(data?.premium?.isPremium);
  const cancellationDate = data?.cancellationEffectiveAt ||
    (data?.isLocked ? data.commitmentEndsAt : data?.currentPeriodEnd);

  return (
    <section id="subscription" className="scroll-mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-gray-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-700">Programme fidélité gratuit</p>
              <h2 className="mt-1 text-xl font-bold text-gray-950">Mes Pattes</h2>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
              {data?.loyalty.tier.name}
            </span>
          </div>

          <div className="mt-6 rounded-lg bg-gray-50 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Solde fidélité</p>
                <p className="mt-1 text-4xl font-bold text-gray-950">{data?.loyalty.paws ?? 0}</p>
              </div>
              <PawPrint className="h-9 w-9 text-orange-500" aria-hidden="true" />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex justify-between gap-3 text-xs font-semibold text-gray-600">
                  <span>{data?.loyalty.nextReward ? `Prochaine récompense : ${data.loyalty.nextReward.label}` : "Toutes les récompenses visibles sont atteintes"}</span>
                  <span>{data?.loyalty.pawsToNextReward ?? 0} Pattes</span>
                </div>
                <ProgressBar value={data?.loyalty.nextRewardProgress ?? 0} />
              </div>

              <div>
                <div className="mb-2 flex justify-between gap-3 text-xs font-semibold text-gray-600">
                  <span>{data?.loyalty.nextTier ? `Prochain niveau : ${data.loyalty.nextTier.name}` : "Niveau maximum"}</span>
                  <span>{data?.loyalty.pawsToNextTier ?? 0} Pattes</span>
                </div>
                <ProgressBar value={data?.loyalty.nextTierProgress ?? 100} className="bg-gray-950" />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {(data?.rewards || []).map((reward) => {
              const canRedeem = (data?.loyalty.paws || 0) >= reward.threshold;
              return (
                <div key={reward.threshold} className="rounded-md border border-gray-100 bg-white p-3 text-sm text-gray-700">
                  <p className="font-semibold">{reward.threshold} Pattes</p>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-gray-500">{reward.label}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant={canRedeem ? "default" : "outline"}
                    disabled={!canRedeem || redeemingThreshold === reward.threshold}
                    onClick={() => redeemReward(reward.threshold)}
                    className="mt-3 w-full"
                  >
                    {redeemingThreshold === reward.threshold ? "Création..." : canRedeem ? "Utiliser" : "Pas assez"}
                  </Button>
                </div>
              );
            })}
          </div>

          {data?.rewardCoupons?.length ? (
            <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-950">Codes fidélité disponibles</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.rewardCoupons.map((coupon) => {
                  const used = coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses;
                  return (
                    <div key={coupon.code} className="rounded-md bg-white p-3 text-sm">
                      <p className="font-mono font-bold text-gray-950">{coupon.code}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatMoney(coupon.discountValue)} de réduction · {used || !coupon.isActive ? "utilisé" : "actif"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <p className="text-sm font-bold text-gray-950">Avantages du niveau {data?.loyalty.tier.name}</p>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              {data?.loyalty.tier.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-500">Abonnement Premium</p>
              <h2 className="mt-1 text-xl font-bold text-gray-950">La Patte Dorée Premium</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              data?.cancelAtPeriodEnd
                ? "bg-amber-100 text-amber-800"
                : isPremium
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600"
            }`}>
              {data?.cancelAtPeriodEnd ? "Fin programmée" : isPremium ? "Premium" : "Gratuit"}
            </span>
          </div>

          <div className="mt-5 rounded-lg border border-gray-100 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{isPremium ? "Votre tarif" : "Prix"}</p>
                <p className="mt-1 text-2xl font-bold text-gray-950">{formatMoney(PREMIUM_SUBSCRIPTION.monthlyPrice)} €/mois</p>
              </div>
              <Sparkles className="h-8 w-8 text-orange-500" aria-hidden="true" />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {PREMIUM_SUBSCRIPTION.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {data?.cancelAtPeriodEnd && (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-amber-950">Fin prévue le {formatDate(cancellationDate)}</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Les avantages Premium restent actifs jusqu&apos;à cette date.
              </p>
              <Button
                type="button"
                onClick={() => manageSubscription("resume")}
                disabled={actionLoading}
                className="mt-4 h-10 bg-amber-900 text-white hover:bg-amber-800"
              >
                <RefreshCw className={`h-4 w-4 ${actionLoading ? "animate-spin" : ""}`} />
                Annuler la résiliation
              </Button>
            </div>
          )}

          {message && (
            <div
              role="status"
              className={`mt-4 rounded-md border p-3 text-sm font-medium ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {!isPremium ? (
              <Link
                href="/subscriptions"
                className="inline-flex h-12 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white hover:bg-orange-600 sm:col-span-2"
              >
                Activer Premium
              </Link>
            ) : (
              <>
                {data?.portalUrl && (
                  <a
                    href={data.portalUrl}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Carte et paiements
                  </a>
                )}
                {!data?.cancelAtPeriodEnd && !showCancelConfirm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelConfirm(true);
                      setMessage(null);
                    }}
                    className="h-12 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Résilier Premium
                  </button>
                )}
              </>
            )}
          </div>

          {showCancelConfirm && !data?.cancelAtPeriodEnd && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="font-bold text-red-950">Résilier Premium</h3>
              <p className="mt-2 text-sm leading-6 text-red-900">
                L&apos;abonnement restera actif jusqu&apos;au <strong>{formatDate(cancellationDate)}</strong>.
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-medium text-red-950">
                <input
                  type="checkbox"
                  checked={cancelConfirmed}
                  onChange={(event) => setCancelConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-red-700"
                />
                <span>Je confirme la fin de mon abonnement Premium.</span>
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => manageSubscription("cancel_at_period_end")}
                  disabled={!cancelConfirmed || actionLoading}
                  className="h-11"
                >
                  Confirmer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelConfirmed(false);
                  }}
                  className="h-11 border-gray-300 bg-white"
                >
                  Ne rien changer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <h3 className="font-bold text-gray-950">Factures Premium</h3>
        </div>
        {data?.invoices?.length ? (
          <div className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
            {data.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-950">
                    {invoice.number || "Facture Stripe"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(invoice.createdAt)} · {invoiceStatus[invoice.status || ""] || invoice.status || "Émise"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold text-gray-950">
                    {formatMoney(invoice.amountPaid || invoice.amountDue)} €
                  </span>
                  {invoice.invoicePdf ? (
                    <a href={invoice.invoicePdf} aria-label="Télécharger la facture PDF" className="p-2 text-gray-600 hover:text-orange-700">
                      <FileDown className="h-5 w-5" />
                    </a>
                  ) : invoice.hostedInvoiceUrl ? (
                    <a href={invoice.hostedInvoiceUrl} aria-label="Ouvrir la facture" className="p-2 text-gray-600 hover:text-orange-700">
                      <WalletCards className="h-5 w-5" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-md bg-gray-50 p-4 text-sm text-gray-600">
            <CalendarClock className="h-5 w-5 text-gray-400" aria-hidden="true" />
            Aucune facture Premium disponible pour le moment.
          </div>
        )}
      </div>
    </section>
  );
}
