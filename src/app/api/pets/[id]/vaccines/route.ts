import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createVaccineSchema = z.object({
  name: z.string().min(1, "Le nom du vaccin est requis"),
  dateGiven: z.string().min(1, "La date est requise"),
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  vetName: z.string().optional(),
  notes: z.string().optional(),
});

// GET — Récupérer les vaccins d'un animal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    // Vérifier que l'animal appartient à l'utilisateur
    const pet = await prisma.pet.findUnique({ where: { id } });
    if (!pet || pet.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const vaccines = await prisma.vaccine.findMany({
      where: { petId: id },
      orderBy: { dateGiven: "desc" },
    });

    return NextResponse.json({ vaccines });
  } catch (error) {
    console.error("Erreur récupération vaccins:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — Ajouter un vaccin
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    const pet = await prisma.pet.findUnique({ where: { id } });
    if (!pet || pet.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const data = createVaccineSchema.parse(body);

    const vaccine = await prisma.vaccine.create({
      data: {
        petId: id,
        name: data.name,
        dateGiven: new Date(data.dateGiven),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        batchNumber: data.batchNumber || null,
        vetName: data.vetName || null,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ vaccine }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Erreur ajout vaccin:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — Supprimer un vaccin (via query param vaccineId)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const vaccineId = searchParams.get("vaccineId");

    if (!vaccineId) {
      return NextResponse.json({ error: "vaccineId requis" }, { status: 400 });
    }

    const pet = await prisma.pet.findUnique({ where: { id } });
    if (!pet || pet.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    await prisma.vaccine.delete({ where: { id: vaccineId, petId: id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression vaccin:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
