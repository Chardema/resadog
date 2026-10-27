import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { sendGoogleReviewEmail } from "@/lib/email";
import { REVIEW_NEARBY_MS } from "@/lib/booking-completion";

export const googleReviewEmailKey = (bookingId: string) => `admin-google-review-${bookingId}`;
export type GoogleReviewBooking = {
  id: string; clientId: string; startDate: Date; endDate: Date;
  pets?: { name: string }[]; pet?: { name: string | null } | null;
  client: { email: string; name: string | null };
};
export function googleReviewGroupMessage(bookings: GoogleReviewBooking[]) {
  if (!bookings.length || bookings.some(b => b.clientId !== bookings[0].clientId)) throw new Error("Groupe de clients invalide");
  const ids = [...new Set(bookings.map(b => b.id))].sort();
  const petNames = [...new Set(bookings.flatMap(b => b.pets?.length ? b.pets.map(p => p.name) : b.pet?.name ? [b.pet.name] : []))].sort();
  return {
    key: ids.length === 1 ? googleReviewEmailKey(ids[0]) : `google-review-group-${createHash("sha256").update(ids.join("|")).digest("hex")}`,
    email: bookings[0].client.email, name: bookings[0].client.name || "", petNames: petNames.join(", "),
  };
}
type DeliveryDependencies = { db: Pick<typeof prisma, "$transaction">; send: typeof sendGoogleReviewEmail };
export async function sendGoogleReviewForBookings(bookings: GoogleReviewBooking[], deps: DeliveryDependencies = { db: prisma, send: sendGoogleReviewEmail }) {
  const message = googleReviewGroupMessage(bookings);
  return deps.db.$transaction(async tx => {
    // Serialise requests for one client, including overlapping selections.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`google-review:${bookings[0].clientId}`}, 0))`;
    const nearby = await tx.booking.findMany({
      where: { clientId: bookings[0].clientId, status: "COMPLETED", OR: bookings.map(b => ({
        startDate: { lte: new Date(b.endDate.getTime() + REVIEW_NEARBY_MS) },
        endDate: { gte: new Date(b.startDate.getTime() - REVIEW_NEARBY_MS) },
      })) }, select: { id: true },
    });
    const keys = [...new Set([...bookings, ...nearby].map(b => googleReviewEmailKey(b.id)))];
    const previous = await tx.emailLog.findFirst({ where: { status: "SENT", idempotencyKey: { in: [...keys, message.key] } }, orderBy: { createdAt: "asc" } });
    if (!previous) await deps.send(message.email, message.name, message.petNames, message.key);
    const sent = previous || await tx.emailLog.findFirst({ where: { status: "SENT", idempotencyKey: message.key } });
    if (!sent) throw new Error("Le suivi de l’envoi est indisponible. Réessayez la demande Google.");
    const requestedKeys = bookings.map(b => googleReviewEmailKey(b.id));
    const covered = await tx.emailLog.findMany({ where: { status: "SENT", idempotencyKey: { in: requestedKeys } }, select: { idempotencyKey: true } });
    const coveredKeys = new Set(covered.map(log => log.idempotencyKey));
    await tx.emailLog.createMany({ data: requestedKeys.filter(key => !coveredKeys.has(key)).map(key => ({
      from: sent.from, to: sent.to, subject: sent.subject, status: "SENT" as const,
      idempotencyKey: key, createdAt: sent.createdAt,
    })) });
    return { alreadySent: Boolean(previous) };
  }, { maxWait: 10000, timeout: 30000 });
}
export const sendGoogleReviewForBooking = (booking: GoogleReviewBooking) => sendGoogleReviewForBookings([booking]);

export function getBookingCompletionDate(booking: { endDate: Date; endTime?: string | null }) {
  const completedAt = new Date(booking.endDate);
  const [hours, minutes] = booking.endTime?.split(":").map(Number) || [];

  if (Number.isInteger(hours) && Number.isInteger(minutes)) {
    completedAt.setUTCHours(hours, minutes, 0, 0);
    return completedAt;
  }

  completedAt.setUTCHours(23, 59, 59, 999);
  return completedAt;
}

