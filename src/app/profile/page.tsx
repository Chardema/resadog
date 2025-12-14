"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    image: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
    if (session?.user) {
      setFormData({
        name: session.user.name || "",
        email: session.user.email || "",
        phone: "", // TODO: récupérer depuis l'API
        image: session.user.image || "",
      });
    }
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      setSuccess("Profil mis à jour avec succès!");
      // Mettre à jour la session
      await update();
    } catch (err) {
      setError("Une erreur est survenue lors de la mise à jour");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
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
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                R
              </div>
              <span className="text-xl font-bold text-gray-900">La Patte Dorée</span>
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
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
          className="max-w-2xl mx-auto"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Mon profil 👤
            </h1>
            <p className="text-gray-600">
              Gérez vos informations personnelles
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

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6"
            >
              {success}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo de profil */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Photo de profil 📸
                </h2>
                <div className="flex items-center gap-6">
                  {formData.image ? (
                    <div className="relative">
                      <img
                        src={formData.image}
                        alt="Photo de profil"
                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, image: "" })
                        }
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                      <span className="text-5xl">👤</span>
                    </div>
                  )}
                  <div>
                    <UploadButton<OurFileRouter, "petImage">
                      endpoint="petImage"
                      onClientUploadComplete={(res) => {
                        if (res?.[0]?.url) {
                          setFormData({ ...formData, image: res[0].url });
                        }
                      }}
                      onUploadError={(error: Error) => {
                        alert(`Erreur: ${error.message}`);
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

              {/* Informations personnelles */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Informations personnelles ✨
                </h2>

                <div>
                  <Label htmlFor="name">
                    Nom complet <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    disabled={isLoading}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean@exemple.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={isLoading}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    L'email ne peut pas être modifié pour le moment
                  </p>
                </div>

                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={isLoading}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Sécurité */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Sécurité 🔒
                </h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    Mot de passe
                  </p>
                  <p className="text-sm text-blue-700 mb-3">
                    Pour des raisons de sécurité, la modification du mot de passe nécessite une vérification par email.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => alert("Cette fonctionnalité sera bientôt disponible")}
                  >
                    Changer mon mot de passe
                  </Button>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                  size="lg"
                >
                  {isLoading ? "Enregistrement..." : "Enregistrer les modifications"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
