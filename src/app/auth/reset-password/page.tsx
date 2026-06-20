"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) return setError("Les mots de passe ne correspondent pas");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: searchParams.get("email"),
          token: searchParams.get("token"),
          password,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Réinitialisation impossible");
      router.push("/auth/signin?reset=true");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFbf7] flex items-center justify-center p-6">
      <section className="w-full max-w-[460px] rounded-lg border border-orange-100 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="mb-3 text-3xl font-extrabold text-gray-900">Nouveau mot de passe</h1>
        <p className="mb-7 text-gray-600">Choisissez au moins 8 caractères.</p>
        <form onSubmit={submit} className="space-y-4">
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-lg border border-gray-200 px-4" placeholder="Nouveau mot de passe" />
          <input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-12 w-full rounded-lg border border-gray-200 px-4" placeholder="Confirmer le mot de passe" />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button disabled={loading} className="h-12 w-full rounded-lg bg-gray-900 font-bold text-white disabled:opacity-50">
            {loading ? "Enregistrement..." : "Changer le mot de passe"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
