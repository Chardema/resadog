"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

interface PetData {
  name: string;
  breed: string;
  age: string;
  weight: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  spayedNeutered: boolean;
  imageUrl: string;
  medicalInfo: string;
  behaviorNotes: string;
  feedingSchedule: string;
  medications: string;
  vetInfo: string;
  emergencyContact: string;
}

export default function EditPetPage() {
  const router = useRouter();
  const params = useParams();
  const petId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<PetData>({
    name: "",
    breed: "",
    age: "",
    weight: "",
    gender: "UNKNOWN",
    spayedNeutered: false,
    imageUrl: "",
    medicalInfo: "",
    behaviorNotes: "",
    feedingSchedule: "",
    medications: "",
    vetInfo: "",
    emergencyContact: "",
  });

  useEffect(() => {
    fetchPet();
  }, [petId]);

  const fetchPet = async () => {
    try {
      const response = await fetch(`/api/pets/${petId}`);
      if (response.status === 401) {
        router.push("/auth/signin");
        return;
      }
      if (!response.ok) {
        setError("Impossible de charger les données de l'animal");
        return;
      }
      const data = await response.json();
      const pet = data.pet;

      setFormData({
        name: pet.name || "",
        breed: pet.breed || "",
        age: pet.age?.toString() || "",
        weight: pet.weight?.toString() || "",
        gender: pet.gender || "UNKNOWN",
        spayedNeutered: pet.spayedNeutered || false,
        imageUrl: pet.imageUrl || "",
        medicalInfo: pet.medicalInfo || "",
        behaviorNotes: pet.behaviorNotes || "",
        feedingSchedule: pet.feedingSchedule || "",
        medications: pet.medications || "",
        vetInfo: pet.vetInfo || "",
        emergencyContact: pet.emergencyContact || "",
      });
    } catch (err) {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const petData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
      };

      const response = await fetch(`/api/pets/${petId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(petData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        console.error("Erreur API:", data);
        return;
      }

      // Succès! Rediriger vers la page des animaux
      console.log("Animal mis à jour avec succès:", data);
      router.push("/pets");
      router.refresh();
    } catch (err) {
      console.error("Erreur lors de la mise à jour:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la mise à jour"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                R
              </div>
              <span className="text-xl font-bold text-gray-900">La Patte Dorée</span>
            </Link>
            <Link
              href="/pets"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              ← Retour à mes animaux
            </Link>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Modifier {formData.name} ✏️
            </h1>
            <p className="text-gray-600">
              Mettez à jour les informations de votre compagnon
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6"
            >
              {error}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo de l'animal */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Photo de profil 📸
                </h2>
                <div className="flex items-center gap-6">
                  {formData.imageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.imageUrl}
                        alt={formData.name}
                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, imageUrl: "" })
                        }
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                      <span className="text-5xl">
                        {formData.gender === "MALE"
                          ? "🐕"
                          : formData.gender === "FEMALE"
                          ? "🐩"
                          : "🐶"}
                      </span>
                    </div>
                  )}
                  <div>
                    <UploadButton<OurFileRouter, "petImage">
                      endpoint="petImage"
                      onClientUploadComplete={(res) => {
                        if (res?.[0]?.url) {
                          setFormData({ ...formData, imageUrl: res[0].url });
                        }
                      }}
                      onUploadError={(error: Error) => {
                        console.error("Erreur upload:", error);
                        alert(
                          `Erreur d'upload: ${error.message}\n\nVous devez configurer Uploadthing. Consultez UPLOADTHING_SETUP.md`
                        );
                      }}
                      appearance={{
                        button:
                          "bg-blue-600 text-white font-semibold hover:bg-blue-700 px-4 py-2 rounded-md text-sm transition-colors ut-ready:bg-blue-600 ut-uploading:bg-blue-700",
                        allowedContent: "text-gray-600 text-sm",
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Format: JPG, PNG (max 4MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Informations de base */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Informations de base ✨
                </h2>

                <div>
                  <Label htmlFor="name">
                    Nom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ex: Max, Luna, Charlie..."
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    disabled={isSaving}
                    className="mt-1"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="breed">Race</Label>
                    <Input
                      id="breed"
                      type="text"
                      placeholder="Ex: Labrador, Berger Allemand..."
                      value={formData.breed}
                      onChange={(e) =>
                        setFormData({ ...formData, breed: e.target.value })
                      }
                      disabled={isSaving}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="age">Âge (en années)</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="Ex: 3"
                      min="0"
                      max="30"
                      value={formData.age}
                      onChange={(e) =>
                        setFormData({ ...formData, age: e.target.value })
                      }
                      disabled={isSaving}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="weight">Poids (en kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="Ex: 25"
                      min="0"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                      disabled={isSaving}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender">Genre</Label>
                    <select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gender: e.target.value as
                            | "MALE"
                            | "FEMALE"
                            | "UNKNOWN",
                        })
                      }
                      disabled={isSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UNKNOWN">Non spécifié</option>
                      <option value="MALE">Mâle 🐕</option>
                      <option value="FEMALE">Femelle 🐩</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="spayedNeutered"
                    type="checkbox"
                    checked={formData.spayedNeutered}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        spayedNeutered: e.target.checked,
                      })
                    }
                    disabled={isSaving}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="spayedNeutered" className="cursor-pointer">
                    Stérilisé(e)
                  </Label>
                </div>
              </div>

              {/* Informations complémentaires */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Informations complémentaires 📋
                </h2>

                <div>
                  <Label htmlFor="medicalInfo">Informations médicales</Label>
                  <textarea
                    id="medicalInfo"
                    placeholder="Allergies, conditions médicales, vaccinations..."
                    value={formData.medicalInfo}
                    onChange={(e) =>
                      setFormData({ ...formData, medicalInfo: e.target.value })
                    }
                    disabled={isSaving}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="behaviorNotes">Notes comportementales</Label>
                  <textarea
                    id="behaviorNotes"
                    placeholder="Tempérament, comportement avec d'autres animaux, enfants..."
                    value={formData.behaviorNotes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        behaviorNotes: e.target.value,
                      })
                    }
                    disabled={isSaving}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="feedingSchedule">
                    Horaires et habitudes alimentaires
                  </Label>
                  <textarea
                    id="feedingSchedule"
                    placeholder="Ex: 2 repas par jour (8h et 18h), croquettes sans céréales..."
                    value={formData.feedingSchedule}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        feedingSchedule: e.target.value,
                      })
                    }
                    disabled={isSaving}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="medications">Médicaments</Label>
                  <textarea
                    id="medications"
                    placeholder="Médicaments réguliers, dosages, horaires..."
                    value={formData.medications}
                    onChange={(e) =>
                      setFormData({ ...formData, medications: e.target.value })
                    }
                    disabled={isSaving}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="vetInfo">Informations vétérinaire</Label>
                  <textarea
                    id="vetInfo"
                    placeholder="Nom, adresse et téléphone du vétérinaire..."
                    value={formData.vetInfo}
                    onChange={(e) =>
                      setFormData({ ...formData, vetInfo: e.target.value })
                    }
                    disabled={isSaving}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="emergencyContact">Contact d'urgence</Label>
                  <Input
                    id="emergencyContact"
                    type="text"
                    placeholder="Nom et téléphone en cas d'urgence..."
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: e.target.value,
                      })
                    }
                    disabled={isSaving}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/pets")}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1"
                  size="lg"
                >
                  {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
