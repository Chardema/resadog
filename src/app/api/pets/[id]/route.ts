import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const updatePetSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.enum(["DOG", "CAT"]).optional(),
  breed: z.string().optional(),
  age: z.number().min(0).max(30).optional(),
  weight: z.number().positive().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  spayedNeutered: z.boolean().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  microchipNumber: z.string().optional(),
  insuranceInfo: z.string().optional(),
  allergies: z.string().optional(),
  medicalInfo: z.string().optional(),
  behaviorNotes: z.string().optional(),
  feedingSchedule: z.string().optional(),
  medications: z.string().optional(),
  vetInfo: z.string().optional(),
  emergencyContact: z.string().optional(),
  lastVetVisit: z.string().datetime().optional().or(z.literal("")).or(z.null()),
});

// GET - Récupérer un animal spécifique
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const pet = await prisma.pet.findUnique({
      where: {
        id,
      },
    });

    if (!pet) {
      return NextResponse.json(
        { error: "Animal non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que l'animal appartient bien à l'utilisateur
    if (pet.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    return NextResponse.json({ pet });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'animal:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un animal
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Vérifier que l'animal appartient à l'utilisateur
    const existingPet = await prisma.pet.findUnique({
      where: { id },
    });

    if (!existingPet) {
      return NextResponse.json(
        { error: "Animal non trouvé" },
        { status: 404 }
      );
    }

    if (existingPet.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updatePetSchema.parse(body);

    // Nettoyer les données - retirer imageUrl si vide
    const cleanedData = {
      ...validatedData,
      imageUrl: validatedData.imageUrl || undefined,
    };

    const pet = await prisma.pet.update({
      where: { id },
      data: cleanedData,
    });

    return NextResponse.json({
      pet,
      message: "Animal mis à jour avec succès ! ✨",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Erreur lors de la mise à jour de l'animal:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un animal
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Vérifier que l'animal appartient à l'utilisateur
    const existingPet = await prisma.pet.findUnique({
      where: { id },
    });

    if (!existingPet) {
      return NextResponse.json(
        { error: "Animal non trouvé" },
        { status: 404 }
      );
    }

    if (existingPet.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    const linkedBookings = await prisma.booking.count({
      where: {
        OR: [
          { petId: id },
          { pets: { some: { id } } },
        ],
      },
    });
    if (linkedBookings > 0) {
      return NextResponse.json(
        { error: "Ce profil est lié à une réservation et doit être conservé dans l'historique." },
        { status: 409 }
      );
    }

    await prisma.pet.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Animal supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'animal:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
