import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import { sendBookingConfirmationEmail } from "@/lib/email";

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
    const body = await request.json();
    const { status } = body;

    if (!["CONFIRMED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Statut invalide" },
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

    if (
      status === "CANCELLED" &&
      booking.creditsUsed === 0 &&
      booking.payment?.status === "PROCESSING" &&
      !booking.payment.stripePaymentId
    ) {
      return NextResponse.json(
        { error: "Impossible d'annuler proprement : autorisation Stripe introuvable" },
        { status: 409 }
      );
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
    if (status === "CANCELLED" && booking.payment?.stripePaymentId) {
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
        }
      } catch (stripeError) {
        console.error("Erreur remboursement Stripe:", stripeError);
        return NextResponse.json(
          { error: "Impossible de libérer ou rembourser le paiement Stripe" },
          { status: 502 }
        );
      }
    }

    // Mettre à jour la réservation
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
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
