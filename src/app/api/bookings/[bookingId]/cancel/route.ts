import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { z } from "zod";

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
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { confirmed, reason } = cancelSchema.parse(await request.json());
    if (!confirmed) return NextResponse.json({ error: "Confirmation requise" }, { status: 400 });

    const { bookingId } = await params;
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId: session.user.id },
      include: { payment: true },
    });

    if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
    if (booking.status === "CANCELLED") return NextResponse.json({ success: true, unchanged: true });
    if (!(["PENDING", "CONFIRMED"] as string[]).includes(booking.status)) {
      return NextResponse.json({ error: "Cette réservation ne peut plus être annulée en ligne" }, { status: 409 });
    }

    const startsAt = getParisDateTime(booking.startDate, booking.startTime);
    const hoursBeforeStart = (startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursBeforeStart <= 0) {
      return NextResponse.json({ error: "La prestation a déjà commencé" }, { status: 409 });
    }

    const freeCancellation = hoursBeforeStart >= 48;
    let creditsRestored = 0;
    let amountRefunded = 0;
    let amountRetained = 0;

    if (booking.creditsUsed > 0) {
      if (freeCancellation) creditsRestored = booking.creditsUsed;
    } else if (booking.payment) {
      if (booking.payment.status === "PROCESSING" && !booking.payment.stripePaymentId) {
        return NextResponse.json({ error: "Autorisation Stripe introuvable, contactez le support" }, { status: 409 });
      }

      if (booking.payment.stripePaymentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);

        if (paymentIntent.status === "requires_capture") {
          if (freeCancellation) {
            await stripe.paymentIntents.cancel(paymentIntent.id);
          } else {
            const amountToCapture = Math.round(paymentIntent.amount * 0.5);
            await stripe.paymentIntents.capture(paymentIntent.id, { amount_to_capture: amountToCapture });
            amountRetained = amountToCapture / 100;
          }
        } else if (paymentIntent.status === "succeeded") {
          const refundCents = freeCancellation
            ? paymentIntent.amount_received
            : Math.round(paymentIntent.amount_received * 0.5);
          if (refundCents > 0) {
            await stripe.refunds.create({ payment_intent: paymentIntent.id, amount: refundCents });
            amountRefunded = refundCents / 100;
            amountRetained = paymentIntent.amount_received / 100 - amountRefunded;
          }
        } else if (paymentIntent.status !== "canceled") {
          return NextResponse.json(
            { error: `Le paiement ne peut pas être annulé (statut Stripe: ${paymentIntent.status})` },
            { status: 409 }
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (creditsRestored > 0) {
        await tx.creditBatch.create({
          data: {
            userId: session.user.id,
            amount: creditsRestored,
            remaining: creditsRestored,
            serviceType: booking.serviceType,
            expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
          },
        });
      }

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
            refundedAt: amountRefunded > 0 || freeCancellation ? new Date() : booking.payment.refundedAt,
            refundAmount: amountRefunded,
            amount: amountRetained > 0 ? amountRetained : booking.payment.amount,
          },
        });
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancellationReason: reason || "Annulation demandée par le client",
        },
      });
    });

    return NextResponse.json({
      success: true,
      policy: freeCancellation ? "FREE" : "LATE",
      creditsRestored,
      amountRefunded,
      amountRetained,
    });
  } catch (error) {
    console.error("Erreur annulation client:", error);
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Confirmation invalide" }, { status: 400 });
    return NextResponse.json({ error: "Impossible d'annuler la réservation" }, { status: 500 });
  }
}
