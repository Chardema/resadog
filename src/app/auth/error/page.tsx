"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AuthErrorContent() {
  const error = useSearchParams().get("error");
  const accountLinkError = error === "OAuthAccountNotLinked";

  return (
    <main className="min-h-screen bg-[#FDFbf7] px-5 py-16 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[460px] rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
        <div className="text-5xl">🔐</div>
        <h1 className="mt-5 text-2xl font-extrabold text-gray-950">Connexion interrompue</h1>
        <p className="mt-4 leading-7 text-gray-600">
          {accountLinkError
            ? "Cette adresse est déjà associée à une autre méthode de connexion. Connectez-vous d'abord avec cette méthode."
            : "Le fournisseur d'identité n'a pas pu confirmer la connexion. Aucun accès n'a été accordé."}
        </p>
        <Link href="/auth/signin" className="mt-7 inline-flex h-12 items-center rounded-xl bg-gray-950 px-6 font-bold text-white hover:bg-orange-600">
          Revenir à la connexion
        </Link>
      </section>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7]" />}>
      <AuthErrorContent />
    </Suspense>
  );
}
