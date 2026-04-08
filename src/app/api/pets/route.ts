import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

// Schéma de validation pour créer un animal
const createPetSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
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
  lastVetVisit: z.string().datetime().optional().or(z.literal("")),
});

// GET - Récupérer tous les animaux de l'utilisateur
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const pets = await prisma.pet.findMany({
      where: {
        ownerId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ pets });
  } catch (error) {
    console.error("Erreur lors de la récupération des animaux:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// POST - Créer un nouvel animal
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPetSchema.parse(body);

    // Nettoyer les données - retirer imageUrl si vide
    const cleanedData: any = { ...validatedData };
    if (cleanedData.imageUrl === "") {
      delete cleanedData.imageUrl;
    }

    const pet = await prisma.pet.create({
      data: {
        ...cleanedData,
        ownerId: session.user.id,
      },
    });

    return NextResponse.json(
      {
        pet,
        message: "Animal ajouté avec succès ! 🐾",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Erreur lors de la création de l'animal:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
