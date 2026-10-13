import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { sendPetBirthDateProofSubmittedAdminEmail } from "@/lib/email";
import { calculatePetAge, isValidPetBirthDate, requiresPetBirthDateProof } from "@/lib/pets";

const birthDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La date de naissance est requise")
  .refine((value) => isValidPetBirthDate(`${value}T00:00:00.000Z`), "La date de naissance est invalide");

const updatePetSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  species: z.enum(["DOG", "CAT"]),
  breed: z.string().trim().min(1, "La race est requise"),
  birthDate: birthDateSchema,
  birthDateProofUrl: z.string().url("Le justificatif de naissance est requis").max(500).or(z.literal("")),
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
  lastVetVisit: z.string().datetime().optional().or(z.literal("")).or(z.null()),
}).partial();

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

    return NextResponse.json({
      pet: {
        ...pet,
        age: calculatePetAge(pet.birthDate) ?? pet.age,
      },
    });
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
      include: {
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
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
    const birthDateProofRequired = requiresPetBirthDateProof(session.user.role);
    if (birthDateProofRequired && validatedData.birthDateProofUrl === "") {
      return NextResponse.json(
        { error: "Le justificatif de naissance est requis" },
        { status: 400 }
      );
    }

    const requestedBirthDate = validatedData.birthDate
      ? new Date(`${validatedData.birthDate}T00:00:00.000Z`)
      : undefined;
    const birthDateChanged = requestedBirthDate
      ? !existingPet.birthDate || requestedBirthDate.getTime() !== existingPet.birthDate.getTime()
      : false;
    const requestedProofUrl = validatedData.birthDateProofUrl === undefined
      ? undefined
      : validatedData.birthDateProofUrl || null;
    const proofChanged = requestedProofUrl !== undefined
      && requestedProofUrl !== existingPet.birthDateProofUrl;

    if (birthDateProofRequired && existingPet.birthDateVerifiedAt && (birthDateChanged || proofChanged)) {
      return NextResponse.json(
        { error: "La date de naissance a été vérifiée. Contactez l'équipe pour la faire corriger." },
        { status: 409 }
      );
    }

    // Nettoyer les données - retirer imageUrl si vide
    const cleanedData = {
      ...validatedData,
      birthDate: requestedBirthDate,
      birthDateProofUrl: requestedProofUrl,
      ...(requestedBirthDate ? { age: calculatePetAge(requestedBirthDate) } : {}),
      ...(!birthDateProofRequired && (!existingPet.birthDateVerifiedAt || birthDateChanged)
        ? { birthDateVerifiedAt: new Date() }
        : {}),
      ...(birthDateProofRequired && (birthDateChanged || proofChanged)
        ? { birthDateVerifiedAt: null }
        : {}),
      imageUrl: validatedData.imageUrl || undefined,
    };

    const pet = await prisma.pet.update({
      where: { id },
      data: cleanedData,
    });

    if (birthDateProofRequired && (birthDateChanged || proofChanged) && pet.birthDate && pet.birthDateProofUrl) {
      try {
        await sendPetBirthDateProofSubmittedAdminEmail({
          petId: pet.id,
          petName: pet.name,
          species: pet.species,
          birthDate: pet.birthDate,
          proofUrl: pet.birthDateProofUrl,
          userName: existingPet.owner.name || "Client",
          userEmail: existingPet.owner.email,
        });
        console.info("pet_birth_date_proof_admin_email_sent", { petId: pet.id });
      } catch (emailError) {
        console.error("pet_birth_date_proof_admin_email_failed", {
          petId: pet.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    return NextResponse.json({
      pet: {
        ...pet,
        age: calculatePetAge(pet.birthDate) ?? pet.age,
      },
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
