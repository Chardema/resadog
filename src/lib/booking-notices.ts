import { prisma } from "@/lib/db/prisma";
import { sendBookingNoticeEmail } from "@/lib/email";

export async function deliverBookingNotice(id: string, dependencies?: { db?: typeof prisma; send?: typeof sendBookingNoticeEmail; now?: Date }) {
  const db = dependencies?.db || prisma;
  const send = dependencies?.send || sendBookingNoticeEmail;
  const now = dependencies?.now || new Date();
  const notice = await db.bookingNotice.findUniqueOrThrow({ where: { id }, include: { booking: { select: { status: true } } } });
  if (notice.state === "SENT") return { sent: true, alreadySent: true };
  if (notice.state === "SKIPPED") return { sent: false, skipped: true };
  if ((notice.expiresAt && notice.expiresAt <= now) || (notice.kind !== "NO_SHOW" && !["CONFIRMED", "IN_PROGRESS"].includes(notice.booking.status))) {
    await db.bookingNotice.updateMany({ where: { id, state: { in: ["PENDING", "FAILED"] } }, data: { state: "SKIPPED" } });
    return { sent: false, skipped: true };
  }
  // Resend retains idempotency keys for 24h. An uncertain old attempt needs
  // provider reconciliation, never a blind send with a new key.
  if (notice.firstAttemptAt && now.getTime() - notice.firstAttemptAt.getTime() > 23 * 3600_000) {
    return { sent: false, error: "Vérifier la livraison dans Resend avant toute nouvelle tentative (plus de 23 h)." };
  }
  const claim = await db.bookingNotice.updateMany({
    where: { id, state: { in: ["PENDING", "FAILED", "SENDING"] }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { state: "SENDING", lockedUntil: new Date(now.getTime() + 5 * 60_000), firstAttemptAt: notice.firstAttemptAt || now },
  });
  if (!claim.count) return { sent: false, error: "Envoi déjà en cours." };
  try {
    const sent = await send(notice);
    await db.bookingNotice.update({ where: { id }, data: { state: "SENT", sentAt: new Date(), resendId: sent?.id, lockedUntil: null, error: null } });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email non envoyé";
    await db.bookingNotice.update({ where: { id }, data: { state: "FAILED", error: message, lockedUntil: null } });
    return { sent: false, error: message };
  }
}
