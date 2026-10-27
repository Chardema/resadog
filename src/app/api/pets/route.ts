import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { sendPetBirthDateProofSubmittedAdminEmail } from "@/lib/email";
import { calculatePetAge, isValidPetBirthDate, requiresPetBirthDateProof } from "@/lib/pets";

const birthDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La date de naissance est requise")
  .refine((value) => isValidPetBirthDate(`${value}T00:00:00.000Z`), "La date de naissance est invalide");

// Schéma de validation pour créer un animal
const createPetSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  species: z.enum(["DOG", "CAT"]),
  breed: z.string().trim().min(1, "La race est requise"),
  birthDate: birthDateSchema,
  birthDateProofUrl: z.string().url("Le justificatif de naissance est requis").max(500).optional().or(z.literal("")),
  weight: z.number().positive("Le poids est requis"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Le sexe est requis" }),
  spayedNeutered: z.boolean({ message: "Indiquez si l'animal est stérilisé ou castré" }),
  imageUrl: z.string().url().optional().or(z.literal("")),
  microchipNumber: z.string().optional(),
  insuranceInfo: z.string().optional(),
  allergies: z.string().optional(),
  medicalInfo: z.string().trim().min(1, "Indiquez les maladies ou écrivez « Aucune connue »"),
  behaviorNotes: z.string().trim().min(1, "Les informations de comportement sont requises"),
  feedingSchedule: z.string().trim().min(1, "Les informations sur les repas sont requises"),
  medications: z.string().trim().min(1, "Indiquez les médicaments ou écrivez « Aucun »"),
  vetInfo: z.string().trim().min(1, "Les coordonnées du vétérinaire sont requises"),
  emergencyContact: z.string().trim().min(1, "Un contact d'urgence est requis"),
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

    return NextResponse.json({
      pets: pets.map((pet) => ({
        ...pet,
        age: calculatePetAge(pet.birthDate) ?? pet.age,
      })),
    });
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
    const birthDateProofRequired = requiresPetBirthDateProof(session.user.role);
    if (birthDateProofRequired && !validatedData.birthDateProofUrl) {
      return NextResponse.json(
        { error: "Le justificatif de naissance est requis" },
        { status: 400 }
      );
    }

    const { imageUrl, lastVetVisit, birthDate, birthDateProofUrl, ...petData } = validatedData;
    const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
    const cleanedData = {
      ...petData,
      birthDate: parsedBirthDate,
      age: calculatePetAge(parsedBirthDate),
      ...(birthDateProofUrl ? { birthDateProofUrl } : {}),
      ...(!birthDateProofRequired ? { birthDateVerifiedAt: new Date() } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(lastVetVisit ? { lastVetVisit } : {}),
    };

    const petWithOwner = await prisma.pet.create({
      data: {
        ...cleanedData,
        ownerId: session.user.id,
      },
      include: {
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    const { owner, ...pet } = petWithOwner;

    if (birthDateProofRequired && pet.birthDate && pet.birthDateProofUrl) {
      try {
        await sendPetBirthDateProofSubmittedAdminEmail({
          petId: pet.id,
          petName: pet.name,
          species: pet.species,
          birthDate: pet.birthDate,
          proofUrl: pet.birthDateProofUrl,
          userName: owner.name || "Client",
          userEmail: owner.email,
        });
        console.info("pet_birth_date_proof_admin_email_sent", { petId: pet.id });
      } catch (emailError) {
        console.error("pet_birth_date_proof_admin_email_failed", {
          petId: pet.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    return NextResponse.json(
      {
        pet: {
          ...pet,
          age: calculatePetAge(pet.birthDate) ?? pet.age,
        },
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
