import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { addCalendarDays, getTodayDateKey } from "@/lib/booking-dates";
import { parisAppointment, reminderEvents, reminderMessage } from "@/lib/booking-attendance";
import { deliverBookingNotice } from "@/lib/booking-notices";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const now = new Date();
  const tomorrow = addCalendarDays(getTodayDateKey(now), 1);
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] }, startDate: { lt: new Date(`${addCalendarDays(tomorrow, 1)}T00:00:00Z`) }, endDate: { gte: new Date(`${tomorrow}T00:00:00Z`) } },
    include: { client: true, pets: true, pet: true },
  });
  if (request.nextUrl.searchParams.get("dryRun") === "true") {
    const pending = await prisma.bookingNotice.count({ where: { state: { in: ["PENDING", "FAILED", "SENDING"] } } });
    return NextResponse.json({ dryRun: true, date: tomorrow, reminders: bookings.flatMap(b => reminderEvents(b, now).map(e => ({ bookingId: b.id, kind: e.kind, date: e.date }))), pending, emailSent: false });
  }
  for (const booking of bookings) {
    for (const event of reminderEvents(booking, now)) {
      const message = reminderMessage(booking, event);
      await prisma.bookingNotice.upsert({ where: { id: event.key }, update: {}, create: {
        id: event.key, bookingId: booking.id, kind: event.kind, to: booking.client.email, ...message,
        expiresAt: parisAppointment(event.date, /^([01]\d|2[0-3]):[0-5]\d/.test(event.schedule) ? event.schedule.slice(0, 5) : event.kind === "PICKUP" ? booking.endTime : booking.startTime) || parisAppointment(event.date, "00:00"),
      } });
    }
  }
  const pending = await prisma.bookingNotice.findMany({ where: { state: { in: ["PENDING", "FAILED", "SENDING"] } }, orderBy: { createdAt: "asc" }, take: 100 });
  const results = [];
  for (const notice of pending) {
    if (Date.now() - startedAt > 45_000) break;
    let delivery = await deliverBookingNotice(notice.id);
    for (let attempt = 1; attempt < 3 && !delivery.sent && !delivery.skipped && Date.now() - startedAt < 43_000; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      delivery = await deliverBookingNotice(notice.id);
    }
    results.push({ id: notice.id, ...delivery });
    // Stay below the default Resend rate limit across the batch.
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  const errors = results.filter(r => !r.sent && !r.skipped);
  return NextResponse.json({ success: errors.length === 0, planned: bookings.length, processed: results.length, errors }, { status: errors.length ? 502 : 200 });
}
