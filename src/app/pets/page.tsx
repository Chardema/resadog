"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Cat,
  Dog,
  HeartPulse,
  Pencil,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { formatPetAge, getPetProfileCompletion, isPetBirthDateVerified } from "@/lib/pets";

interface Pet {
  id: string;
  name: string;
  species?: "DOG" | "CAT" | null;
  breed?: string | null;
  age?: number | null;
  birthDate?: string | null;
  birthDateProofUrl?: string | null;
  birthDateVerifiedAt?: string | null;
  weight?: number | null;
  gender?: string | null;
  spayedNeutered?: boolean | null;
  imageUrl?: string | null;
  medicalInfo?: string | null;
  behaviorNotes?: string | null;
  feedingSchedule?: string | null;
  medications?: string | null;
  vetInfo?: string | null;
  emergencyContact?: string | null;
}

export default function PetsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchPets();
    }
  }, [status, router]);

  const fetchPets = async () => {
    try {
      const response = await fetch("/api/pets");
      if (response.ok) {
        const data = await response.json();
        setPets(data.pets);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement le profil de ${name} ?`)) return;

    setDeleteError("");
    try {
      const response = await fetch(`/api/pets/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPets((currentPets) => currentPets.filter((pet) => pet.id !== id));
      } else {
        const data = await response.json().catch(() => null);
        setDeleteError(data?.error || "Impossible de supprimer ce profil.");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setDeleteError("Erreur de connexion. Réessayez dans quelques instants.");
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFbf7]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
      </div>
    );
  }

  const completeProfiles = pets.filter((pet) => getPetProfileCompletion(pet).isComplete).length;
  const verifiedAges = pets.filter((pet) => isPetBirthDateVerified(pet)).length;
  const missingDetails = Math.max(0, pets.length - completeProfiles);

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">

      <main className="container relative z-10 mx-auto px-4 pt-28 sm:px-6 md:pt-32">
        {deleteError && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {deleteError}
          </div>
        )}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 text-sm font-bold uppercase tracking-wide text-orange-600"
            >
              Profils animaux
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-extrabold text-gray-950 md:text-5xl"
            >
              Mes compagnons
            </motion.h1>
            <p className="mt-2 max-w-2xl text-base text-gray-600 md:text-lg">
              Centralisez les informations utiles avant une garde : âge, poids, santé, habitudes et contacts.
            </p>
          </div>

          <Link
            href="/pets/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Ajouter un animal
          </Link>
        </div>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Animaux" value={pets.length} />
          <SummaryCard label="Profils complets" value={completeProfiles} tone="green" />
          <SummaryCard label="Âges vérifiés" value={verifiedAges} tone={verifiedAges === pets.length ? "green" : "amber"} />
          <SummaryCard label="À compléter" value={missingDetails} tone={missingDetails > 0 ? "amber" : "green"} />
        </section>

        {pets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-orange-100 text-orange-700">
              <Dog className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-950">Aucun profil animal</h2>
            <p className="mx-auto mt-2 max-w-md text-gray-600">
              Ajoutez votre premier compagnon pour remplir les réservations plus vite et transmettre les bonnes informations.
            </p>
            <Link
              href="/pets/new"
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Créer un profil
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pets.map((pet, index) => (
              <PetCard
                key={pet.id}
                pet={pet}
                index={index}
                onDelete={() => handleDelete(pet.id, pet.name)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "green" | "amber";
}) {
  const toneClasses = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-emerald-100 bg-emerald-50 text-emerald-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClasses}`}>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function PetCard({
  pet,
  index,
  onDelete,
}: {
  pet: Pet;
  index: number;
  onDelete: () => void;
}) {
  const SpeciesIcon = pet.species === "CAT" ? Cat : Dog;
  const hasAge = pet.age !== null && pet.age !== undefined;
  const hasWeight = Boolean(pet.weight);
  const completion = getPetProfileCompletion(pet);
  const ageVerified = isPetBirthDateVerified(pet);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-orange-50 text-orange-700">
          {pet.imageUrl ? (
            <Image src={pet.imageUrl} alt={pet.name} fill sizes="112px" className="object-cover" />
          ) : (
            <SpeciesIcon className="h-10 w-10" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-extrabold text-gray-950">{pet.name}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {pet.breed || "Race non renseignée"} · {pet.species === "CAT" ? "Chat" : "Chien"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                completion.isComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {completion.isComplete ? "Profil complet" : `${completion.percentage} % complété`}
              </span>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                ageVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {ageVerified ? "Âge vérifié" : "Âge à vérifier"}
              </span>
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                <SpeciesIcon className="h-3.5 w-3.5" />
                {pet.gender === "MALE" ? "Mâle" : pet.gender === "FEMALE" ? "Femelle" : "Sexe inconnu"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <InfoPill icon={HeartPulse} label="Âge" value={hasAge ? formatPetAge(pet.age) : "À compléter"} warn={!hasAge} />
            <InfoPill icon={Scale} label="Poids" value={hasWeight ? `${pet.weight} kg` : "À compléter"} warn={!hasWeight} />
            <InfoPill
              icon={ShieldCheck}
              label="Stérilisé"
              value={pet.spayedNeutered === null || pet.spayedNeutered === undefined ? "À compléter" : pet.spayedNeutered ? "Oui" : "Non"}
              warn={pet.spayedNeutered === null || pet.spayedNeutered === undefined}
            />
          </div>

          {(!completion.isComplete || !ageVerified) && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">Réservation temporairement bloquée</p>
              {!completion.isComplete && (
                <p className="mt-1">À renseigner : {completion.missingFields.map((field) => field.label).join(", ")}.</p>
              )}
              {completion.isComplete && !ageVerified && (
                <p className="mt-1">Le justificatif a été transmis et doit maintenant être validé par l’équipe.</p>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link
              href={`/pets/${pet.id}/health`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <HeartPulse className="h-4 w-4" />
              Santé
            </Link>
            <Link
              href={`/pets/${pet.id}/edit`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-200"
            >
              <Pencil className="h-4 w-4" />
              {completion.isComplete ? "Modifier" : "Compléter"}
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function InfoPill({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${warn ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-bold ${warn ? "text-amber-800" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
