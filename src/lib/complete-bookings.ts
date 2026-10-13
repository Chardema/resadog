import { prisma } from "@/lib/db/prisma";
import { validateCompletionSelection } from "@/lib/booking-completion";
import { sendGoogleReviewForBookings } from "@/lib/google-review-requests";

export async function completeBookings(anchorId: string, selectedIds: string[]) {
  const ids = [...new Set(selectedIds)];
  const result = await prisma.$transaction(async tx => {
    const bookings = await tx.booking.findMany({ where: { id: { in: ids } }, include: { client: true, pets: true, pet: true } });
    validateCompletionSelection(anchorId, ids, bookings);
    const active = bookings.filter(b => b.status !== "COMPLETED");
    const updated = await tx.booking.updateMany({ where: { id: { in: active.map(b => b.id) }, status: { in: ["CONFIRMED", "IN_PROGRESS"] } }, data: { status: "COMPLETED" } });
    if (updated.count !== active.length) throw new Error("Une réservation vient d’être modifiée. Rechargez la page.");
    return { bookings, completedCount: updated.count };
  });
  try {
    const delivery = await sendGoogleReviewForBookings(result.bookings);
    return { success: true, completedCount: result.completedCount, bookingIds: ids, googleReviewEmailSent: true, googleReviewAlreadySent: delivery.alreadySent };
  } catch (error) {
    console.error("Réservations terminées, demande Google non envoyée:", error);
    return { success: true, completedCount: result.completedCount, bookingIds: ids, googleReviewEmailSent: false, googleReviewEmailError: "Le mail Google n’a pas pu être envoyé. Vous pouvez réessayer depuis la réservation." };
  }
}
