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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/auth/signin?registered=true");
      } else {
        const data = await response.json();
        setError(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      setError("Erreur de connexion au serveur");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* 3D Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-[15%] right-[15%] text-9xl opacity-10 blur-sm">🐕</motion.div>
        <motion.div animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, delay: 1 }} className="absolute bottom-[10%] left-[10%] text-8xl opacity-10 blur-sm">🏠</motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] relative z-10"
      >
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-orange-900/10 border border-white/50 p-10 overflow-hidden relative">
          
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6 group">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg mx-auto transform group-hover:-rotate-12 transition-transform">
                ✨
              </div>
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Bienvenue !</h1>
            <p className="text-gray-500">Rejoignez la famille et offrez le meilleur à votre chien.</p>
          </div>

          {/* Messages */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold text-center border border-red-100">
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold ml-1">Prénom</Label>
              <Input
                type="text"
                placeholder="Votre prénom"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
            </div>

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
              <Label className="text-gray-700 font-semibold ml-1">Mot de passe</Label>
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
              className="w-full h-14 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg shadow-xl hover:shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Déjà membre ?{" "}
              <Link href="/auth/signin" className="text-gray-900 font-bold hover:text-orange-600 transition-colors">
                Me connecter
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