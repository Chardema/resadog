"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getPetProfileCompletion, requiresPetBirthDateProof } from "@/lib/pets";
import {
  emptyPetFormData,
  PetProfileForm,
  toPetPayload,
  type PetFormData,
} from "@/components/pets/PetProfileForm";

function NewPetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo =
    rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/pets";
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<PetFormData>(emptyPetFormData);
  const birthDateProofRequired = requiresPetBirthDateProof(session?.user?.role);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const payload = toPetPayload(formData);
    const completion = getPetProfileCompletion(payload, { requireBirthDateProof: birthDateProofRequired });
    if (!completion.isComplete) {
      setError(`Profil incomplet : ${completion.missingFields.map((field) => field.label).join(", ")}.`);
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Une erreur est survenue lors de l'ajout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">

      <main className="container mx-auto max-w-5xl px-4 pt-28 sm:px-6 md:pt-32">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href={returnTo} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-orange-700">
              <ArrowLeft className="h-4 w-4" />
              {returnTo === "/booking" ? "Retour à ma simulation" : "Retour aux animaux"}
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-extrabold text-gray-950 md:text-5xl"
            >
              Nouveau compagnon
            </motion.h1>
            <p className="mt-2 max-w-2xl text-base text-gray-600 md:text-lg">
              Tous les champs marqués d’un * sont nécessaires avant de pouvoir réserver.
            </p>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            <p className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              Utile pour les réservations
            </p>
            <p className="mt-1 text-orange-800">Le profil doit être complété à 100 % pour accéder aux réservations.</p>
          </div>
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
            uploadButtonLabel="Ajouter une photo"
            birthDateProofRequired={birthDateProofRequired}
          />

          <div className="sticky bottom-4 z-10 grid gap-3 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => router.push(returnTo)} className="h-12 rounded-md border-gray-300">
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading} className="h-12 rounded-md bg-gray-950 text-white hover:bg-orange-600">
              {isLoading ? "Création..." : "Créer le profil"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function NewPetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <NewPetContent />
    </Suspense>
  );
}
