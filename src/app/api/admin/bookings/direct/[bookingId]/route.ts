import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getTodayDateKey } from "@/lib/booking-dates";
import { isDirectPayment } from "@/lib/direct-booking";

const schema = z.object({ action: z.enum(["PAID", "CANCEL"]), reference: z.string().trim().min(5).max(500), date: z.iso.date(), refunded: z.boolean().default(false) }).refine(v => v.date <= getTodayDateKey(), "La date ne peut pas être dans le futur.");
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { bookingId } = await params;
  const input = parsed.data;
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${bookingId}, 0))`;
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
      if (!booking?.payment || !isDirectPayment(booking.payment.paymentMethod) || booking.payment.stripePaymentId) throw new Error("Réservation directe introuvable.");
      const payment = booking.payment;
      const date = new Date(`${input.date}T12:00:00Z`);
      if (input.action === "PAID") {
        if (booking.status === "CANCELLED") throw new Error("Cette réservation est annulée.");
        if (payment.status === "SUCCEEDED") return;
        if (payment.status !== "PENDING") throw new Error("Paiement non modifiable.");
        await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", capturedAmount: payment.amount, paidAt: date } });
      } else {
        if (booking.status === "CANCELLED") return;
        if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) throw new Error("Cette réservation ne peut pas être annulée ici.");
        if (payment.status === "SUCCEEDED" && (!input.refunded || !payment.paidAt || date < new Date(payment.paidAt.toISOString().slice(0, 10)))) throw new Error("Enregistrez uniquement un remboursement intégral réellement effectué, après l’encaissement.");
        if (!["PENDING", "SUCCEEDED"].includes(payment.status)) throw new Error("Vérifiez d’abord le statut du paiement.");
        await tx.payment.update({ where: { id: payment.id }, data: payment.status === "SUCCEEDED" ? { status: "REFUNDED", refundAmount: payment.capturedAmount, refundedAt: date, refundStatus: "SUCCEEDED" } : { status: "FAILED" } });
        await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationOrigin: "TEAM", cancellationReason: input.reference } });
      }
      await tx.booking.update({ where: { id: bookingId }, data: { notes: `${booking.notes || ""}\n${input.action} enregistré par ${session.user.id} le ${new Date().toISOString()} ; date réelle ${input.date} ; ${input.reference}` } });
    });
    return NextResponse.json({ success: true, message: "Enregistrement effectué. Aucun transfert bancaire ni message automatique." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 409 });
  }
}
