import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { getBookingEmailDetails } from "@/lib/booking-email-details";

const CONFIRMATION_RESEND_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"];

export async function POST(
  _request: NextRequest,
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

    if (!CONFIRMATION_RESEND_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: "La confirmation ne peut être renvoyée que pour une réservation validée." },
        { status: 409 }
      );
    }

    await sendBookingConfirmationEmail(
      booking.client.email,
      booking.client.name || "Client",
      getBookingEmailDetails(booking)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur renvoi confirmation réservation:", error);
    return NextResponse.json(
      { error: "Impossible de renvoyer l'email de confirmation" },
      { status: 500 }
    );
  }
}
