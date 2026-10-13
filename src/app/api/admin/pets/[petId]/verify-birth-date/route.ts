import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendPetBirthDateVerifiedEmail } from "@/lib/email";
import { calculatePetAge, getPetProfileCompletion, isValidPetBirthDate } from "@/lib/pets";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN" ? session : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> }
) {
  try {
    if (!await requireAdmin()) {
      console.warn("[admin/pets/verify-birth-date] POST refused: unauthenticated admin session");
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { petId } = await params;
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      include: {
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    if (!pet) {
      console.warn("[admin/pets/verify-birth-date] POST refused: pet not found", { petId });
      return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
    }
    if (!pet.birthDate || !isValidPetBirthDate(pet.birthDate) || !pet.birthDateProofUrl) {
      console.warn("[admin/pets/verify-birth-date] POST refused: incomplete verification data", {
        petId,
        hasBirthDate: Boolean(pet.birthDate),
        hasProof: Boolean(pet.birthDateProofUrl),
      });
      return NextResponse.json(
        { error: "Une date de naissance valide et un justificatif sont requis avant validation." },
        { status: 400 }
      );
    }

    const completion = getPetProfileCompletion(pet);
    if (!completion.isComplete) {
      console.warn("[admin/pets/verify-birth-date] POST refused: incomplete pet profile", {
        petId,
        missingFields: completion.missingFields.map((field) => field.key),
      });
      return NextResponse.json(
        {
          error: `Le profil de ${pet.name} doit être complété à 100 % avant validation et envoi du mail.`,
          code: "PET_PROFILE_INCOMPLETE",
        },
        { status: 409 }
      );
    }

    const updatedPet = await prisma.pet.update({
      where: { id: petId },
      data: {
        age: calculatePetAge(pet.birthDate),
        birthDateVerifiedAt: new Date(),
      },
      select: {
        id: true,
        birthDateVerifiedAt: true,
      },
    });

    const proofFingerprint = createHash("sha256")
      .update(pet.birthDateProofUrl)
      .digest("hex")
      .slice(0, 16);

    try {
      await sendPetBirthDateVerifiedEmail(
        pet.owner.email,
        pet.owner.name || "Client",
        pet.name,
        { idempotencyKey: `pet-age-verified-${pet.id}-${proofFingerprint}` }
      );
    } catch (emailError) {
      await prisma.pet.update({
        where: { id: petId },
        data: { birthDateVerifiedAt: null },
      });
      console.error("[admin/pets/verify-birth-date] email failed; verification rolled back", {
        petId,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
      return NextResponse.json(
        {
          error: `Le mail n'a pas pu être envoyé. ${pet.name} reste à valider afin que vous puissiez réessayer.`,
          code: "VERIFICATION_EMAIL_FAILED",
        },
        { status: 502 }
      );
    }

    console.info("[admin/pets/verify-birth-date] birth date verified and owner emailed", { petId });
    return NextResponse.json({
      pet: updatedPet,
      message: `Date de naissance de ${pet.name} vérifiée. Le client a reçu le mail l'autorisant à réserver.`,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification de la date de naissance:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> }
) {
  try {
    if (!await requireAdmin()) {
      console.warn("[admin/pets/verify-birth-date] DELETE refused: unauthenticated admin session");
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { petId } = await params;
    const result = await prisma.pet.updateMany({
      where: { id: petId },
      data: { birthDateVerifiedAt: null },
    });
    if (result.count === 0) {
      console.warn("[admin/pets/verify-birth-date] DELETE refused: pet not found", { petId });
      return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
    }

    console.info("[admin/pets/verify-birth-date] birth date verification removed", { petId });
    return NextResponse.json({ message: "Vérification retirée. Le client peut corriger les informations." });
  } catch (error) {
    console.error("Erreur lors du retrait de la vérification:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
