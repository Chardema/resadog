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
  const [formData, setFormData] = useState({ email: "", password: "" });

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccessMessage("Compte créé avec succès ! Bienvenue 🐾");
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
        setError("Identifiants incorrects 😕");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Une erreur inattendue est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* 3D Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-20 left-[10%] text-8xl opacity-20 blur-sm">🦴</motion.div>
        <motion.div animate={{ y: [0, 20, 0] }} transition={{ duration: 7, repeat: Infinity, delay: 1 }} className="absolute bottom-20 right-[10%] text-8xl opacity-20 blur-sm">🎾</motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-orange-900/10 border border-white/50 p-10 overflow-hidden relative">
          
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6 group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg mx-auto transform group-hover:rotate-12 transition-transform">
                🐾
              </div>
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Bon retour !</h1>
            <p className="text-gray-500">Connectez-vous pour gérer vos gardes.</p>
          </div>

          {/* Messages */}
          {successMessage && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 text-green-700 p-4 rounded-xl mb-6 text-sm font-bold text-center border border-green-100">
              {successMessage}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold text-center border border-red-100">
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold ml-1">Email</Label>
              <Input
                type="email"
                placeholder="vous@exemple.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <Label className="text-gray-700 font-semibold">Mot de passe</Label>
                <Link href="/auth/forgot-password" className="text-xs text-orange-600 hover:underline font-medium">
                  Oublié ?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-xl bg-gray-900 hover:bg-orange-600 text-white font-bold text-lg shadow-xl hover:shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{" "}
              <Link href="/auth/signup" className="text-gray-900 font-bold hover:text-orange-600 transition-colors">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
        
        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
            ← Retour à l'accueil
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-4xl">🐕</div>}>
      <SignInContent />
    </Suspense>
  );
}