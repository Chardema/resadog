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
        pet: true
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    // Gestion de la CONFIRMATION (Capture de l'argent)
    if (status === "CONFIRMED" && booking.payment?.stripePaymentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);
        
        if (paymentIntent.status === 'requires_capture') {
          console.log(`💰 Capture du paiement ${booking.payment.stripePaymentId}...`);
          await stripe.paymentIntents.capture(booking.payment.stripePaymentId);
          
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: { status: "SUCCEEDED", paidAt: new Date() }
          });

          // Envoyer email de confirmation
          await sendBookingConfirmationEmail(
            booking.client.email,
            booking.client.name || "Client",
            {
              petName: booking.pet.name,
              startDate: new Date(booking.startDate).toLocaleDateString("fr-FR"),
              endDate: new Date(booking.endDate).toLocaleDateString("fr-FR"),
              totalPrice: booking.totalPrice
            }
          );
        }
      } catch (err) {
        console.error("Erreur capture Stripe:", err);
        return NextResponse.json({ error: "Impossible de capturer le paiement" }, { status: 400 });
      }
    }

    // Gestion de l'annulation et du remboursement (ou libération empreinte)
    if (status === "CANCELLED" && booking.payment?.stripePaymentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentId);

        if (paymentIntent.status === 'requires_capture') {
           // Annuler l'empreinte (Le client n'est pas débité)
           console.log(`🔓 Libération de l'empreinte ${booking.payment.stripePaymentId}...`);
           await stripe.paymentIntents.cancel(booking.payment.stripePaymentId);
        } else if (paymentIntent.status === 'succeeded') {
           // Rembourser via Stripe
           console.log(`💸 Remboursement ${booking.payment.stripePaymentId}...`);
           const refund = await stripe.refunds.create({
             payment_intent: booking.payment.stripePaymentId,
           });
   
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
    
    await prisma.booking.delete({ where: { id: bookingId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}