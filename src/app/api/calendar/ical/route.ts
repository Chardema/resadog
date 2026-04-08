import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/calendar/ical?token=<userId>&mode=admin|client
// Flux iCal pour Apple Calendar / Google Calendar
// - mode=admin : TOUTES les réservations + indisponibilités (pour le pet sitter)
// - mode=client : réservations du client + rappels vaccins (par défaut)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const mode = searchParams.get("mode") || "client";

  if (!token) {
    return new NextResponse("Token requis", { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: token } });
  if (!user) {
    return new NextResponse("Utilisateur introuvable", { status: 404 });
  }

  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Patte Dorée//Réservations//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  const serviceLabels: Record<string, string> = {
    BOARDING: "Pension",
    DAY_CARE: "Garderie",
    DROP_IN: "Visite",
    DOG_WALKING: "Promenade",
  };

  if (mode === "admin" && (user.role === "ADMIN" || user.role === "SITTER")) {
    // --- MODE ADMIN : toutes les réservations + indispos ---
    lines.push(`X-WR-CALNAME:La Patte Dorée — Planning`);

    // 1. Toutes les réservations actives
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "PENDING"] },
      },
      include: {
        client: { select: { name: true, phone: true } },
        pets: { select: { name: true, species: true } },
        pet: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
    });

    for (const booking of bookings) {
      const petNames = booking.pets.length > 0
        ? booking.pets.map((p) => p.name).join(", ")
        : booking.pet?.name || "Animal";

      const statusEmoji =
        booking.status === "CONFIRMED" ? "✅" :
        booking.status === "IN_PROGRESS" ? "🔄" : "⏳";

      const statusLabel =
        booking.status === "CONFIRMED" ? "Confirmée" :
        booking.status === "IN_PROGRESS" ? "En cours" : "En attente";

      const uid = `booking-${booking.id}@lapatteDoree`;
      const dtStart = formatICalDate(booking.startDate);
      const dtEnd = formatICalDate(booking.endDate);
      const stamp = formatICalDateTime(now);

      const description = [
        `Client: ${booking.client.name || "Inconnu"}`,
        booking.client.phone ? `Tel: ${booking.client.phone}` : null,
        `Animaux: ${petNames}`,
        `Statut: ${statusLabel}`,
        `Prix: ${booking.totalPrice}€`,
        booking.startTime ? `Arrivée: ${booking.startTime}` : null,
        booking.endTime ? `Départ: ${booking.endTime}` : null,
      ].filter(Boolean).join("\\n");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${statusEmoji} ${serviceLabels[booking.serviceType] || booking.serviceType} — ${petNames} (${booking.client.name || "Client"})`,
        `DESCRIPTION:${description}`,
        `STATUS:${booking.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
        "END:VEVENT"
      );
    }

    // 2. Dates d'indisponibilité (bloquées par l'admin)
    const unavailable = await prisma.availability.findMany({
      where: {
        available: false,
        date: { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) }, // Depuis le mois dernier
      },
      orderBy: { date: "asc" },
    });

    for (const block of unavailable) {
      const uid = `block-${block.id}@lapatteDoree`;
      const dtStart = formatICalDate(block.date);
      const stamp = formatICalDateTime(now);

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtStart}`,
        `SUMMARY:🚫 INDISPO — ${serviceLabels[block.serviceType] || block.serviceType}`,
        `DESCRIPTION:Date bloquée pour ${serviceLabels[block.serviceType] || block.serviceType}${block.notes ? "\\nNote: " + block.notes : ""}`,
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE",
        "END:VEVENT"
      );
    }

  } else {
    // --- MODE CLIENT : ses réservations + rappels vaccins ---
    lines.push(`X-WR-CALNAME:La Patte Dorée — ${user.name || "Mes réservations"}`);

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

    for (const booking of bookings) {
      const petNames = booking.pets.length > 0
        ? booking.pets.map((p) => p.name).join(", ")
        : booking.pet?.name || "Animal";

      const statusLabel =
        booking.status === "CONFIRMED" ? "Confirmée" :
        booking.status === "IN_PROGRESS" ? "En cours" : "En attente";

      lines.push(
        "BEGIN:VEVENT",
        `UID:booking-${booking.id}@lapatteDoree`,
        `DTSTAMP:${formatICalDateTime(now)}`,
        `DTSTART;VALUE=DATE:${formatICalDate(booking.startDate)}`,
        `DTEND;VALUE=DATE:${formatICalDate(booking.endDate)}`,
        `SUMMARY:${serviceLabels[booking.serviceType] || booking.serviceType} — ${petNames}`,
        `DESCRIPTION:Statut: ${statusLabel}\\nPrix: ${booking.totalPrice}€`,
        `STATUS:${booking.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
        "END:VEVENT"
      );
    }

    // Rappels de vaccins
    const vaccines = await prisma.vaccine.findMany({
      where: {
        pet: { ownerId: token },
        expiryDate: { not: null },
      },
      include: { pet: { select: { name: true } } },
    });

    for (const vaccine of vaccines) {
      if (!vaccine.expiryDate) continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:vaccine-${vaccine.id}@lapatteDoree`,
        `DTSTAMP:${formatICalDateTime(now)}`,
        `DTSTART;VALUE=DATE:${formatICalDate(vaccine.expiryDate)}`,
        `DTEND;VALUE=DATE:${formatICalDate(vaccine.expiryDate)}`,
        `SUMMARY:💉 Rappel vaccin ${vaccine.name} — ${vaccine.pet.name}`,
        `DESCRIPTION:Le vaccin ${vaccine.name} de ${vaccine.pet.name} expire ce jour.`,
        "BEGIN:VALARM",
        "TRIGGER:-P7D",
        "ACTION:DISPLAY",
        `DESCRIPTION:Rappel: vaccin ${vaccine.name} de ${vaccine.pet.name} dans 7 jours`,
        "END:VALARM",
        "END:VEVENT"
      );
    }
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lapatteDoree.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function formatICalDate(date: Date): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatICalDateTime(date: Date): string {
  const d = new Date(date);
  return `${formatICalDate(d)}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
}
