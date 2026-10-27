"use client";

import { Suspense, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

function TwoFactorChallenge() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const requestedNext = searchParams.get("next") || "/dashboard";
  const safeNext =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/dashboard";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
    if (status === "authenticated" && session.user.twoFactorVerified) {
      router.replace(safeNext);
    }
  }, [router, safeNext, session, status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vérification impossible.");
      if (data.twoFactorToken) await update({ twoFactorToken: data.twoFactorToken });
      router.replace(safeNext);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Vérification impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFbf7] px-5 py-16 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[440px] rounded-[2rem] border border-orange-100 bg-white p-8 shadow-xl sm:p-10">
        <ShieldCheck className="mx-auto h-14 w-14 text-orange-600" />
        <h1 className="mt-5 text-center text-3xl font-extrabold text-gray-950">Confirmez votre identité</h1>
        <p className="mt-3 text-center leading-6 text-gray-600">
          {recoveryMode
            ? "Utilisez l'un des codes de récupération enregistrés lors de l'activation."
            : "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres."}
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <input
            autoFocus
            required
            autoComplete="one-time-code"
            inputMode={recoveryMode ? "text" : "numeric"}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={recoveryMode ? "XXXX-XXXX-XXXX" : "000000"}
            className="h-14 w-full rounded-xl border border-gray-200 px-4 text-center font-mono text-xl tracking-[0.2em]"
          />
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 font-bold text-white hover:bg-orange-600 disabled:opacity-50">
            <KeyRound className="h-5 w-5" />
            {loading ? "Vérification..." : "Continuer"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setRecoveryMode(!recoveryMode);
            setCode("");
            setError("");
          }}
          className="mt-5 w-full text-center text-sm font-semibold text-orange-700 hover:underline"
        >
          {recoveryMode ? "Utiliser l'application" : "Utiliser un code de récupération"}
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="mt-5 w-full text-center text-sm text-gray-500 hover:text-gray-900"
        >
          Annuler et se déconnecter
        </button>
      </section>
    </main>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <TwoFactorChallenge />
    </Suspense>
  );
}
