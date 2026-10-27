"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, CreditCard, LoaderCircle, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { financeMoney, financePercent } from "@/components/admin/FinanceBreakdown";
import { FinanceSettingsForm } from "@/components/admin/FinanceSettingsForm";
import { UpcomingFinance } from "@/components/admin/UpcomingFinance";
import { financeMonth, type FinanceAmounts, type FinanceEvent, type FinanceProjection, type FinanceSettings, type FinanceUpcoming, type FinanceUpcomingMonth, type FinanceUpcomingSummary } from "@/lib/finance";

type Month = FinanceAmounts & { key: string; label: string; captureCount: number; crossMonthRefund: boolean };
type RevenueData = {
  year: number; years: number[]; settings: FinanceSettings; summary: FinanceAmounts;
  monthly: Month[]; events: FinanceEvent[]; projections: FinanceProjection[]; warnings: string[]; generatedAt: string;
  upcoming: FinanceUpcoming[]; upcomingMonthly: FinanceUpcomingMonth[]; upcomingSummary: FinanceUpcomingSummary;
};
const labels: Record<string, string> = { BOARDING: "Hébergement", HOUSE_SITTING: "Garde au domicile", DAY_CARE: "Garderie", DROP_IN: "Visite", DOG_WALKING: "Promenade" };
const dateLabel = (value: string) => new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" });

