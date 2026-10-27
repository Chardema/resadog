"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";

function VerificationSentContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Envoi impossible.");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Envoi impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFbf7] px-5 py-16 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[480px] rounded-[2rem] border border-orange-100 bg-white p-8 text-center shadow-xl sm:p-10">
        <MailCheck className="mx-auto h-14 w-14 text-orange-600" />
        <h1 className="mt-5 text-3xl font-extrabold text-gray-950">Vérifiez votre boîte mail</h1>
        <p className="mt-4 leading-7 text-gray-600">
          Nous avons envoyé un lien d'activation à <strong className="break-all text-gray-950">{email}</strong>.
          Il expire dans 24 heures.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Pensez à vérifier le dossier des courriers indésirables.
        </p>
        {message && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
        {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button
          type="button"
          disabled={loading || !email}
          onClick={resend}
          className="mt-7 h-12 w-full rounded-xl bg-gray-950 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "Envoi..." : "Renvoyer l'email"}
        </button>
        <Link href={callbackUrl !== "/dashboard" ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/signin"} className="mt-5 inline-block text-sm font-bold text-orange-700 hover:underline">
          Retour à la connexion
        </Link>
      </section>
    </main>
  );
}

export default function VerificationSentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <VerificationSentContent />
    </Suspense>
  );
}
