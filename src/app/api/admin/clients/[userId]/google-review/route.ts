import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { buildGoogleReviewEmail } from "@/lib/email";

import { googleReviewEmailKey, sendGoogleReviewForBooking } from "@/lib/google-review-requests";

type Context = { params: Promise<{ userId: string }> };
async function handle(request: Request, context: Context, send: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    const { userId } = await context.params;
    const client = await prisma.user.findFirst({ where: { id: userId, role: "CLIENT" }, select: { name: true, email: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    const booking = await prisma.booking.findFirst({
      where: { clientId: userId, status: "COMPLETED" }, orderBy: { endDate: "desc" },
      select: { id: true, clientId: true, startDate: true, endDate: true, pet: { select: { name: true } }, pets: { select: { name: true } } },
    });
    if (!booking) return NextResponse.json({ error: "Une réservation terminée est nécessaire pour demander un avis." }, { status: 409 });
    const name = client.name || "";
    const pets = booking.pets.map(pet => pet.name).join(", ") || booking.pet?.name || "";
    const key = googleReviewEmailKey(booking.id);
    const previous = await prisma.emailLog.findFirst({ where: { idempotencyKey: key, status: "SENT" }, select: { createdAt: true } });
    const mail = buildGoogleReviewEmail(name, pets);
    if (!send) return NextResponse.json({ ...mail, to: client.email, bookingId: booking.id, sentAt: previous?.createdAt || null }, { headers: { "Cache-Control": "no-store" } });
    const body = await request.json().catch(() => null);
    if (body?.bookingId !== booking.id) return NextResponse.json({ error: "La réservation a changé. Rouvrez l’aperçu avant l’envoi." }, { status: 409 });
    if (previous) return NextResponse.json({ success: true, message: "Cette demande d’avis a déjà été envoyée pour cette réservation." });
    const delivery = await sendGoogleReviewForBooking({ ...booking, client });
    return NextResponse.json({ success: true, message: delivery.alreadySent ? "Une demande Google a déjà été envoyée pour cette garde ou une garde proche. Aucun doublon envoyé." : `Demande d’avis transmise au service d’envoi pour ${client.email}.` });
  } catch (error) {
    console.error("Google review email:", error);
    return NextResponse.json({ error: "Impossible de préparer ou d’envoyer la demande d’avis." }, { status: 500 });
  }
}
export async function GET(request: Request, context: Context) { return handle(request, context, false); }
export async function POST(request: Request, context: Context) { return handle(request, context, true); }
