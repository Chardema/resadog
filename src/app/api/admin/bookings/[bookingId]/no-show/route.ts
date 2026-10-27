import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { ATTENDANCE_POLICY_VERSION, noShowMessage, noShowTimingError, parisAppointment } from "@/lib/booking-attendance";
import { deliverBookingNotice } from "@/lib/booking-notices";
import { reverseBookingLoyalty } from "@/lib/loyalty-ledger";

const inputSchema = z.object({
  confirmed: z.literal(true),
  reminderSentAt: z.string().min(16),
  responseDeadline: z.string().min(16),
  contactEvidence: z.string().trim().min(20).max(1500),
  lossEvidence: z.string().trim().min(20).max(1500),
  legacyDeadlineAgreed: z.boolean().optional(),
});
export const maxDuration = 60;
export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !["ADMIN", "SITTER"].includes(session.user.role)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  try {
    const input = inputSchema.parse(await request.json());
    const { bookingId } = await params;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { client: true, pets: true, pet: true, payment: true, noShow: true } });
    if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
    const noticeId = `booking-${bookingId}-no-show`;
    if (booking.noShow && booking.status === "CANCELLED") return NextResponse.json({ cancelled: true, ...await deliverBookingNotice(noticeId) });
    const now = new Date();
    const timingError = noShowTimingError(booking, input, now);
    if (timingError) return NextResponse.json({ error: timingError }, { status: 409 });
    const reminderSentAt = parisAppointment(input.reminderSentAt, input.reminderSentAt.slice(11,16))!;
    const responseDeadline = parisAppointment(input.responseDeadline, input.responseDeadline.slice(11,16))!;
    const payment = booking.payment;
    if (!payment?.stripePaymentId || !payment.stripeCheckoutSessionId || payment.status !== "SUCCEEDED" || payment.refundStatus || payment.refundAmount || payment.stripeRefundId) return NextResponse.json({ error: "Paiement ou preuve des conditions à vérifier avant toute retenue." }, { status: 409 });
    const [intent, checkout, refunds] = await Promise.all([
      stripe.paymentIntents.retrieve(payment.stripePaymentId),
      stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId),
      stripe.refunds.list({ payment_intent: payment.stripePaymentId, limit: 1 }),
    ]);
    const version = checkout.metadata?.legalVersion;
    if (checkout.metadata?.legalAccepted !== "true" || !version || version < "2026-09-08") return NextResponse.json({ error: "Preuve des CGV acceptées insuffisante : traiter cette situation individuellement." }, { status: 409 });
    if (version < ATTENDANCE_POLICY_VERSION && !input.legacyDeadlineAgreed) return NextResponse.json({ error: "Anciennes CGV : le délai de 30 minutes ne peut pas être appliqué rétroactivement. Consignez un délai supplémentaire expressément convenu avec le client." }, { status: 409 });
    const retainedAmount = intent.amount_received / 100;
    if (intent.status !== "succeeded" || intent.currency !== "eur" || refunds.data.some(r => !["failed", "canceled"].includes(r.status || "")) || Math.abs(retainedAmount - booking.totalPrice) > 0.01) return NextResponse.json({ error: "Le paiement Stripe nécessite une vérification ; aucune annulation effectuée." }, { status: 409 });
    const message = noShowMessage(booking, retainedAmount, now);
    await prisma.$transaction(async tx => {
      const result = await tx.booking.updateMany({ where: { id: bookingId, status: "CONFIRMED", updatedAt: booking.updatedAt, payment: { is: { status: "SUCCEEDED", refundStatus: null, stripeRefundId: null } } }, data: {
        status: "CANCELLED", cancellationOrigin: "CLIENT", cancelledAt: now, cancellationReason: "Non-présentation au dépôt après relance écrite restée sans réponse. Retenue examinée au cas par cas, sans nouveau prélèvement.",
      } });
      if (!result.count) throw new Error("La réservation vient de changer : rechargez la page avant de réessayer.");
      await tx.bookingNoShow.create({ data: { bookingId, actorId: session.user.id, contactEvidence: input.contactEvidence, lossEvidence: input.lossEvidence, legalVersion: version, retainedAmount, reminderSentAt, responseDeadline } });
      await reverseBookingLoyalty(bookingId, "Non-présentation", tx);
      await tx.bookingNotice.create({ data: { id: noticeId, bookingId, kind: "NO_SHOW", to: booking.client.email, ...message } });
    });
    return NextResponse.json({ cancelled: true, ...await deliverBookingNotice(noticeId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Confirmez la vérification des droits du client et renseignez la relance ainsi que le préjudice." }, { status: 400 });
    console.error("Non-présentation :", error);
    return NextResponse.json({ error: "Traitement non confirmé. Rechargez la réservation ; si elle est annulée pour absence, utilisez Réessayer l’envoi." }, { status: 502 });
  }
}