export default function AdminRevenuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const thisMonth = financeMonth(new Date());
  const [year, setYear] = useState(Number(thisMonth.slice(0, 4)));
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const invalidateRequest = useCallback(() => { requestId.current++; }, []);
  const allowed = status === "authenticated" && ["ADMIN", "SITTER"].includes(session.user.role);
  const fetchRevenue = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/revenue?year=${year}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les finances.");
      if (id === requestId.current) setData(result);
    } catch (failure) {
      if (id === requestId.current) setError(failure instanceof Error ? failure.message : "Erreur de chargement.");
    } finally { if (id === requestId.current) setLoading(false); }
  }, [year]);
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
    else if (status === "authenticated" && !allowed) router.replace("/dashboard");
  }, [status, allowed, router]);
  useEffect(() => {
    if (allowed) void fetchRevenue();
    return invalidateRequest;
  }, [allowed, fetchRevenue, invalidateRequest]);

  if (status === "loading" || !allowed || (!data && loading)) return <div role="status" className="rounded-xl border border-gray-200 bg-white p-12 text-center"><LoaderCircle className="mx-auto h-7 w-7 animate-spin text-gray-500" /><p className="mt-3 text-sm text-gray-600">Chargement des finances…</p></div>;
  const selected = month === "all" ? data?.summary : data?.monthly.find((item) => item.key === month);
  const events = data?.events.filter((event) => month === "all" || financeMonth(event.occurredAt) === month) || [];
  const moneyColumns = (amounts: FinanceAmounts) => <>
    <td className="px-4 py-4 text-right tabular-nums">{financeMoney(amounts.grossCents)}</td>
    <td className="px-4 py-4 text-right tabular-nums text-gray-600">{financeMoney(amounts.refundCents)}</td>
    <td className="px-4 py-4 text-right tabular-nums text-gray-600">{financeMoney(amounts.feeCents)}{amounts.estimatedFeeCount > 0 ? " *" : ""}</td>
    <td className="bg-amber-50/60 px-4 py-4 text-right font-semibold tabular-nums text-amber-900">{financeMoney(amounts.provisionCents)}</td>
    <td className="px-4 py-4 text-right font-bold tabular-nums text-emerald-900">{financeMoney(amounts.availableCents)}</td>
  </>;
  return (
    <div className="min-w-0 space-y-6">
      <section className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Administration</p><h1 className="mt-1 text-3xl font-extrabold text-gray-950">Finance</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Vos encaissements, la provision à mettre de côté et ce qu’il vous reste, mois par mois.</p></div>
        <Button type="button" variant="outline" className="justify-self-start sm:justify-self-end" onClick={() => void fetchRevenue(true)} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualiser</Button>
      </section>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
      {data && <>
        {data.warnings.map((warning) => <p role="status" key={warning} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{warning}</p>)}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><CalendarDays className="h-4 w-4" />Année<select aria-label="Année" className="rounded-lg border border-gray-300 bg-white px-3 py-2" value={year} onChange={(event) => { setYear(Number(event.target.value)); setMonth("all"); }}>
            {data.years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">Période<select aria-label="Période" className="rounded-lg border border-gray-300 bg-white px-3 py-2" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="all">Toute l’année</option>{data.monthly.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select></label>
          {loading && <span role="status" className="text-sm text-gray-500">Actualisation…</span>}
        </div>
        {selected && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Brut encaissé", value: selected.grossCents, detail: "Avant frais et remboursements", icon: CreditCard, color: "bg-white" },
            { title: "Frais Stripe", value: selected.feeCents, detail: selected.estimatedFeeCount ? "Une partie des frais est estimée" : "Frais observés sur les paiements", icon: ArrowUpRight, color: "bg-white" },
            { title: "À mettre de côté", value: selected.provisionCents, detail: "Provision Urssaf estimée", icon: Wallet, color: "border-amber-200 bg-amber-50" },
            { title: "Reste estimé", value: selected.availableCents, detail: "Après frais, remboursements et provision", icon: Wallet, color: "border-emerald-200 bg-emerald-50" },
          ].map((item) => <div key={item.title} className={`rounded-xl border border-gray-200 p-5 ${item.color}`}><div className="flex justify-between gap-2"><p className="text-sm font-semibold text-gray-600">{item.title}</p><item.icon className="h-4 w-4 text-gray-500" /></div><p className="mt-3 text-2xl font-extrabold tabular-nums text-gray-950">{financeMoney(item.value)}</p><p className="mt-2 text-xs leading-5 text-gray-600">{item.detail}</p></div>)}
        </section>}
        <p className="text-sm leading-6 text-gray-600">Le « reste estimé » est calculé avant vos autres dépenses et les impôts non inclus dans votre taux. La provision est un montant à transférer vous-même : ce tableau ne déplace pas d’argent et ne paie pas l’Urssaf.</p>
        <UpcomingFinance year={data.year} month={month} monthly={data.upcomingMonthly} summary={data.upcomingSummary} bookings={data.upcoming} onMonthChange={setMonth} />
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5"><h2 className="text-lg font-bold text-gray-950">Récapitulatif mensuel · {data.year}</h2><p className="mt-1 text-sm text-gray-600">Selon les dates réelles d’encaissement et de remboursement, en heure de Paris.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><caption className="sr-only">Brut, remboursements, frais Stripe, provision Urssaf et reste estimé par mois</caption>
            <thead className="border-y border-gray-200 bg-gray-50 text-xs text-gray-600"><tr><th className="px-5 py-3 text-left">Mois</th><th className="px-4 py-3 text-right">Brut encaissé</th><th className="px-4 py-3 text-right">Remboursé</th><th className="px-4 py-3 text-right">Frais Stripe</th><th className="px-4 py-3 text-right">Urssaf estimée</th><th className="px-4 py-3 text-right">Reste estimé</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{data.monthly.map((item) => <tr key={item.key} className={month === item.key ? "bg-gray-50" : ""}><th scope="row" className="px-5 py-4 text-left font-semibold"><button type="button" className="capitalize text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900" onClick={() => setMonth(item.key)} aria-label={`Voir les opérations de ${item.label}`}>{item.label}</button></th>{moneyColumns(item)}</tr>)}</tbody>
            <tfoot className="border-t border-gray-300 bg-gray-50 font-bold"><tr><th className="px-5 py-4 text-left">Total {data.year}</th>{moneyColumns(data.summary)}</tr></tfoot>
          </table></div>
        </section>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5"><h2 className="text-lg font-bold text-gray-950">Détail des opérations · {month === "all" ? data.year : data.monthly.find((item) => item.key === month)?.label}</h2><p className="mt-1 text-sm text-gray-600">{events.length} opération(s). Cliquez sur une réservation pour consulter son détail.</p></div>
          {events.length === 0 ? <p className="px-5 pb-6 text-sm text-gray-500">Aucun encaissement ni remboursement pour cette période.</p> : <div className="divide-y divide-gray-100">{events.map((event) => <div key={event.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.3fr_2fr]">
            <div><Link href={`/admin/bookings?bookingId=${event.bookingId}`} className="font-bold text-gray-950 underline decoration-gray-300 underline-offset-4">{event.clientName}</Link><p className="mt-1 text-sm text-gray-600">{labels[event.serviceType] || event.serviceType}{event.pets.length ? ` · ${event.pets.join(", ")}` : ""}</p><p className="mt-1 text-xs text-gray-500">{dateLabel(event.occurredAt)} · {event.kind === "REFUND" ? "Remboursement" : "Encaissement"} · provision {financePercent(event.rateBps)} %</p></div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs"><div><dt className="text-gray-500">{event.kind === "REFUND" ? "Remboursé" : "Brut"}</dt><dd className="mt-1 font-semibold">{financeMoney(event.kind === "REFUND" ? event.refundCents : event.grossCents)}</dd></div><div><dt className="text-gray-500">Frais Stripe{event.estimatedFeeCount ? " *" : ""}</dt><dd className="mt-1 font-semibold">{financeMoney(event.feeCents)}</dd></div><div><dt className="text-amber-800">{event.kind === "REFUND" ? "Ajustement provision" : "À mettre de côté"}</dt><dd className="mt-1 font-bold text-amber-900">{financeMoney(event.provisionCents)}</dd></div><div><dt className="text-emerald-800">{event.kind === "REFUND" ? "Variation du reste" : "Reste estimé"}</dt><dd className="mt-1 font-bold text-emerald-900">{financeMoney(event.availableCents)}</dd></div></dl>
          </div>)}</div>}
          {events.some((event) => event.crossMonthRefund) && <p className="m-5 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Un remboursement concerne un encaissement d’un autre mois. L’ajustement de provision est affiché à sa date de remboursement ; vérifiez la régularisation à effectuer auprès de l’Urssaf si la période initiale a déjà été déclarée.</p>}
        </section>
        {data.projections.length > 0 && <section className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-5"><h2 className="text-lg font-bold text-gray-950">En attente d’encaissement</h2><p className="mt-1 text-sm text-gray-600">Ces estimations sont exclues des totaux mensuels. Le taux sera celui applicable au jour de l’encaissement.</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{data.projections.map((item) => <div key={item.id} className="rounded-lg border border-blue-100 bg-white p-4"><Link href={`/admin/bookings?bookingId=${item.bookingId}`} className="font-bold text-gray-900 underline underline-offset-4">{item.clientName}</Link><p className="mt-1 text-xs text-gray-600">{labels[item.serviceType] || item.serviceType}{item.pets.length ? ` · ${item.pets.join(", ")}` : ""}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-gray-500">Brut prévu</dt><dd className="font-semibold">{financeMoney(item.grossCents)}</dd></div><div><dt className="text-xs text-gray-500">Frais Stripe estimés</dt><dd className="font-semibold">{financeMoney(item.feeCents)}</dd></div><div><dt className="text-xs text-amber-800">À mettre de côté · {financePercent(item.rateBps)} %</dt><dd className="font-bold text-amber-900">{financeMoney(item.provisionCents)}</dd></div><div><dt className="text-xs text-emerald-800">Reste estimé</dt><dd className="font-bold text-emerald-900">{financeMoney(item.availableCents)}</dd></div></dl></div>)}</div></section>}
        {session.user.role === "ADMIN" && <FinanceSettingsForm settings={data.settings} onSaved={() => fetchRevenue()} />}
        <div className="space-y-2 text-xs leading-5 text-gray-500"><p>* Frais estimés : hypothèse carte standard EEE, 1,5 % + 0,25 € par paiement. Les frais observés dans Stripe les remplacent dès qu’ils sont disponibles. Les frais de litige, de virement et d’abonnement Stripe ne sont pas inclus.</p><p>Périmètre : réservations et suppléments du site. Abonnements Premium et encaissements hors site exclus. Les remboursements réduisent la provision estimée, mais ne prouvent pas un remboursement de cotisations par l’Urssaf.</p><p>Données Stripe conservées jusqu’à 15 minutes. « Actualiser » relit les paiements. <a className="underline" href="https://entreprendre.service-public.gouv.fr/vosdroits/F36232" target="_blank" rel="noreferrer">Règles Urssaf</a> · <a className="underline" href="https://stripe.com/fr/pricing" target="_blank" rel="noreferrer">Tarifs Stripe</a></p></div>
      </>}
    </div>
  );
}
