"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/layout/AppNav";

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
  const { data: session, status } = useSession();
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center">
        <div className="text-6xl animate-bounce">🐕</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-20">
      <AppNav userName={session?.user?.name} />

      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] bg-orange-200/20 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 pt-32 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl font-extrabold text-gray-900 mb-2"
            >
              Mes Compagnons 🐾
            </motion.h1>
            <p className="text-gray-500 text-lg">Gérez les profils de vos animaux</p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/pets/new" className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full font-bold shadow-xl hover:bg-orange-600 transition-colors">
              <span className="text-xl">+</span> Ajouter un animal
            </Link>
          </motion.div>
        </div>

        {pets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] border border-gray-100 shadow-xl p-16 text-center max-w-2xl mx-auto"
          >
            <div className="text-8xl mb-6 grayscale opacity-50">🐶</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              C'est un peu vide ici...
            </h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Ajoutez le profil de votre premier compagnon pour pouvoir effectuer des réservations plus rapidement.
            </p>
            <Link 
              href="/pets/new"
              className="bg-orange-100 text-orange-700 px-8 py-3 rounded-xl font-bold hover:bg-orange-200 transition-colors"
            >
              Créer un profil
            </Link>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pets.map((pet, index) => (
              <motion.div
                key={pet.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -10, rotateZ: index % 2 === 0 ? 1 : -1 }}
                className="group relative bg-white rounded-[2.5rem] p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden"
              >
                {/* Image / Avatar */}
                <div className="aspect-square rounded-[2rem] bg-gradient-to-br from-orange-50 to-orange-100 mb-6 overflow-hidden relative shadow-inner">
                  {pet.imageUrl ? (
                    <img
                      src={pet.imageUrl}
                      alt={pet.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-8xl">
                      {pet.gender === "MALE" ? "🐕" : pet.gender === "FEMALE" ? "🐩" : "🐶"}
                    </div>
                  )}
                  
                  {/* Badge Genre */}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-700 shadow-sm">
                    {pet.gender === "MALE" ? "♂ Mâle" : pet.gender === "FEMALE" ? "♀ Femelle" : "?"}
                  </div>
                </div>

                {/* Infos */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                    {pet.name}
                  </h3>
                  <p className="text-gray-500 font-medium">
                    {pet.breed || "Race inconnue"} • {pet.age ? `${pet.age} ans` : "Âge inconnu"}
                  </p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-4 group-hover:translate-y-0">
                  <Link 
                    href={`/pets/${pet.id}/edit`}
                    className="flex items-center justify-center py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
                  >
                    ✏️ Modifier
                  </Link>
                  <button
                    onClick={() => handleDelete(pet.id, pet.name)}
                    className="flex items-center justify-center py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm transition-colors"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}