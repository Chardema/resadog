import Link from "next/link";
import { financeMoney } from "@/components/admin/FinanceBreakdown";
import { financeMonth, type FinanceUpcoming, type FinanceUpcomingMonth, type FinanceUpcomingSummary } from "@/lib/finance";

type Props = {
  year: number;
  month: string;
  monthly: FinanceUpcomingMonth[];
  summary: FinanceUpcomingSummary;
  bookings: FinanceUpcoming[];
  onMonthChange: (month: string) => void;
};
const dateLabel = (value: string) => new Date(value).toLocaleDateString("fr-FR", {
  timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric",
});
const moneyColumns = (amounts: FinanceUpcomingSummary) => <>
  <td className="px-4 py-3 text-right tabular-nums">{amounts.bookingCount}</td>
  <td className="px-4 py-3 text-right tabular-nums">{financeMoney(amounts.grossCents - amounts.refundCents)}</td>
  <td className="px-4 py-3 text-right tabular-nums">{financeMoney(amounts.feeCents)}{amounts.estimatedFeeCount ? " *" : ""}</td>
  <td className="bg-amber-50/60 px-4 py-3 text-right font-semibold tabular-nums text-amber-900">{financeMoney(amounts.provisionCents)}</td>
  <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-900">{financeMoney(amounts.availableCents)}</td>
</>;

export function UpcomingFinance({ year, month, monthly, summary, bookings, onMonthChange }: Props) {
  const visible = bookings.filter((booking) => month === "all" || financeMonth(booking.startsAt) === month);
  const period = month === "all" ? String(year) : monthly.find((item) => item.key === month)?.label;
  return (
    <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50/60 p-5">
        <h2 className="text-lg font-bold text-gray-950">Prévisionnel des réservations acceptées · {year}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-700">Prestations commençant aujourd’hui ou plus tard, classées par mois de début. Une garde sur plusieurs mois est comptée une seule fois, au mois de son début.</p>
        <p className="mt-1 text-xs leading-5 text-gray-600">Les paiements déjà reçus restent dans les encaissements réels à leur date de paiement. Cette vue ne s’ajoute pas au récapitulatif des encaissements.</p>
      </div>
      {summary.bookingCount === 0 ? <p className="p-5 text-sm text-gray-600">Aucune réservation acceptée à venir pour cette année.</p> : <>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <div><p className="text-xs font-semibold text-gray-500">Réservations à venir</p><p className="mt-1 text-xl font-bold text-gray-950">{summary.bookingCount}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Déjà encaissé</p><p className="mt-1 text-xl font-bold text-gray-950">{financeMoney(summary.collectedCents)}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Encore à encaisser</p><p className="mt-1 text-xl font-bold text-gray-950">{financeMoney(summary.toCollectCents)}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Prévisionnel des prestations acceptées par mois de début</caption>
            <thead className="border-y border-blue-100 bg-blue-50/40 text-xs text-gray-600"><tr>
              <th className="px-5 py-3 text-left">Mois de prestation</th><th className="px-4 py-3 text-right">Réservations</th>
              <th className="px-4 py-3 text-right">Montant prévu</th><th className="px-4 py-3 text-right">Frais Stripe</th>
              <th className="px-4 py-3 text-right">Urssaf estimée</th><th className="px-4 py-3 text-right">Reste estimé</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">{monthly.filter((item) => item.bookingCount > 0).map((item) => <tr key={item.key} className={month === item.key ? "bg-blue-50/30" : ""}>
              <th scope="row" className="px-5 py-3 text-left font-semibold"><button type="button" className="capitalize underline decoration-blue-300 underline-offset-4" onClick={() => onMonthChange(item.key)} aria-label={`Voir le prévisionnel de ${item.label}`}>{item.label}</button></th>
              {moneyColumns(item)}
            </tr>)}</tbody>
            <tfoot className="border-t border-blue-200 bg-blue-50/40 font-bold"><tr><th className="px-5 py-3 text-left">Total à venir</th>{moneyColumns(summary)}</tr></tfoot>
          </table>
        </div>
        <div className="p-5">
          <h3 className="font-bold text-gray-950">Détail des prestations à venir · {period}</h3>
          {visible.length === 0 ? <div className="mt-3 text-sm text-gray-600"><p>Aucune réservation acceptée à venir pour cette période.</p><button type="button" className="mt-2 font-semibold underline underline-offset-4" onClick={() => onMonthChange("all")}>Voir toute l’année</button></div> : <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {visible.map((booking) => <div key={booking.bookingId} className="rounded-lg border border-blue-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/admin/bookings?bookingId=${booking.bookingId}`} className="font-bold text-gray-950 underline decoration-gray-300 underline-offset-4">{booking.clientName}</Link>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900">{booking.toCollectCents === 0 ? "Déjà encaissé" : booking.collectedCents > 0 ? "Encaissement partiel" : "À encaisser"}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-600">{dateLabel(booking.startsAt)} → {dateLabel(booking.endsAt)}{booking.pets.length ? ` · ${booking.pets.join(", ")}` : ""}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-gray-500">Montant prévu</dt><dd className="font-semibold">{financeMoney(booking.grossCents - booking.refundCents)}</dd></div>
                <div><dt className="text-xs text-gray-500">Frais Stripe{booking.estimatedFeeCount ? " estimés" : " observés"}</dt><dd className="font-semibold">{financeMoney(booking.feeCents)}</dd></div>
                <div><dt className="text-xs text-amber-800">Provision Urssaf</dt><dd className="font-bold text-amber-900">{financeMoney(booking.provisionCents)}</dd></div>
                <div><dt className="text-xs text-emerald-800">Reste estimé</dt><dd className="font-bold text-emerald-900">{financeMoney(booking.availableCents)}</dd></div>
              </dl>
            </div>)}
          </div>}
          <p className="mt-4 text-xs leading-5 text-gray-500">Montants après les remboursements éventuels. La provision des paiements déjà reçus conserve le taux applicable à leur encaissement ; celle des paiements à venir reste estimative.</p>
        </div>
      </>}
    </section>
  );
}
