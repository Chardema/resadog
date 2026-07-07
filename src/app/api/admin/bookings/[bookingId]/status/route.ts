import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { z } from "zod";

const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED"]),
  reason: z.string().trim().max(500).optional(),
  confirmed: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
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

    const booking = await prisma.booking.findUnique({
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

    // Une réservation payante ne doit jamais être confirmée sans autorisation Stripe.
    if (
      status === "CONFIRMED" &&
      booking.creditsUsed === 0 &&
      (!booking.payment || !booking.payment.stripePaymentId)
    ) {
      return NextResponse.json(
        { error: "Aucune autorisation Stripe n'est rattachée à cette réservation" },
        { status: 409 }
      );
    }

    // Gestion de la CONFIRMATION (Capture de l'argent)
    if (status === "CONFIRMED" && booking.payment?.stripePaymentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);
        
        if (paymentIntent.status === 'requires_capture') {
          await stripe.paymentIntents.capture(
            booking.payment.stripePaymentId,
            {},
            { idempotencyKey: `booking:${booking.id}:confirmation-capture` }
          );
          
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: { status: "SUCCEEDED", paidAt: new Date() }
          });

          // Nom des animaux pour l'email
          const petsName = booking.pets.length > 0 
            ? booking.pets.map(p => p.name).join(", ") 
            : (booking.pet?.name || "Votre compagnon");

          // Envoyer email de confirmation
          try {
            await sendBookingConfirmationEmail(
              booking.client.email,
              booking.client.name || "Client",
              {
                petName: petsName,
                startDate: new Date(booking.startDate).toLocaleDateString("fr-FR"),
                endDate: new Date(booking.endDate).toLocaleDateString("fr-FR"),
                totalPrice: booking.totalPrice
              }
            );
          } catch (emailError) {
            console.error("Paiement capturé, mais email de confirmation non envoyé:", emailError);
          }
        } else if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: `Le paiement Stripe ne peut pas être capturé (statut: ${paymentIntent.status})` },
            { status: 409 }
          );
        }
      } catch (err) {
        console.error("Erreur capture Stripe:", err);
        return NextResponse.json({ error: "Impossible de capturer le paiement" }, { status: 400 });
      }
    }

    // Gestion du remboursement des CRÉDITS
    if (status === "CANCELLED" && booking.creditsUsed > 0) {
        await prisma.creditBatch.create({
            data: {
                userId: booking.clientId,
                amount: booking.creditsUsed,
                remaining: booking.creditsUsed,
                serviceType: booking.serviceType,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valable 1 an
            }
        });
    }

    // Gestion de l'annulation et du remboursement Stripe (ou libération empreinte)
    if (status === "CANCELLED" && booking.payment) {
      if (!booking.payment.stripePaymentId) {
        if (booking.payment.status === "SUCCEEDED") {
          return NextResponse.json(
            { error: "Paiement marqué encaissé mais identifiant Stripe absent : remboursement manuel requis avant annulation." },
            { status: 409 }
          );
        }

        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: 0 },
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
             data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: 0 },
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
               refundedAt: new Date(),
               refundAmount: booking.payment.amount,
             },
           });
        } else if (paymentIntent.status === 'canceled') {
           await prisma.payment.update({
             where: { id: booking.payment.id },
             data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: 0 },
           });
        } else if (
          paymentIntent.status === 'requires_payment_method' ||
          paymentIntent.status === 'requires_confirmation' ||
          paymentIntent.status === 'requires_action'
        ) {
           await prisma.payment.update({
             where: { id: booking.payment.id },
             data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: 0 },
           });
        } else {
          return NextResponse.json(
            { error: `Le paiement Stripe ne peut pas être annulé maintenant (statut: ${paymentIntent.status}). Réessayez ou traitez-le depuis Stripe.` },
            { status: 409 }
          );
        }
      } catch (stripeError) {
        console.error("Erreur remboursement Stripe:", stripeError);
        return NextResponse.json(
          { error: "Impossible de libérer ou rembourser le paiement Stripe" },
          { status: 502 }
        );
      }
      }
    }

    // Mettre à jour la réservation
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status,
        cancellationReason: status === "CANCELLED"
          ? reason || "Refusée par l'équipe"
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
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
