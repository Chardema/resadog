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
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Subscription = {
  status: string;
  serviceType: "DOG_WALKING" | "DAY_CARE";
  billingPeriod: "MONTHLY" | "YEARLY";
  daysPerWeek: number;
  creditsPerMonth: number;
  price: number;
};

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

type SubscriptionData = {
  subscription: Subscription | null;
  credits: number;
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

export function SubscriptionManager() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      const response = await fetch("/api/user/subscription");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger l'abonnement.");
      setData(result);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Impossible de charger l'abonnement.",
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
          : "La résiliation est annulée. Votre abonnement continue normalement.",
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

  if (loading) {
    return (
      <section id="subscription" className="rounded-lg border border-gray-200 bg-white p-5" aria-busy="true">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-5 h-24 animate-pulse rounded bg-gray-100" />
      </section>
    );
  }

  const subscription = data?.subscription;
  const isActive = subscription?.status === "ACTIVE";
  const cancellationDate = data?.cancellationEffectiveAt ||
    (data?.isLocked ? data.commitmentEndsAt : data?.currentPeriodEnd);

  return (
    <section id="subscription" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
        <div>
          <p className="text-sm font-semibold text-orange-700">Club La Meute</p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">Mon abonnement</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
          data?.cancelAtPeriodEnd
            ? "bg-amber-100 text-amber-800"
            : isActive
              ? "bg-emerald-100 text-emerald-800"
              : "bg-gray-100 text-gray-600"
        }`}>
          {data?.cancelAtPeriodEnd ? "Fin programmée" : isActive ? "Actif" : "Inactif"}
        </span>
      </div>

      {!isActive ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <PawPrint className="mt-0.5 h-5 w-5 text-orange-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-gray-900">Aucun abonnement actif</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Choisissez une formule selon votre rythme. Les crédits non utilisés restent disponibles.
              </p>
            </div>
          </div>
          <Link
            href="/subscriptions"
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-md bg-gray-950 px-5 text-sm font-semibold text-white hover:bg-orange-600 sm:w-auto"
          >
            Voir les formules
          </Link>
        </div>
      ) : (
        <>
          {data?.cancelAtPeriodEnd && (
            <div className="border-b border-amber-200 bg-amber-50 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <p className="font-bold text-amber-950">Fin prévue le {formatDate(cancellationDate)}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    Aucun renouvellement après cette date. Vos crédits acquis restent utilisables.
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
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 border-b border-gray-100 sm:grid-cols-4">
            <div className="border-b border-r border-gray-100 p-4 sm:border-b-0">
              <p className="text-xs font-medium text-gray-500">Formule</p>
              <p className="mt-1 font-bold text-gray-950">
                {subscription.serviceType === "DOG_WALKING" ? "Promenade" : "Garderie"}
              </p>
            </div>
            <div className="border-b border-gray-100 p-4 sm:border-b-0 sm:border-r">
              <p className="text-xs font-medium text-gray-500">Crédits</p>
              <p className="mt-1 font-bold text-gray-950">{data?.credits ?? 0} disponibles</p>
            </div>
            <div className="border-r border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">Montant</p>
              <p className="mt-1 font-bold text-gray-950">
                {formatMoney(subscription.price)} €/{subscription.billingPeriod === "YEARLY" ? "an" : "mois"}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-gray-500">
                {data?.cancelAtPeriodEnd ? "Fin" : "Prochain paiement"}
              </p>
              <p className="mt-1 font-bold text-gray-950">
                {formatDate(data?.cancelAtPeriodEnd ? cancellationDate : data?.currentPeriodEnd)}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-sm text-gray-600">
              {subscription.daysPerWeek} jour{subscription.daysPerWeek > 1 ? "s" : ""}/semaine · {subscription.creditsPerMonth} crédits par mois
            </p>

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
              <Link
                href="/subscriptions"
                className="inline-flex h-12 items-center justify-center rounded-md bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Modifier ma formule
              </Link>
              {data?.portalUrl && (
                <a
                  href={data.portalUrl}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <CreditCard className="h-4 w-4" />
                  Carte et paiements
                </a>
              )}
            </div>

            {!data?.cancelAtPeriodEnd && !showCancelConfirm && (
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(true);
                  setMessage(null);
                }}
                className="mt-6 min-h-11 text-sm font-semibold text-red-700 underline decoration-red-200 underline-offset-4"
              >
                Programmer la résiliation
              </button>
            )}

            {showCancelConfirm && !data?.cancelAtPeriodEnd && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 sm:p-5">
                <h3 className="font-bold text-red-950">Résilier à la fin de l’engagement</h3>
                <p className="mt-2 text-sm leading-6 text-red-900">
                  L’abonnement restera actif jusqu’au <strong>{formatDate(cancellationDate)}</strong>.
                  Aucun nouveau paiement ne sera effectué après cette date et vos crédits resteront disponibles.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-medium text-red-950">
                  <input
                    type="checkbox"
                    checked={cancelConfirmed}
                    onChange={(event) => setCancelConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-red-700"
                  />
                  <span>Je confirme la fin de mon abonnement à cette date.</span>
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => manageSubscription("cancel_at_period_end")}
                    disabled={!cancelConfirmed || actionLoading}
                    className="h-11"
                  >
                    Confirmer la résiliation
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
        </>
      )}

      <div className="border-t border-gray-100 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <h3 className="font-bold text-gray-950">Factures</h3>
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
            <CheckCircle2 className="h-5 w-5 text-gray-400" aria-hidden="true" />
            Aucune facture disponible pour le moment.
          </div>
        )}
      </div>
    </section>
  );
}
