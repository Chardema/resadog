"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export default function NewPetPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // States
  const [ageUnit, setAgeUnit] = useState<"YEARS" | "MONTHS">("YEARS");
  const [formData, setFormData] = useState({
    name: "",
    species: "DOG" as "DOG" | "CAT",
    breed: "",
    age: "", // Input value as string
    weight: "",
    gender: "UNKNOWN" as "MALE" | "FEMALE" | "UNKNOWN",
    spayedNeutered: false,
    imageUrl: "",
    medicalInfo: "",
    behaviorNotes: "",
    feedingSchedule: "",
    medications: "",
    vetInfo: "",
    emergencyContact: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Conversion de l'âge sécurisée
      let finalAge: number | undefined = undefined;
      const parsedAge = parseFloat(formData.age);
      
      if (!isNaN(parsedAge)) {
        if (ageUnit === "MONTHS") {
          finalAge = parseFloat((parsedAge / 12).toFixed(2)); // Convertir mois en années
        } else {
          finalAge = parsedAge;
        }
      }

      // Conversion du poids sécurisée
      let finalWeight: number | undefined = undefined;
      const parsedWeight = parseFloat(formData.weight);
      if (!isNaN(parsedWeight)) {
        finalWeight = parsedWeight;
      }

      const petData = {
        ...formData,
        age: finalAge,
        weight: finalWeight,
      };

      const response = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(petData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      router.push("/pets");
      router.refresh();
    } catch (err) {
      setError("Une erreur est survenue lors de l'ajout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 pb-20">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold text-xl shadow-lg transform group-hover:rotate-12 transition-transform">
                🐾
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-yellow-600">La Patte Dorée</span>
            </Link>
            <Link href="/pets" className="text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors">
              ← Annuler
            </Link>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <div className="container mx-auto px-6 py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">Nouveau Compagnon ✨</h1>
          <p className="text-gray-500 text-lg">Dites-nous tout sur votre ami à quatre pattes.</p>
        </motion.div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg mb-8 shadow-sm">
            <p className="font-bold">Oups !</p>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. Espèce */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
              C'est un...
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div 
                onClick={() => setFormData({...formData, species: "DOG"})}
                className={`cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col items-center gap-3 ${formData.species === "DOG" ? "border-orange-500 bg-orange-50 shadow-lg scale-105" : "border-gray-200 hover:border-orange-200 bg-white"}`}
              >
                <span className="text-5xl">🐕</span>
                <span className={`font-bold text-lg ${formData.species === "DOG" ? "text-orange-700" : "text-gray-600"}`}>Chien</span>
              </div>
              <div 
                onClick={() => setFormData({...formData, species: "CAT"})}
                className={`cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col items-center gap-3 ${formData.species === "CAT" ? "border-orange-500 bg-orange-50 shadow-lg scale-105" : "border-gray-200 hover:border-orange-200 bg-white"}`}
              >
                <span className="text-5xl">🐈</span>
                <span className={`font-bold text-lg ${formData.species === "CAT" ? "text-orange-700" : "text-gray-600"}`}>Chat</span>
              </div>
            </div>
          </section>

          {/* 2. Photo & Identité */}
          <section className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
              Identité
            </h2>
            
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Photo Upload */}
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <div className="relative w-32 h-32">
                  {formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="Aperçu" className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg" />
                      <button type="button" onClick={() => setFormData({...formData, imageUrl: ""})} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 shadow-md">✕</button>
                    </>
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 text-4xl text-gray-300">
                      📷
                    </div>
                  )}
                </div>
                <UploadButton<OurFileRouter, "petImage">
                  endpoint="petImage"
                  onClientUploadComplete={(res) => res?.[0] && setFormData({...formData, imageUrl: res[0].url})}
                  onUploadError={() => alert("Erreur upload")}
                  appearance={{
                    button: "bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs px-3 py-2 h-auto rounded-full font-bold",
                    allowedContent: "hidden"
                  }}
                  content={{ button: "Ajouter photo" }}
                />
              </div>

              {/* Champs */}
              <div className="flex-grow grid md:grid-cols-2 gap-5 w-full">
                <div className="col-span-2">
                  <Label className="text-gray-600">Son petit nom <span className="text-red-400">*</span></Label>
                  <Input 
                    placeholder="Ex: Rex, Luna..." 
                    className="bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500 focus:border-orange-500" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label className="text-gray-600">Race</Label>
                  <Input 
                    placeholder={formData.species === "DOG" ? "Golden Retriever" : "Siamois"} 
                    className="bg-gray-50 border-gray-200 h-12 rounded-xl"
                    value={formData.breed}
                    onChange={(e) => setFormData({...formData, breed: e.target.value})}
                  />
                </div>

                <div>
                  <Label className="text-gray-600">Genre</Label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-200 h-12 rounded-xl px-3 outline-none focus:ring-2 focus:ring-orange-500"
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
                  >
                    <option value="UNKNOWN">Je ne sais pas</option>
                    <option value="MALE">Mâle ♂️</option>
                    <option value="FEMALE">Femelle ♀️</option>
                  </select>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <Label className="text-gray-600">Âge</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder="Ex: 2" 
                      step="0.1" 
                      className="flex-1 bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500"
                      value={formData.age}
                      onChange={(e) => setFormData({...formData, age: e.target.value})}
                    />
                    <div className="flex bg-gray-100 rounded-xl p-1 h-12">
                      <button 
                        type="button"
                        onClick={() => setAgeUnit("YEARS")}
                        className={`px-3 rounded-lg text-sm font-medium transition-all ${ageUnit === "YEARS" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        Ans
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAgeUnit("MONTHS")}
                        className={`px-3 rounded-lg text-sm font-medium transition-all ${ageUnit === "MONTHS" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        Mois
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-600">Poids (kg)</Label>
                  <Input 
                    type="number" 
                    placeholder="Ex: 12.5" 
                    step="0.1"
                    className="bg-gray-50 border-gray-200 h-12 rounded-xl"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  />
                </div>
                
                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                      checked={formData.spayedNeutered}
                      onChange={(e) => setFormData({...formData, spayedNeutered: e.target.checked})}
                    />
                    <span className="text-gray-700 font-medium">Stérilisé / Castré</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Détails & Santé */}
          <section className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
              Santé & Habitudes
            </h2>
            
            <div className="space-y-6">
              <div>
                <Label className="text-gray-600">Informations médicales</Label>
                <textarea 
                  className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl min-h-[100px] mt-2 focus:ring-orange-500 outline-none"
                  placeholder="Allergies, maladies chroniques, vaccins..."
                  value={formData.medicalInfo}
                  onChange={(e) => setFormData({...formData, medicalInfo: e.target.value})}
                />
              </div>
              
              <div>
                <Label className="text-gray-600">Comportement</Label>
                <textarea 
                  className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl min-h-[100px] mt-2 focus:ring-orange-500 outline-none"
                  placeholder="S'entend-il avec les autres animaux ? Avec les enfants ? Peureux ?"
                  value={formData.behaviorNotes}
                  onChange={(e) => setFormData({...formData, behaviorNotes: e.target.value})}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-600">Vétérinaire</Label>
                  <textarea 
                    className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl mt-2 focus:ring-orange-500 outline-none"
                    rows={3}
                    placeholder="Nom et téléphone du vétérinaire"
                    value={formData.vetInfo}
                    onChange={(e) => setFormData({...formData, vetInfo: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-gray-600">Contact d'urgence</Label>
                  <textarea 
                    className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl mt-2 focus:ring-orange-500 outline-none"
                    rows={3}
                    placeholder="Personne à contacter en cas d'urgence"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="pt-4 flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1 h-14 rounded-xl text-lg border-gray-300">
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1 h-14 rounded-xl text-lg bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 text-white shadow-lg hover:shadow-xl transition-all">
              {isLoading ? "Création..." : "Créer le profil ✨"}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
