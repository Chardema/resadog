import { isDirectPayment } from "@/lib/direct-booking";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import {
  sendBookingConfirmationEmail,
  sendBookingRefundCompletedEmail,
  sendBookingTeamCancellationEmail,
} from "@/lib/email";
import { z } from "zod";
import {
  BookingConfirmationError,
  claimBookingForConfirmation,
  releaseBookingConfirmationClaim,
} from "@/lib/booking-confirmation";
import { awardBookingLoyalty, reverseBookingLoyalty } from "@/lib/loyalty-ledger";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { completeBookings } from "@/lib/complete-bookings";
import type { BookingStatus } from "@prisma/client";
import {
  processTeamCancellationPayment,
  TeamCancellationPaymentError,
  type TeamCancellationPaymentResult,
} from "@/lib/team-booking-cancellation";

const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
  reason: z.string().trim().max(500).optional(),
  confirmed: z.boolean().optional(),
  bookingIds: z.array(z.string().min(1)).min(1).max(50).optional(),
}).superRefine((data, ctx) => {
  if (data.status === "CANCELLED" && !data.reason) {
    ctx.addIssue({
      code: "custom",
      path: ["reason"],
      message: "Le motif de l'annulation est requis pour informer le client",
    });
  }
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  let cancellationClaim: { bookingId: string; previousStatus: BookingStatus } | null = null;

  try {
    const session = await auth();

    // Vérifier si l'utilisateur est admin ou sitter
    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { bookingId } = await params;
    const { status, reason, confirmed, bookingIds } = statusUpdateSchema.parse(await request.json());

    if (status !== "COMPLETED") {
      const direct = await prisma.booking.findUnique({ where: { id: bookingId }, select: { payment: { select: { paymentMethod: true } } } });
      if (isDirectPayment(direct?.payment?.paymentMethod)) return NextResponse.json({ error: "Utilisez les actions de la réservation directe pour suivre le paiement ou l’annuler." }, { status: 409 });
    }

    if (status === "COMPLETED") {
      try { return NextResponse.json(await completeBookings(bookingId, bookingIds || [bookingId])); }
      catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de terminer la sélection." }, { status: 409 }); }
    }

    if (status === "CANCELLED" && confirmed !== true) {
      return NextResponse.json(
        { error: "Confirmation de l'annulation requise" },
        { status: 400 }
      );
    }

    let booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        payment: true,
        client: true,
        pets: true,
        pet: true
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    if (booking.status === status) {
      return NextResponse.json({ success: true, booking, unchanged: true });
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Une réservation annulée ne peut pas être réactivée" },
        { status: 409 }
      );
    }

    if (status === "CANCELLED" && booking.status === "ACCEPTING") {
      return NextResponse.json(
        { error: "Une opération de paiement est déjà en cours sur cette réservation." },
        { status: 409 }
      );
    }

    if (
      status === "CANCELLED" &&
      booking.status === "CANCELLING" &&
      booking.cancellationOrigin !== "TEAM"
    ) {
      return NextResponse.json(
        { error: "Une annulation client est déjà en cours sur cette réservation." },
        { status: 409 }
      );
    }

    if (
      status === "CANCELLED" &&
      !(["PENDING", "CONFIRMED", "CANCELLING"] as BookingStatus[]).includes(booking.status)
    ) {
      return NextResponse.json(
        { error: "Cette réservation ne peut plus être annulée depuis l'administration." },
        { status: 409 }
      );
    }

    // Une réservation payante ne doit jamais être confirmée sans autorisation Stripe.
    if (
      status === "CONFIRMED" &&
      (!booking.payment || !booking.payment.stripePaymentId)
    ) {
      return NextResponse.json(
        { error: "Aucune autorisation Stripe n'est rattachée à cette réservation" },
        { status: 409 }
      );
    }

    if (status === "CONFIRMED") {
      try {
        const claim = await claimBookingForConfirmation(bookingId);
        booking = claim.booking;
        if (claim.unchanged) {
          return NextResponse.json({ success: true, booking, unchanged: true });
        }
      } catch (error) {
        if (error instanceof BookingConfirmationError) {
          return NextResponse.json(
            { error: error.message, blockedDates: error.blockedDates },
            { status: error.code === "NOT_FOUND" ? 404 : 409 }
          );
        }
        throw error;
      }
    }

    let confirmationEmailSent: boolean | null = null;
    let confirmationEmailError: string | null = null;
    let rejectionEmailSent: boolean | null = null;
    let rejectionEmailError: string | null = null;
    let refundCompletionEmailSent: boolean | null = null;
    let refundCompletionEmailError: string | null = null;
    let cancellationPayment: TeamCancellationPaymentResult | null = null;

    let updatedBooking = null;

    // Gestion de la CONFIRMATION (capture de l'argent puis validation atomique)
    if (status === "CONFIRMED" && booking.payment?.stripePaymentId) {
      let paymentIntent = null;
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);
        
        if (paymentIntent.status === 'requires_capture') {
          paymentIntent = await stripe.paymentIntents.capture(
            booking.payment.stripePaymentId,
            {},
            { idempotencyKey: `booking:${booking.id}:confirmation-capture` }
          );
        } else if (paymentIntent.status !== 'succeeded') {
          await releaseBookingConfirmationClaim(booking.id);
          return NextResponse.json(
            { error: `Le paiement Stripe ne peut pas être capturé (statut: ${paymentIntent.status})` },
            { status: 409 }
          );
        }
      } catch (err) {
        console.error("Erreur capture Stripe:", err);
        // Une coupure réseau peut masquer une capture réussie. On relit Stripe
        // avant de libérer la capacité afin d'éviter un paiement encaissé mais PENDING.
        paymentIntent = await stripe.paymentIntents
          .retrieve(booking.payment.stripePaymentId)
          .catch(() => null);
        if (paymentIntent?.status !== "succeeded") {
          await releaseBookingConfirmationClaim(booking.id);
          return NextResponse.json({ error: "Impossible de capturer le paiement" }, { status: 502 });
        }
      }

      const capturedAmount = paymentIntent.amount_received / 100;
      updatedBooking = await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: booking.payment!.id },
          data: {
            status: "SUCCEEDED",
            paidAt: booking.payment!.paidAt || new Date(),
            capturedAmount,
          },
        });
        const confirmedBooking = await tx.booking.updateMany({
          where: { id: booking.id, status: { in: ["ACCEPTING", "CONFIRMED"] } },
          data: { status: "CONFIRMED", cancellationReason: null, depositPaid: true },
        });
        if (confirmedBooking.count !== 1) {
          throw new Error(`Verrou de confirmation perdu pour ${booking.id}`);
        }
        return tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
      });
    }

    if (status === "CANCELLED" && booking.status !== "CANCELLING") {
      const claimed = await prisma.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: "CANCELLING", cancellationOrigin: "TEAM" },
      });
      if (claimed.count !== 1) {
        return NextResponse.json(
          { error: "La réservation vient d'être modifiée. Rechargez la page." },
          { status: 409 }
        );
      }
      cancellationClaim = { bookingId: booking.id, previousStatus: booking.status };
    }

    if (status === "CANCELLED") {
      cancellationPayment = await processTeamCancellationPayment(booking.id, booking.payment);
    }

    if (!updatedBooking && status === "CANCELLED") {
      updatedBooking = await prisma.$transaction(async (tx) => {
        if (booking.payment && cancellationPayment?.paymentUpdate) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: cancellationPayment.paymentUpdate,
          });
        }

        const cancelled = await tx.booking.updateMany({
          where: { id: bookingId, status: "CANCELLING", cancellationOrigin: "TEAM" },
          data: {
            status: "CANCELLED",
            cancellationReason: reason,
            cancellationOrigin: "TEAM",
            cancelledAt: new Date(),
          },
        });
        if (cancelled.count !== 1) throw new Error(`Verrou d'annulation perdu pour ${bookingId}`);

        await reverseBookingLoyalty(bookingId, "Réservation annulée par l'équipe", tx);
        return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      });
      cancellationClaim = null;
    } else if (!updatedBooking) {
      updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status,
          cancellationReason: status === "CANCELLED"
            ? reason
            : null,
        },
      });
    }

    if (status === "CONFIRMED") {
      await awardBookingLoyalty(bookingId);
      try {
        const bookingDetails = getBookingEmailDetails(booking);
        await sendBookingConfirmationEmail(
          booking.client.email,
          booking.client.name || "Client",
          bookingDetails,
          { idempotencyKey: `booking-confirmation-${booking.id}` }
        );
        confirmationEmailSent = true;
      } catch (emailError) {
        confirmationEmailSent = false;
        confirmationEmailError = emailError instanceof Error ? emailError.message : "Email de confirmation non envoyé";
        console.error("Réservation confirmée, mais email de confirmation non envoyé:", emailError);
      }
    } else if (status === "CANCELLED") {
      const bookingDetails = getBookingEmailDetails(booking);
      const isRefund = cancellationPayment?.action === "REFUND_PENDING" || cancellationPayment?.action === "REFUND_SUCCEEDED";
      try {
        await sendBookingTeamCancellationEmail(
          booking.client.email,
          booking.client.name || "Client",
          reason as string,
          bookingDetails,
          {
            idempotencyKey: `booking-team-cancellation-${booking.id}`,
            paymentAction: cancellationPayment?.action === "REFUND_SUCCEEDED"
              ? "REFUND_PENDING"
              : cancellationPayment?.action || "NO_PAYMENT",
            amountRefunded: cancellationPayment?.amountRefunded || 0,
          }
        );
        if (booking.payment && isRefund) {
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: { refundStartedEmailSentAt: new Date() },
          });
        }
        rejectionEmailSent = true;
      } catch (emailError) {
        rejectionEmailSent = false;
        rejectionEmailError = emailError instanceof Error ? emailError.message : "Email d'annulation non envoyé";
        console.error("Réservation annulée, mais email d'annulation non envoyé:", emailError);
      }

      if (
        rejectionEmailSent &&
        cancellationPayment?.refundStatus === "SUCCEEDED" &&
        cancellationPayment.refundId &&
        booking.payment
      ) {
        try {
          await sendBookingRefundCompletedEmail(
            booking.client.email,
            booking.client.name || "Client",
            bookingDetails,
            {
              amount: cancellationPayment.amountRefunded,
              refundId: cancellationPayment.refundId,
            },
            { idempotencyKey: `booking-refund-completed-${booking.id}` }
          );
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: { refundCompletedEmailSentAt: new Date() },
          });
          refundCompletionEmailSent = true;
        } catch (emailError) {
          refundCompletionEmailSent = false;
          refundCompletionEmailError = emailError instanceof Error
            ? emailError.message
            : "Email de remboursement finalisé non envoyé";
          console.error("Remboursement finalisé, mais email client non envoyé:", emailError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      confirmationEmailSent,
      confirmationEmailError,
      rejectionEmailSent,
      rejectionEmailError,
      refundCompletionEmailSent,
      refundCompletionEmailError,
      cancellationPayment: cancellationPayment && {
        action: cancellationPayment.action,
        amountRefunded: cancellationPayment.amountRefunded,
        refundStatus: cancellationPayment.refundStatus,
      },
    });
  } catch (error) {
    if (cancellationClaim) {
      await prisma.booking.updateMany({
        where: { id: cancellationClaim.bookingId, status: "CANCELLING" },
        data: { status: cancellationClaim.previousStatus, cancellationOrigin: null },
      }).catch((recoveryError) => console.error("Annulation admin non restaurée:", recoveryError));
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    if (error instanceof TeamCancellationPaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Erreur lors de la mise à jour du statut:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }
    const { bookingId } = await params;

    await reverseBookingLoyalty(bookingId, "Réservation supprimée par l'équipe");
    
    // Supprimer d'abord les paiements liés et charges additionnelles
    await prisma.payment.deleteMany({ where: { bookingId } });
    await prisma.additionalCharge.deleteMany({ where: { bookingId } });

    // Puis supprimer la réservation
    await prisma.booking.delete({ where: { id: bookingId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
