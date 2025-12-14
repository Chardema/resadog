"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccessMessage("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Une erreur est survenue lors de la connexion");
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
            Connexion 🔐
          </h1>
          <p className="text-gray-600 mb-6 text-lg">
            Accédez à votre espace personnel <span className="text-orange-600">✨</span>
          </p>

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border-2 border-green-300 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium"
            >
              ✅ {successMessage}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl mb-6 font-medium"
            >
              ❌ {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <Label htmlFor="password" className="text-gray-700 font-semibold">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="Votre mot de passe"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={isLoading}
                className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-gray-600 font-medium">Se souvenir de moi</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-orange-600 hover:text-orange-700 font-semibold hover:underline transition-colors"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? "Connexion en cours..." : "Se connecter ✨"}
              </Button>
            </motion.div>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Vous n'avez pas encore de compte ?{" "}
            <Link
              href="/auth/signup"
              className="text-orange-600 hover:text-orange-700 font-bold hover:underline transition-colors"
            >
              Créer un compte 🐾
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

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="animate-spin text-4xl">🐾</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
