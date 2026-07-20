import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { sendBookingConfirmationEmail, sendBookingRejectionEmail } from "@/lib/email";
import { z } from "zod";
import {
  BookingConfirmationError,
  claimBookingForConfirmation,
  releaseBookingConfirmationClaim,
} from "@/lib/booking-confirmation";
import { awardBookingLoyalty, reverseBookingLoyalty } from "@/lib/loyalty-ledger";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { sendReviewRequestForBooking } from "@/lib/review-requests";
import type { BookingStatus } from "@prisma/client";

const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
  reason: z.string().trim().max(500).optional(),
  confirmed: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.status === "CANCELLED" && !data.reason) {
    ctx.addIssue({
      code: "custom",
      path: ["reason"],
      message: "Le motif du refus est requis pour informer le client",
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
    const { status, reason, confirmed } = statusUpdateSchema.parse(await request.json());

    if (status === "CANCELLED" && confirmed !== true) {
      return NextResponse.json(
        { error: "Confirmation de refus requise" },
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

    if (
      status === "CANCELLED" &&
      (booking.status === "ACCEPTING" || booking.status === "CANCELLING")
    ) {
      return NextResponse.json(
        { error: "Une opération de paiement est déjà en cours sur cette réservation." },
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
    let reviewRequestEmailSent: boolean | null = null;
    let reviewRequestEmailError: string | null = null;

    if (
      status === "COMPLETED" &&
      booking.status !== "CONFIRMED" &&
      booking.status !== "IN_PROGRESS"
    ) {
      return NextResponse.json(
        { error: "Seules les réservations confirmées ou en cours peuvent être terminées" },
        { status: 409 }
      );
    }

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

    if (status === "CANCELLED") {
      const claimed = await prisma.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: "CANCELLING" },
      });
      if (claimed.count !== 1) {
        return NextResponse.json(
          { error: "La réservation vient d'être modifiée. Rechargez la page." },
          { status: 409 }
        );
      }
      cancellationClaim = { bookingId: booking.id, previousStatus: booking.status };
    }

    // Gestion de l'annulation et du remboursement Stripe (ou libération empreinte)
    if (status === "CANCELLED" && booking.payment) {
      if (!booking.payment.stripePaymentId) {
        if (booking.payment.status === "SUCCEEDED") {
          await prisma.booking.updateMany({
            where: { id: booking.id, status: "CANCELLING" },
            data: { status: booking.status },
          });
          cancellationClaim = null;
          return NextResponse.json(
            { error: "Paiement marqué encaissé mais identifiant Stripe absent : remboursement manuel requis avant annulation." },
            { status: 409 }
          );
        }

        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: "REFUNDED", capturedAmount: 0, refundedAt: new Date(), refundAmount: 0 },
        });
      } else {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);

        if (paymentIntent.status === 'requires_capture') {
           // Annuler l'empreinte (Le client n'est pas débité)
           await stripe.paymentIntents.cancel(
             booking.payment.stripePaymentId,
             {},
             { idempotencyKey: `booking:${booking.id}:release-authorization` }
           );
           await prisma.payment.update({
             where: { id: booking.payment.id },
             data: { status: "REFUNDED", capturedAmount: 0, refundedAt: new Date(), refundAmount: 0 },
           });
        } else if (paymentIntent.status === 'succeeded') {
           // Rembourser via Stripe
           await stripe.refunds.create(
             { payment_intent: booking.payment.stripePaymentId },
             { idempotencyKey: `booking:${booking.id}:cancellation-refund` }
           );
   
           // Mettre à jour le statut du paiement
           await prisma.payment.update({
             where: { id: booking.payment.id },
             data: {
               status: "REFUNDED",
               capturedAmount: paymentIntent.amount_received / 100,
               refundedAt: new Date(),
               refundAmount: paymentIntent.amount_received / 100,
             },
           });
        } else if (paymentIntent.status === 'canceled') {
           await prisma.payment.update({
             where: { id: booking.payment.id },
             data: { status: "REFUNDED", capturedAmount: 0, refundedAt: new Date(), refundAmount: 0 },
           });
        } else if (
          paymentIntent.status === 'requires_payment_method' ||
          paymentIntent.status === 'requires_confirmation' ||
          paymentIntent.status === 'requires_action'
        ) {
           await prisma.payment.update({
             where: { id: booking.payment.id },
             data: { status: "REFUNDED", capturedAmount: 0, refundedAt: new Date(), refundAmount: 0 },
           });
        } else {
          await prisma.booking.updateMany({
            where: { id: booking.id, status: "CANCELLING" },
            data: { status: booking.status },
          });
          cancellationClaim = null;
          return NextResponse.json(
            { error: `Le paiement Stripe ne peut pas être annulé maintenant (statut: ${paymentIntent.status}). Réessayez ou traitez-le depuis Stripe.` },
            { status: 409 }
          );
        }
      } catch (stripeError) {
        console.error("Erreur remboursement Stripe:", stripeError);
        await prisma.booking.updateMany({
          where: { id: booking.id, status: "CANCELLING" },
          data: { status: booking.status },
        });
        cancellationClaim = null;
        return NextResponse.json(
          { error: "Impossible de libérer ou rembourser le paiement Stripe" },
          { status: 502 }
        );
      }
      }
    }

    // Mettre à jour la réservation
    if (!updatedBooking && status === "CANCELLED") {
      const cancelled = await prisma.booking.updateMany({
        where: { id: bookingId, status: "CANCELLING" },
        data: { status: "CANCELLED", cancellationReason: reason },
      });
      if (cancelled.count !== 1) throw new Error(`Verrou d'annulation perdu pour ${bookingId}`);
      updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
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
      await reverseBookingLoyalty(bookingId, "Réservation annulée par l'équipe");
      try {
        const bookingDetails = getBookingEmailDetails(booking);
        await sendBookingRejectionEmail(
          booking.client.email,
          booking.client.name || "Client",
          reason as string,
          bookingDetails,
          { idempotencyKey: `booking-rejection-${booking.id}` }
        );
        rejectionEmailSent = true;
      } catch (emailError) {
        rejectionEmailSent = false;
        rejectionEmailError = emailError instanceof Error ? emailError.message : "Email de refus non envoyé";
        console.error("Réservation refusée, mais email de refus non envoyé:", emailError);
      }
    } else if (status === "COMPLETED") {
      try {
        await sendReviewRequestForBooking(booking);
        reviewRequestEmailSent = true;
      } catch (emailError) {
        reviewRequestEmailSent = false;
        reviewRequestEmailError = emailError instanceof Error ? emailError.message : "Email de demande d'avis non envoyé";
        console.error("Réservation terminée, mais email de demande d'avis non envoyé:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      confirmationEmailSent,
      confirmationEmailError,
      rejectionEmailSent,
      rejectionEmailError,
      reviewRequestEmailSent,
      reviewRequestEmailError,
    });
  } catch (error) {
    if (cancellationClaim) {
      await prisma.booking.updateMany({
        where: { id: cancellationClaim.bookingId, status: "CANCELLING" },
        data: { status: cancellationClaim.previousStatus },
      }).catch((recoveryError) => console.error("Annulation admin non restaurée:", recoveryError));
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
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
