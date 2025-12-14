"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Pet {
  id: string;
  name: string;
  breed?: string | null;
  age?: number | null;
  gender?: string | null;
  imageUrl?: string | null;
}

export default function PetsPage() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async () => {
    try {
      const response = await fetch("/api/pets");
      if (response.status === 401) {
        // Non authentifié, rediriger vers la page de connexion
        router.push("/auth/signin");
        return;
      }
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
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${name} ? 😢`)) {
      return;
    }

    try {
      const response = await fetch(`/api/pets/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPets(pets.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      {/* TODO: Add AppNav here once we have session data in client component */}
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                R
              </div>
              <span className="text-xl font-bold text-gray-900">La Patte Dorée</span>
            </Link>
            <Link href="/dashboard" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
              ← Retour au dashboard
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
          className="max-w-6xl mx-auto"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Mes compagnons 🐕
              </h1>
              <p className="text-gray-600">
                Gérez les profils de vos animaux
              </p>
            </div>
            <Link href="/pets/new">
              <Button size="lg">
                + Ajouter un animal
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : pets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-sm p-12 text-center"
            >
              <div className="text-6xl mb-4">🐶</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Aucun animal enregistré
              </h3>
              <p className="text-gray-600 mb-6">
                Ajoutez le profil de votre premier compagnon pour commencer
              </p>
              <Link href="/pets/new">
                <Button>Ajouter mon premier animal</Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pets.map((pet, index) => (
                <motion.div
                  key={pet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
                >
                  <div className="aspect-square bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                    {pet.imageUrl ? (
                      <img
                        src={pet.imageUrl}
                        alt={pet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-6xl">
                        {pet.gender === "MALE" ? "🐕" : pet.gender === "FEMALE" ? "🐩" : "🐶"}
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {pet.name}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                      {pet.breed && (
                        <p>
                          <span className="font-medium">Race:</span> {pet.breed}
                        </p>
                      )}
                      {pet.age && (
                        <p>
                          <span className="font-medium">Âge:</span> {pet.age} an{pet.age > 1 ? "s" : ""}
                        </p>
                      )}
                      {pet.gender && (
                        <p>
                          <span className="font-medium">Genre:</span>{" "}
                          {pet.gender === "MALE" ? "Mâle" : pet.gender === "FEMALE" ? "Femelle" : "Non spécifié"}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/pets/${pet.id}/edit`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          ✏️ Modifier
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(pet.id, pet.name)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
