import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendGoogleReviewForBooking } from "@/lib/google-review-requests";

const REVIEW_REQUEST_ALLOWED_STATUSES = ["COMPLETED"] as const;

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
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });
    }

    if (!REVIEW_REQUEST_ALLOWED_STATUSES.includes(booking.status as typeof REVIEW_REQUEST_ALLOWED_STATUSES[number])) {
      return NextResponse.json(
        { error: "La demande d'avis Google peut être envoyée uniquement pour une réservation terminée." },
        { status: 409 }
      );
    }

    const result = await sendGoogleReviewForBooking(booking);

    return NextResponse.json({ success: true, alreadySent: result.alreadySent });
  } catch (error) {
    console.error("Erreur envoi manuel demande d'avis Google:", error);
    return NextResponse.json({ error: "Email de demande d'avis Google non envoyé" }, { status: 500 });
  }
}
