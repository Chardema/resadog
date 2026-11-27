import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  findClientBalanceInstallment,
  getBalancePaymentState,
  getInstallmentAmountDue,
  isBalanceCollectionEnabled,
  type BalancePaymentState,
} from "@/lib/balance-collection";
import { getBalanceSchedule } from "@/lib/payment-plan";

// Reprise du solde (spec 07, lot 5). La page n'appelle jamais Stripe : la
// session Checkout est créée au clic, par la route balance-checkout.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_PAID: "Le solde de cette réservation est déjà réglé.",
  IN_PROGRESS: "Un paiement du solde est déjà en cours de traitement. Réessayez dans quelques minutes.",
  BUSY: "Une page de paiement est déjà en cours d'ouverture. Réessayez dans quelques minutes.",
  DEADLINE_PASSED: "La date limite de paiement du solde est dépassée.",
  NOT_PAYABLE: "Le solde de cette réservation ne peut pas être réglé en ligne pour le moment.",
  NOT_FOUND: "Le solde de cette réservation ne peut pas être réglé en ligne pour le moment.",
  STRIPE: "Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes.",
};

const STATE_MESSAGES: Record<Exclude<BalancePaymentState, "PAYABLE">, string> = {
  PAID: "Le solde de cette réservation est réglé. Merci !",
  SCHEDULED: "Le solde sera prélevé automatiquement à la date prévue : vous n'avez rien à faire.",
  IN_PROGRESS: "Un paiement du solde est en cours de traitement. Revenez dans quelques minutes.",
  CLOSED: "Le solde de cette réservation ne peut plus être réglé en ligne. Contactez-nous si besoin.",
};

const formatAmount = (amount: number) =>
  `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const formatParis = (date: Date, withTime = false) =>
  date.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  });

export default async function BalancePaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  if (!isBalanceCollectionEnabled()) notFound();

  const { id } = await params;
  const { error, paid } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/dashboard/bookings/${id}/pay`)}`);
  }

  const installment = await findClientBalanceInstallment(id, session.user.id);
  if (!installment) notFound();

  const now = new Date();
  const state = getBalancePaymentState(installment, now);
  const { amountDue } = getInstallmentAmountDue(installment);
  const deadline = getBalanceSchedule(installment.booking.startDate).finalDeadlineAt;
  const reference = `#${installment.bookingId.slice(-8).toUpperCase()}`;
  // Retour de Checkout avant le webhook : le paiement est reçu, la
  // confirmation arrive dans un instant.
  const justPaid = paid === "1" && state !== "PAID";
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.NOT_PAYABLE : null;

  return (
    <div className="min-h-screen bg-[#FDFbf7] px-6 pb-16 pt-28 md:pt-36">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-orange-100 bg-white p-8 shadow-xl md:p-10">
        <h1 className="mb-2 text-3xl font-extrabold text-gray-900">Régler le solde</h1>
        <p className="mb-6 text-sm text-gray-500">
          Réservation <span className="font-mono font-bold text-gray-900">{reference}</span>
        </p>

        <dl className="mb-6 space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Solde à régler</dt>
            <dd className="font-bold text-gray-900">{formatAmount(amountDue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Début de la garde</dt>
            <dd className="font-medium text-gray-900">{formatParis(installment.booking.startDate)}</dd>
          </div>
          {state === "PAYABLE" && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Date limite</dt>
              <dd className="font-medium text-gray-900">{formatParis(deadline, true)}</dd>
            </div>
          )}
        </dl>

        {errorMessage && (
          <p role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-800">
            {errorMessage}
          </p>
        )}

        {justPaid ? (
          <p className="mb-6 rounded-xl border border-green-100 bg-green-50 p-4 text-sm font-medium text-green-800">
            Paiement reçu : la confirmation vous est envoyée par e-mail dans quelques instants.
          </p>
        ) : state === "PAYABLE" ? (
          <>
            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              Le prélèvement automatique du solde a échoué. Réglez-le par carte avant la date limite : sans paiement, la réservation sera annulée et l&apos;acompte conservé, conformément aux conditions générales de vente.
            </p>
            <form method="POST" action={`/api/bookings/${encodeURIComponent(installment.bookingId)}/balance-checkout`}>
              <button
                type="submit"
                className="h-14 w-full rounded-xl bg-gray-900 text-lg font-bold text-white shadow-xl transition-colors hover:bg-orange-600"
              >
                Payer le solde par carte
              </button>
            </form>
          </>
        ) : (
          <p className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-700">
            {STATE_MESSAGES[state]}
          </p>
        )}

        <Link href="/dashboard" className="mt-6 block text-center text-sm font-bold text-gray-700 hover:text-orange-700">
          Retour à mon espace
        </Link>
      </div>
    </div>
  );
}
