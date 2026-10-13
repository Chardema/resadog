import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { directBookingSchema, calculateDirectPrice, directVisitSlots } from "@/lib/direct-booking";
import { buildSpecialRequests } from "@/lib/booking-details";
import { assertBookingCapacity, BookingConfirmationError } from "@/lib/booking-confirmation";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  const clients = await prisma.user.findMany({ where: { role: "CLIENT" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, phone: true, pets: { select: { id: true, name: true, species: true, birthDate: true, age: true } } } });
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  const parsed = directBookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  try {
    const booking = await prisma.$transaction(async tx => {
      const id = `direct_${input.requestId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const previous = await tx.booking.findUnique({ where: { id } });
      if (previous) return previous;
      let client = input.clientId ? await tx.user.findUnique({ where: { id: input.clientId } }) : null;
      if (input.clientId && (!client || client.role !== "CLIENT")) throw new Error("Client introuvable.");
      if (!client && input.client) {
        if (await tx.user.findUnique({ where: { email: input.client.email } })) throw new Error("Cet e-mail existe déjà. Sélectionnez le client existant.");
        client = await tx.user.create({ data: { ...input.client, role: "CLIENT" } });
      }
      if (!client) throw new Error("Client requis.");
      const pets = input.petIds ? await tx.pet.findMany({ where: { id: { in: input.petIds }, ownerId: client.id } }) : [];
      if (input.petIds && pets.length !== new Set(input.petIds).size) throw new Error("Un animal sélectionné n’appartient pas à ce client.");
      if (input.pet) pets.push(await tx.pet.create({ data: { name: input.pet.name, species: input.pet.species, birthDate: new Date(`${input.pet.birthDate}T12:00:00Z`), medicalInfo: input.pet.notes || null, ownerId: client.id } }));
      const price = calculateDirectPrice(input, pets);
      if (Math.abs(price.total - input.expectedTotal) > 0.001) throw new Error(`Le tarif actualisé est de ${price.total.toFixed(2)} €. Vérifiez le récapitulatif avant de réessayer.`);
      if (price.total <= 0) throw new Error("Tarif non disponible pour cette prestation.");
      const candidate = { id, serviceType: input.serviceType, startDate: new Date(`${input.startDate}T12:00:00Z`), endDate: new Date(`${input.endDate}T12:00:00Z`), startTime: input.startTime, endTime: input.endTime, specialRequests: buildSpecialRequests(input.notes, { visitSlots: directVisitSlots(input), serviceAddress: input.serviceAddress }) };
      await assertBookingCapacity(tx, candidate);
      const audit = [`Réservation directe enregistrée par ${session.user.id} le ${new Date().toISOString()}`, `Accord client / CGV ${LEGAL_DOCUMENT_VERSION} : ${input.agreementEvidence}`, `Paiement : ${input.paymentMethod}. Référence : ${input.paymentReference || "à recevoir"}`, `Dernière minute : ${price.lastMinuteFee.toFixed(2)} EUR inclus.`].join("\n");
      return tx.booking.create({ data: { ...candidate, clientId: client.id, petId: pets[0].id, pets: { connect: pets.map(pet => ({ id: pet.id })) }, status: "CONFIRMED", totalPrice: price.total, notes: audit,
        payment: { create: { amount: price.total, capturedAmount: input.paid ? price.total : 0, status: input.paid ? "SUCCEEDED" : "PENDING", paymentMethod: input.paymentMethod, paidAt: input.paid ? new Date(`${input.paidOn}T12:00:00Z`) : null } },
      } });
    }, { maxWait: 5000, timeout: 15000 });
    return NextResponse.json({ bookingId: booking.id, total: booking.totalPrice, message: "Réservation enregistrée. Aucun message ni débit automatique effectué." });
  } catch (error) {
    if (error instanceof BookingConfirmationError) return NextResponse.json({ error: error.message, blockedDates: error.blockedDates }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: "L’enregistrement a échoué. Rechargez la liste des clients puis réessayez." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Enregistrement impossible." }, { status: 400 });
  }
}
