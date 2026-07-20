import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getBookingCompletionDate, sendReviewRequestForBooking } from "@/lib/review-requests";

const REVIEW_REQUEST_DELAY_MS = 24 * 60 * 60 * 1000;
const ABANDONED_CHECKOUT_DELAY_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  // Vérification de sécurité (Vercel Cron envoie un header spécifique)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const abandonedBefore = new Date(Date.now() - ABANDONED_CHECKOUT_DELAY_MS);

    // Le webhook d'expiration est le chemin normal. Ce nettoyage est le filet de
    // sécurité si Stripe n'a pas pu joindre le webhook. Les Checkout de
    // réservation expirent au bout de 31 minutes, donc une heure laisse une marge.
    const deletedAbandoned = await prisma.$transaction(async (tx) => {
      const candidates = await tx.booking.findMany({
        where: {
          status: "PENDING",
          depositPaid: false,
          createdAt: { lt: abandonedBefore },
          OR: [
            { payment: { is: null } },
            {
              payment: {
                is: {
                  stripePaymentId: null,
                  status: { not: "SUCCEEDED" },
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      const candidateIds = candidates.map((booking) => booking.id);
      if (candidateIds.length === 0) return 0;

      // Payment n'a pas de cascade SQL : le supprimer d'abord est obligatoire.
      // Les gardes empêchent toute suppression si un webhook vient d'ajouter un
      // PaymentIntent ou de réussir le paiement entre-temps.
      await tx.payment.deleteMany({
        where: {
          bookingId: { in: candidateIds },
          stripePaymentId: null,
          status: { not: "SUCCEEDED" },
        },
      });

      const deletedBookings = await tx.booking.deleteMany({
        where: {
          id: { in: candidateIds },
          status: "PENDING",
          depositPaid: false,
          payment: { is: null },
        },
      });

      return deletedBookings.count;
    });

    const now = new Date();
    const reviewEligibleBefore = new Date(now.getTime() - REVIEW_REQUEST_DELAY_MS);
    const completionCandidates = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        endDate: { lte: reviewEligibleBefore },
      },
      include: {
        client: true,
        pets: true,
        pet: true,
      },
    });

    let completedBookings = 0;
    const reviewEmailErrors: string[] = [];

    for (const booking of completionCandidates) {
      if (getBookingCompletionDate(booking).getTime() + REVIEW_REQUEST_DELAY_MS > now.getTime()) continue;

      const updated = await prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        },
        data: { status: "COMPLETED" },
      });

      if (updated.count === 0) continue;
      completedBookings += 1;

      try {
        await sendReviewRequestForBooking(booking);
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : "Email de demande d'avis non envoyé";
        reviewEmailErrors.push(`${booking.id}: ${message}`);
        console.error("Réservation terminée automatiquement, mais email d'avis non envoyé:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      deletedPending: deletedAbandoned,
      deletedAbandoned,
      completedBookings,
      reviewEmailErrors,
      message: `Nettoyage effectué : ${deletedAbandoned} réservation(s) abandonnée(s) supprimée(s), ${completedBookings} prestation(s) terminée(s).`
    });
  } catch (error) {
    console.error("Erreur Cron Cleanup:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
