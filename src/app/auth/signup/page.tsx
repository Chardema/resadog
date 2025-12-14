"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      router.push("/auth/signin?registered=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Décorations de fond */}
      <div className="absolute top-20 left-10 text-6xl opacity-10 animate-bounce">🐕</div>
      <div className="absolute bottom-20 right-10 text-6xl opacity-10 animate-bounce" style={{ animationDelay: "0.5s" }}>🦴</div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <motion.div
            whileHover={{ scale: 1.1, rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg transform rotate-12">
              🐾
            </div>
            <div className="absolute -top-1 -right-1 text-yellow-400 text-xl animate-pulse">
              ✨
            </div>
          </motion.div>
          <div>
            <span className="text-3xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
              La Patte Dorée
            </span>
            <p className="text-xs text-orange-600 font-medium text-center">Garde de chiens de luxe</p>
          </div>
        </Link>

        {/* Formulaire */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
            Créer un compte 👋
          </h1>
          <p className="text-gray-600 mb-6 text-lg">
            Rejoignez <span className="font-bold text-orange-600">La Patte Dorée</span> pour réserver vos gardes 🐶
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl mb-6 font-medium"
            >
              ❌ {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-700 font-semibold">Nom complet</Label>
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
                className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 font-semibold">Email</Label>
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
                className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-gray-700 font-semibold">Téléphone (optionnel)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={isLoading}
                className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-semibold">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 caractères"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={isLoading}
                className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-gray-700 font-semibold">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Retapez votre mot de passe"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                required
                disabled={isLoading}
                className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl"
              />
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="pt-2"
            >
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? "Création en cours..." : "Créer mon compte ✨"}
              </Button>
            </motion.div>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Vous avez déjà un compte ?{" "}
            <Link
              href="/auth/signin"
              className="text-orange-600 hover:text-orange-700 font-bold hover:underline transition-colors"
            >
              Se connecter 🔐
            </Link>
          </div>
        </motion.div>

        {/* Retour à l'accueil */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 text-center"
        >
          <Link
            href="/"
            className="text-gray-700 hover:text-orange-600 text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            <span>←</span> Retour à l'accueil
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
