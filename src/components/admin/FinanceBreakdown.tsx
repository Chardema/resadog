import type { BookingFinance } from "@/lib/finance";

export const financeMoney = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value / 100);
export const financePercent = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value / 100);

export function FinanceBreakdown({ finance }: { finance: BookingFinance }) {
  const projected = finance.grossCents === 0 && finance.projected !== null;
  const amounts = projected ? finance.projected! : finance;
  const paymentLabel = finance.projected ? projected ? "Paiement à encaisser" : "Encaissement partiel" : "Paiement déjà encaissé";
  return (
    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs">
      <p className="font-bold text-gray-900">{finance.upcoming ? "Prévisionnel · réservation acceptée à venir" : projected ? "Si la réservation est encaissée" : "Votre répartition"}</p>
      {finance.upcoming && <p className="mt-1 leading-5 text-gray-600">{paymentLabel} · début le {new Date(finance.upcoming.startsAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}. La provision suit la date d’encaissement.</p>}
      <dl className="mt-3 space-y-2">
        <div className="flex justify-between gap-3"><dt>{projected ? "Brut prévu" : "Brut encaissé"}</dt><dd className="font-semibold tabular-nums">{financeMoney(amounts.grossCents)}</dd></div>
        {amounts.refundCents > 0 && <div className="flex justify-between gap-3"><dt>Remboursé</dt><dd className="tabular-nums">−{financeMoney(amounts.refundCents)}</dd></div>}
        <div className="flex justify-between gap-3"><dt>Frais Stripe{amounts.estimatedFeeCount > 0 ? " estimés" : " observés"}</dt><dd className="tabular-nums">{financeMoney(amounts.feeCents)}</dd></div>
        <div className="flex justify-between gap-3 text-amber-900"><dt>À mettre de côté · Urssaf estimée</dt><dd className="font-bold tabular-nums">{financeMoney(amounts.provisionCents)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-emerald-200 pt-2 text-sm text-emerald-950"><dt className="font-bold">Reste estimé</dt><dd className="font-bold tabular-nums">{financeMoney(amounts.availableCents)}</dd></div>
      </dl>
      <p className="mt-2 leading-5 text-gray-600">Provision indicative selon vos réglages dans Finance. Avant autres dépenses et impôts non inclus dans votre taux. Aucun argent n’est déplacé.</p>
      {amounts.estimatedFeeCount > 0 && <p className="mt-1 leading-5 text-gray-500">Frais prévus sur la base d’une carte standard EEE (1,5 % + 0,25 € par paiement) ; le coût réel peut varier.</p>}
    </div>
  );
}
