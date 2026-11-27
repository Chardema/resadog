import { getBalanceSchedule } from "@/lib/payment-plan";

// Plan acompte + solde (spec 07) : montants, état du solde, consentement au
// prélèvement hors session (MIT) et calendrier, pour l'équipe.

export type AdminBalanceInstallment = {
  status: "SCHEDULED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "REFUNDED";
  amount: number;
  dueAt: string;
  attempts: number;
  lastErrorCode?: string | null;
  paidAt?: string | null;
  refundedAmount?: number | null;
  stripePaymentIntentId?: string | null;
};

export type DepositPlanBooking = {
  startDate: string;
  totalPrice: number;
  depositAmount?: number | null;
  balanceAmount?: number | null;
  balanceDueAt?: string | null;
  mandateAcceptedAt?: string | null;
  mandateLegalVersion?: string | null;
  installments?: AdminBalanceInstallment[];
  payment?: { status: string; amount: number; capturedAmount: number } | null;
};

const money = (value: number) =>
  `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const parisDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

const parisDateTime = (value: Date | string) =>
  new Date(value).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

// Libellé du badge de paiement : état de l'acompte, complété par celui de
// l'échéance BALANCE une fois l'acompte encaissé.
export function getDepositPaymentLabel(status: string | undefined, balanceStatus?: AdminBalanceInstallment["status"] | null) {
  if (status === "PROCESSING") return "Acompte autorisé (non débité)";
  if (status !== "SUCCEEDED") return null;
  switch (balanceStatus) {
    case "SUCCEEDED":
      return "Acompte et solde encaissés";
    case "PROCESSING":
      return "Acompte encaissé · solde en cours";
    case "FAILED":
      return "Acompte encaissé · solde impayé";
    case "REFUNDED":
      return "Acompte encaissé · solde remboursé";
    case "CANCELED":
      return "Acompte encaissé · solde annulé";
    default:
      return "Acompte encaissé";
  }
}

// État court du solde, affiché à côté de son montant.
export function getBalanceShortLabel(installment: Pick<AdminBalanceInstallment, "status" | "dueAt" | "paidAt"> | null) {
  if (!installment) return "à programmer à l'acceptation";
  switch (installment.status) {
    case "SCHEDULED":
      return `programmé le ${parisDate(installment.dueAt)}`;
    case "PROCESSING":
      return "prélèvement en cours";
    case "SUCCEEDED":
      return installment.paidAt ? `payé le ${parisDate(installment.paidAt)}` : "payé";
    case "FAILED":
      return "en échec";
    case "CANCELED":
      return "annulé";
    case "REFUNDED":
      return "remboursé";
  }
}

function getBalanceStatus(installment: AdminBalanceInstallment, finalDeadlineAt: Date) {
  switch (installment.status) {
    case "SCHEDULED":
      return { label: `Prélèvement prévu le ${parisDate(installment.dueAt)}`, className: "text-gray-700" };
    case "PROCESSING":
      return { label: "Prélèvement en cours", className: "text-blue-800" };
    case "SUCCEEDED":
      return { label: `Acompte et solde encaissés${installment.paidAt ? ` · solde payé le ${parisDate(installment.paidAt)}` : ""}`, className: "text-emerald-800" };
    case "FAILED":
      return {
        label: `Échec${installment.lastErrorCode ? ` (${installment.lastErrorCode})` : ""} · ${installment.attempts} tentative(s) · paiement en ligne possible jusqu'au ${parisDateTime(finalDeadlineAt)}`,
        className: "text-red-800",
      };
    case "CANCELED":
      return { label: "Annulé, non prélevé", className: "text-gray-600" };
    case "REFUNDED":
      return { label: `Remboursé${installment.refundedAmount ? ` (${money(installment.refundedAmount)})` : ""}`, className: "text-purple-800" };
  }
}

export function DepositPlanDetails({ booking }: { booking: DepositPlanBooking }) {
  const schedule = getBalanceSchedule(booking.startDate);
  const installment = booking.installments?.[0] ?? null;
  const deposit = booking.payment?.amount || booking.depositAmount || 0;
  const balance = installment?.amount ?? booking.balanceAmount ?? Math.max(0, booking.totalPrice - deposit);
  const balanceStatus = installment ? getBalanceStatus(installment, schedule.finalDeadlineAt) : null;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3 text-xs">
      <p className="font-bold text-gray-900">Paiement en deux fois</p>
      <dl className="space-y-1.5">
        <div className="flex justify-between gap-3">
          <dt>Acompte (30 %)</dt>
          <dd className="font-semibold tabular-nums">
            {money(deposit)} · {booking.payment?.status === "SUCCEEDED" ? "encaissé" : booking.payment?.status === "PROCESSING" ? "autorisé, capturé à l'acceptation" : "non encaissé"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Solde</dt>
          <dd className="font-semibold tabular-nums">{money(balance)} · {getBalanceShortLabel(installment)}</dd>
        </div>
      </dl>
      <p className={`font-semibold ${balanceStatus?.className ?? "text-gray-600"}`}>
        {balanceStatus?.label ?? `Échéance créée à l'acceptation, prélèvement prévu le ${parisDate(booking.balanceDueAt || schedule.dueAt)}`}
      </p>
      {installment?.stripePaymentIntentId && (
        <p className="break-all font-mono text-[11px] text-gray-500">Solde : {installment.stripePaymentIntentId}</p>
      )}

      <div className="border-t border-orange-200 pt-2">
        <p className="font-bold text-gray-900">Autorisation de prélèvement du solde</p>
        {booking.mandateAcceptedAt ? (
          <p className="mt-1 leading-5 text-gray-700">
            Acceptée le {parisDateTime(booking.mandateAcceptedAt)} · CGV {booking.mandateLegalVersion || "version inconnue"} · solde de {money(booking.balanceAmount ?? balance)} le {parisDate(booking.balanceDueAt || schedule.dueAt)} sur la carte enregistrée.
          </p>
        ) : (
          <p className="mt-1 rounded-md bg-red-50 p-2 font-semibold leading-5 text-red-800">
            Aucune autorisation enregistrée : le solde ne sera pas prélevé automatiquement. Vérifiez avant d&apos;accepter.
          </p>
        )}
      </div>

      <div className="border-t border-orange-200 pt-2">
        <p className="font-bold text-gray-900">Calendrier</p>
        <ul className="mt-1 space-y-1 text-gray-700">
          <li>J-14 · {parisDate(schedule.noticeAt)} : rappel au client</li>
          <li>J-7 · {parisDate(schedule.dueAt)} : prélèvement automatique du solde</li>
          <li>J-5 et J-3 · {schedule.reminderAts.map((date) => parisDate(date)).join(" et ")} : relances et alerte équipe si impayé</li>
          <li>J-2 · {parisDateTime(schedule.finalDeadlineAt)} : annulation automatique si impayé, acompte conservé</li>
        </ul>
      </div>
    </div>
  );
}
