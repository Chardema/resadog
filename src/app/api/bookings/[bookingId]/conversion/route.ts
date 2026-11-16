import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getBookingConversionValue, isBookingPaidForConversion } from "@/lib/booking-conversion";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// Vérification serveur avant tout envoi de conversion Google (GA4 / Ads) :
// la réservation doit exister, appartenir au client connecté et être payée.
// 409 = pas encore payée (le webhook Stripe peut arriver après le retour
// sur /booking/success) : le client peut réessayer brièvement.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: "Non connecté" }, 401);

    const { bookingId } = await params;
    if (!bookingId) return json({ error: "Réservation introuvable" }, 404);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        clientId: true,
        totalPrice: true,
        depositPaid: true,
        payment: {
          select: { status: true, stripePaymentId: true, amount: true },
        },
      },
    });

    if (!booking) return json({ error: "Réservation introuvable" }, 404);
    if (booking.clientId !== session.user.id) return json({ error: "Non autorisé" }, 403);
    if (!isBookingPaidForConversion(booking)) return json({ paid: false }, 409);

    return json(
      { paid: true, bookingId, value: getBookingConversionValue(booking), currency: "EUR" },
      200
    );
  } catch (error) {
    console.error("Booking conversion check failed:", error);
    return json({ error: "Erreur serveur" }, 500);
  }
}
