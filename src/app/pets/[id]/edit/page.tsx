"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getPetProfileCompletion, requiresPetBirthDateProof } from "@/lib/pets";
import {
  emptyPetFormData,
  PetProfileForm,
  toPetPayload,
  type PetFormData,
} from "@/components/pets/PetProfileForm";

export default function EditPetPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const petId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [birthDateVerified, setBirthDateVerified] = useState(false);
  const [formData, setFormData] = useState<PetFormData>(emptyPetFormData);
  const birthDateProofRequired = requiresPetBirthDateProof(session?.user?.role);

  useEffect(() => {
    const fetchPet = async () => {
      try {
        const response = await fetch(`/api/pets/${petId}`);
        if (!response.ok) {
          setError("Impossible de charger les données");
          return;
        }

        const data = await response.json();
        const pet = data.pet;

        setBirthDateVerified(Boolean(pet.birthDateVerifiedAt));
        setFormData({
          ...emptyPetFormData,
          name: pet.name || "",
          species: pet.species || "DOG",
          breed: pet.breed || "",
          birthDate: pet.birthDate ? pet.birthDate.split("T")[0] : "",
          birthDateProofUrl: pet.birthDateProofUrl || "",
          weight: pet.weight?.toString() || "",
          gender: pet.gender || "UNKNOWN",
          spayedNeutered: pet.spayedNeutered ?? null,
          imageUrl: pet.imageUrl || "",
          medicalInfo: pet.medicalInfo || "",
          behaviorNotes: pet.behaviorNotes || "",
          feedingSchedule: pet.feedingSchedule || "",
          medications: pet.medications || "",
          vetInfo: pet.vetInfo || "",
          emergencyContact: pet.emergencyContact || "",
        });
      } catch {
        setError("Erreur chargement");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPet();
  }, [petId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const payload = toPetPayload(formData);
    const completion = getPetProfileCompletion(payload, { requireBirthDateProof: birthDateProofRequired });
    if (!completion.isComplete) {
      setError(`Profil incomplet : ${completion.missingFields.map((field) => field.label).join(", ")}.`);
      return;
    }
    setIsSaving(true);

    try {
      const response = await fetch(`/api/pets/${petId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erreur sauvegarde");
        return;
      }

      router.push("/pets");
      router.refresh();
    } catch {
      setError("Erreur sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFbf7] text-orange-600">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">

      <main className="container mx-auto max-w-5xl px-4 pt-28 sm:px-6 md:pt-32">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/pets" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-orange-700">
              <ArrowLeft className="h-4 w-4" />
              Retour aux animaux
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-extrabold text-gray-950 md:text-5xl"
            >
              Modifier {formData.name || "l'animal"}
            </motion.h1>
            <p className="mt-2 max-w-2xl text-base text-gray-600 md:text-lg">
              Complétez tous les champs marqués d’un * pour pouvoir effectuer une réservation.
            </p>
          </div>

          <Link
            href={`/pets/${petId}/health`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm hover:border-orange-200 hover:text-orange-700"
          >
            Carnet santé
          </Link>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <PetProfileForm
            formData={formData}
            setFormData={setFormData}
            uploadButtonLabel="Modifier la photo"
            birthDateVerified={birthDateVerified}
            birthDateProofRequired={birthDateProofRequired}
          />

          <div className="sticky bottom-4 z-10 grid gap-3 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => router.push("/pets")} className="h-12 rounded-md border-gray-300">
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving} className="h-12 rounded-md bg-gray-950 text-white hover:bg-orange-600">
              {isSaving ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
