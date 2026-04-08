import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/calendar/ical?token=<userId>
// Flux iCal pour synchroniser les réservations avec Apple Calendar / Google Calendar
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Token requis", { status: 401 });
  }

  // Le token est le userId — on vérifie qu'il existe
  const user = await prisma.user.findUnique({ where: { id: token } });
  if (!user) {
    return new NextResponse("Utilisateur introuvable", { status: 404 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      clientId: token,
      status: { in: ["CONFIRMED", "IN_PROGRESS", "PENDING"] },
    },
    include: {
      pets: { select: { name: true } },
      pet: { select: { name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Aussi récupérer les vaccins à renouveler
  const vaccines = await prisma.vaccine.findMany({
    where: {
      pet: { ownerId: token },
      expiryDate: { not: null },
    },
    include: { pet: { select: { name: true } } },
  });

  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Patte Dorée//Réservations//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:La Patte Dorée - ${user.name || "Mes réservations"}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  // Événements de réservation
  for (const booking of bookings) {
    const petNames = booking.pets.length > 0
      ? booking.pets.map((p) => p.name).join(", ")
      : booking.pet?.name || "Animal";

    const statusLabel =
      booking.status === "CONFIRMED" ? "Confirmée" :
      booking.status === "IN_PROGRESS" ? "En cours" : "En attente";

    const uid = `booking-${booking.id}@lapatteDoree`;
    const dtStart = formatICalDate(booking.startDate);
    const dtEnd = formatICalDate(booking.endDate);
    const created = formatICalDateTime(booking.createdAt);
    const stamp = formatICalDateTime(now);

    const serviceLabels: Record<string, string> = {
      BOARDING: "Pension",
      DAY_CARE: "Garderie",
      DROP_IN: "Visite",
      DOG_WALKING: "Promenade",
    };

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${serviceLabels[booking.serviceType] || booking.serviceType} — ${petNames}`,
      `DESCRIPTION:Statut: ${statusLabel}\\nPrix: ${booking.totalPrice}€\\nAnimaux: ${petNames}`,
      `STATUS:${booking.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
      `CREATED:${created}`,
      "END:VEVENT"
    );
  }

  // Rappels de vaccins (date d'expiration)
  for (const vaccine of vaccines) {
    if (!vaccine.expiryDate) continue;

    const uid = `vaccine-${vaccine.id}@lapatteDoree`;
    const dtStart = formatICalDate(vaccine.expiryDate);
    const stamp = formatICalDateTime(now);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtStart}`,
      `SUMMARY:💉 Rappel vaccin ${vaccine.name} — ${vaccine.pet.name}`,
      `DESCRIPTION:Le vaccin ${vaccine.name} de ${vaccine.pet.name} expire ce jour.${vaccine.vetName ? "\\nVétérinaire: " + vaccine.vetName : ""}`,
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:Rappel: vaccin ${vaccine.name} de ${vaccine.pet.name} expire dans 7 jours`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const ical = lines.join("\r\n");

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lapatteDoree.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

// Format YYYYMMDD pour les événements all-day
function formatICalDate(date: Date): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Format YYYYMMDDTHHMMSSZ pour les timestamps
function formatICalDateTime(date: Date): string {
  const d = new Date(date);
  return `${formatICalDate(d)}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
}
