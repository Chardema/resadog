import { isDirectPayment } from "@/lib/direct-booking";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { reverseBookingLoyalty } from "@/lib/loyalty-ledger";
import { STANDARD_FREE_CANCELLATION_HOURS } from "@/lib/subscription-pricing";
import { z } from "zod";
import type { RefundStatus } from "@prisma/client";

const cancelSchema = z.object({
  confirmed: z.literal(true),
  reason: z.string().trim().max(500).optional(),
});

function getParisDateTime(date: Date, time?: string | null) {
  const dateKey = date.toISOString().split("T")[0];
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = (time || "00:00").split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const representedAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
  return new Date(utcGuess.getTime() - (representedAsUtc - utcGuess.getTime()));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  let cancellationClaim: {
    bookingId: string;
    previousStatus: "PENDING" | "CONFIRMED";
  } | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { confirmed, reason } = cancelSchema.parse(await request.json());
    if (!confirmed) return NextResponse.json({ error: "Confirmation requise" }, { status: 400 });

    const { bookingId } = await params;
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId: session.user.id },
      include: {
        payment: true,
        client: { select: { subscription: { select: { status: true } } } },
      },
    });

    if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
    if (isDirectPayment(booking.payment?.paymentMethod)) return NextResponse.json({ error: "Pour annuler une réservation directe, contactez Mégane au 07 71 59 30 16." }, { status: 409 });
    if (booking.status === "CANCELLED") return NextResponse.json({ success: true, unchanged: true });
    if (!(["PENDING", "CONFIRMED"] as string[]).includes(booking.status)) {
      return NextResponse.json({ error: "Cette réservation ne peut plus être annulée en ligne" }, { status: 409 });
    }

    const startsAt = getParisDateTime(booking.startDate, booking.startTime);
    const hoursBeforeStart = (startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursBeforeStart <= 0) {
      return NextResponse.json({ error: "La prestation a déjà commencé" }, { status: 409 });
    }

    const freeCancellationWindowHours = STANDARD_FREE_CANCELLATION_HOURS;
    const freeCancellation = hoursBeforeStart >= freeCancellationWindowHours;
    let amountRefunded = 0;
    let amountRetained = 0;
    let capturedAmount = booking.payment?.capturedAmount || 0;
    let stripeRefundId: string | null = null;
    let refundStatus: RefundStatus | null = null;

    const previousStatus = booking.status === "PENDING" ? "PENDING" : "CONFIRMED";
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, status: previousStatus },
      data: { status: "CANCELLING", cancellationOrigin: "CLIENT" },
    });
    if (claimed.count !== 1) {
      return NextResponse.json(
        { error: "La réservation vient d'être modifiée. Rechargez la page." },
        { status: 409 }
      );
    }
    cancellationClaim = { bookingId: booking.id, previousStatus };

    if (booking.payment) {
      if (booking.payment.status === "PROCESSING" && !booking.payment.stripePaymentId) {
        await prisma.booking.updateMany({
          where: { id: booking.id, status: "CANCELLING" },
          data: { status: previousStatus, cancellationOrigin: null },
        });
        cancellationClaim = null;
        return NextResponse.json({ error: "Autorisation Stripe introuvable, contactez le support" }, { status: 409 });
      }
      if (booking.payment.status === "SUCCEEDED" && !booking.payment.stripePaymentId) {
        await prisma.booking.updateMany({
          where: { id: booking.id, status: "CANCELLING" },
          data: { status: previousStatus, cancellationOrigin: null },
        });
        cancellationClaim = null;
        return NextResponse.json(
          { error: "Paiement encaissé sans identifiant Stripe : remboursement manuel requis." },
          { status: 409 }
        );
      }

      if (booking.payment.stripePaymentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);

        if (paymentIntent.status === "requires_capture") {
          if (freeCancellation) {
            await stripe.paymentIntents.cancel(
              paymentIntent.id,
              {},
              { idempotencyKey: `booking:${booking.id}:release-authorization` }
            );
          } else {
            const amountToCapture = Math.round(paymentIntent.amount * 0.5);
            const capturedPaymentIntent = await stripe.paymentIntents.capture(
              paymentIntent.id,
              { amount_to_capture: amountToCapture },
              { idempotencyKey: `booking:${booking.id}:late-cancellation-capture` }
            );
            capturedAmount = capturedPaymentIntent.amount_received / 100;
            amountRetained = capturedAmount;
          }
        } else if (paymentIntent.status === "succeeded") {
          capturedAmount = paymentIntent.amount_received / 100;
          const refundCents = freeCancellation
            ? paymentIntent.amount_received
            : Math.round(paymentIntent.amount_received * 0.5);
          if (refundCents > 0) {
            const refund = await stripe.refunds.create(
              {
                payment_intent: paymentIntent.id,
                amount: refundCents,
                metadata: { bookingId: booking.id, cancellationOrigin: "CLIENT" },
              },
              { idempotencyKey: `booking:${booking.id}:client-cancellation-refund` }
            );
            if (refund.status === "failed" || refund.status === "canceled" || !refund.status) {
              throw new Error(`Le remboursement Stripe a échoué (statut : ${refund.status || "inconnu"})`);
            }
            stripeRefundId = refund.id;
            refundStatus = refund.status === "succeeded"
              ? "SUCCEEDED"
              : refund.status === "requires_action"
                ? "REQUIRES_ACTION"
                : "PENDING";
            amountRefunded = refundCents / 100;
            amountRetained = paymentIntent.amount_received / 100 - amountRefunded;
          }
        } else if (paymentIntent.status !== "canceled") {
          await prisma.booking.updateMany({
            where: { id: booking.id, status: "CANCELLING" },
            data: { status: previousStatus, cancellationOrigin: null },
          });
          cancellationClaim = null;
          return NextResponse.json(
            { error: `Le paiement ne peut pas être annulé (statut Stripe: ${paymentIntent.status})` },
            { status: 409 }
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (booking.payment) {
        const paymentStatus = freeCancellation
          ? "REFUNDED"
          : amountRefunded > 0
            ? "PARTIALLY_REFUNDED"
            : amountRetained > 0
              ? "SUCCEEDED"
              : booking.payment.status;
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: paymentStatus,
            refundedAt: refundStatus === "SUCCEEDED" || (freeCancellation && !stripeRefundId)
              ? new Date()
              : booking.payment.refundedAt,
            refundAmount: amountRefunded,
            capturedAmount,
            stripeRefundId,
            refundStatus,
            refundFailureReason: null,
          },
        });
      }

      const cancelled = await tx.booking.updateMany({
        where: { id: booking.id, status: "CANCELLING", cancellationOrigin: "CLIENT" },
        data: {
          status: "CANCELLED",
          cancellationReason: reason || "Annulation demandée par le client",
          cancellationOrigin: "CLIENT",
          cancelledAt: new Date(),
        },
      });
      if (cancelled.count !== 1) throw new Error(`Verrou d'annulation perdu pour ${booking.id}`);

      await reverseBookingLoyalty(booking.id, "Réservation annulée par le client", tx);
    });
    cancellationClaim = null;

    return NextResponse.json({
      success: true,
      policy: freeCancellation ? "FREE" : "LATE",
      freeCancellationWindowHours,
      amountRefunded,
      amountRetained,
    });
  } catch (error) {
    if (cancellationClaim) {
      await prisma.booking.updateMany({
        where: { id: cancellationClaim.bookingId, status: "CANCELLING" },
        data: { status: cancellationClaim.previousStatus, cancellationOrigin: null },
      }).catch((recoveryError) => console.error("Annulation non restaurée:", recoveryError));
    }
    console.error("Erreur annulation client:", error);
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Confirmation invalide" }, { status: 400 });
    return NextResponse.json({ error: "Impossible d'annuler la réservation" }, { status: 500 });
  }
}
