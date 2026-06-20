"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demande impossible");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFbf7] flex items-center justify-center p-6">
      <section className="w-full max-w-[460px] bg-white rounded-lg shadow-xl border border-orange-100 p-8 sm:p-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Mot de passe oublié ?</h1>
        <p className="text-gray-600 mb-7">Saisissez l'adresse email de votre compte. Le lien reçu sera valable une heure.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold text-gray-700" htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-lg border border-gray-200 px-4"
            placeholder="vous@exemple.com"
          />
          {message && <p className="text-sm font-semibold text-green-700">{message}</p>}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button disabled={loading} className="h-12 w-full rounded-lg bg-gray-900 font-bold text-white disabled:opacity-50">
            {loading ? "Envoi..." : "Recevoir le lien"}
          </button>
        </form>
        <Link href="/auth/signin" className="mt-5 inline-block text-sm font-bold text-orange-700">Retour à la connexion</Link>
      </section>
    </main>
  );
}
