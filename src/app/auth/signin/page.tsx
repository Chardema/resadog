"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    secondFactor: "",
  });

  const successMessage =
    searchParams.get("verification") === "success"
      ? "Adresse confirmée. Votre compte est maintenant actif."
      : searchParams.get("reset") === "true"
        ? "Mot de passe modifié. Toutes vos anciennes sessions ont été révoquées."
        : "";
  const verificationError =
    searchParams.get("verification") === "invalid"
      ? "Ce lien de vérification est invalide ou a expiré."
      : searchParams.get("verification") === "rate-limited"
        ? "Trop de tentatives de vérification. Réessayez plus tard."
        : searchParams.get("verification") === "error"
          ? "La vérification est momentanément indisponible."
          : "";

  const completeSignIn = async () => {
    const result = await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      secondFactor: formData.secondFactor,
      redirect: false,
    });
    if (result?.error) throw new Error("Identifiants ou code de sécurité incorrects.");
    router.push(callbackUrl);
    router.refresh();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!needsTwoFactor) {
        const response = await fetch("/api/auth/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Connexion impossible.");
        if (data.requiresTwoFactor) {
          setNeedsTwoFactor(true);
          return;
        }
      }
      await completeSignIn();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Connexion impossible.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFbf7] px-5 py-12 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[440px] rounded-[2rem] border border-orange-100 bg-white p-7 shadow-2xl shadow-orange-950/10 sm:p-10">
        <div className="mb-7 text-center">
          <Link href="/" className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-orange-600 text-2xl text-white">
            🐾
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-950">
            {needsTwoFactor ? "Vérification de sécurité" : "Bon retour !"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {needsTwoFactor
              ? "Saisissez le code de votre application d'authentification."
              : "Connectez-vous pour gérer vos gardes."}
          </p>
        </div>

        {(successMessage || verificationError || error) && (
          <p className={`mb-5 rounded-xl border p-3 text-sm font-semibold ${
            successMessage
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {successMessage || verificationError || error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!needsTwoFactor ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  className="h-12 rounded-xl"
                  placeholder="vous@exemple.com"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Link href="/auth/forgot-password" className="text-xs font-semibold text-orange-700 hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                  className="h-12 rounded-xl"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="second-factor">
                {useRecoveryCode ? "Code de récupération" : "Code à 6 chiffres"}
              </Label>
              <Input
                id="second-factor"
                inputMode={useRecoveryCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                required
                autoFocus
                value={formData.secondFactor}
                onChange={(event) =>
                  setFormData({ ...formData, secondFactor: event.target.value })
                }
                className="h-14 rounded-xl text-center font-mono text-lg tracking-[0.2em]"
                placeholder={useRecoveryCode ? "XXXX-XXXX-XXXX" : "000000"}
              />
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setFormData({ ...formData, secondFactor: "" });
                }}
                className="text-sm font-semibold text-orange-700 hover:underline"
              >
                {useRecoveryCode ? "Utiliser l'application" : "Utiliser un code de récupération"}
              </button>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="h-13 w-full rounded-xl bg-gray-950 text-base font-bold hover:bg-orange-600">
            <ShieldCheck className="h-5 w-5" />
            {isLoading ? "Vérification..." : needsTwoFactor ? "Valider le code" : "Se connecter"}
          </Button>
        </form>

        {!needsTwoFactor && <SocialAuthButtons callbackUrl={callbackUrl} />}

        <p className="mt-7 border-t border-gray-100 pt-6 text-center text-sm text-gray-500">
          Pas encore de compte ?{" "}
          <Link href={callbackUrl !== "/dashboard" ? `/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/signup"} className="font-bold text-gray-950 hover:text-orange-700">
            Créer un compte
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <SignInContent />
    </Suspense>
  );
}
