"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Inscription impossible.");
      const verifyUrl = `/auth/verify-email/sent?email=${encodeURIComponent(formData.email)}${
        callbackUrl !== "/dashboard" ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""
      }`;
      router.push(verifyUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFbf7] px-5 py-12 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[480px] rounded-[2rem] border border-orange-100 bg-white p-7 shadow-2xl shadow-orange-950/10 sm:p-10">
        <div className="mb-7 text-center">
          <Link href="/" className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gray-950 text-2xl text-white">✨</Link>
          <h1 className="text-3xl font-extrabold text-gray-950">Créer mon compte</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Votre adresse sera vérifiée avant la première connexion.
          </p>
        </div>

        {error && (
          <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" autoComplete="name" required minLength={2} maxLength={80} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="h-12 rounded-xl" placeholder="vous@exemple.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} className="h-12 rounded-xl" />
            <p className="text-xs leading-5 text-gray-500">
              12 caractères minimum, avec une majuscule, une minuscule et un chiffre.
            </p>
          </div>
          <Button type="submit" disabled={isLoading} className="h-13 w-full rounded-xl bg-gray-950 text-base font-bold hover:bg-orange-600">
            {isLoading ? "Création..." : "Créer mon compte"}
          </Button>
        </form>

        <SocialAuthButtons callbackUrl={callbackUrl} />

        <p className="mt-7 border-t border-gray-100 pt-6 text-center text-sm text-gray-500">
          Déjà membre ?{" "}
          <Link href={callbackUrl !== "/dashboard" ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/signin"} className="font-bold text-gray-950 hover:text-orange-700">
            Me connecter
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <SignUpContent />
    </Suspense>
  );
}
