import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";

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
      include: { payment: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    // Gestion de l'annulation et du remboursement
    if (status === "CANCELLED" && booking.payment?.stripePaymentId && booking.payment.status === "SUCCEEDED") {
      try {
        // Rembourser via Stripe
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
      } catch (stripeError) {
        console.error("Erreur remboursement Stripe:", stripeError);
        // On continue même si le remboursement échoue (on pourra le faire manuellement)
        // Mais on pourrait vouloir retourner une erreur ici selon la logique métier
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