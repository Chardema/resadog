import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendReviewRequestForBooking } from "@/lib/review-requests";

const REVIEW_REQUEST_ALLOWED_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { bookingId } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: true,
        pets: true,
        pet: true,
        reviewRequest: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });
    }

    if (!REVIEW_REQUEST_ALLOWED_STATUSES.includes(booking.status as typeof REVIEW_REQUEST_ALLOWED_STATUSES[number])) {
      return NextResponse.json(
        { error: "La demande d'avis peut être envoyée uniquement pour une réservation confirmée, en cours ou terminée." },
        { status: 409 }
      );
    }

    if (booking.reviewRequest?.submittedAt) {
      return NextResponse.json(
        { error: "Le client a déjà répondu à cette demande d'avis." },
        { status: 409 }
      );
    }

    await sendReviewRequestForBooking(booking, {
      idempotencyKey: `booking-review-request-manual-${booking.id}-${Date.now()}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur envoi manuel demande d'avis:", error);
    return NextResponse.json({ error: "Email de demande d'avis non envoyé" }, { status: 500 });
  }
}
