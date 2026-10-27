import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/protected-page";
import { SecuritySettings } from "./SecuritySettings";

export default async function SecurityPage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="mx-auto max-w-3xl px-4 pt-28 sm:px-6 md:pt-32">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-orange-700">
          <ArrowLeft className="h-4 w-4" /> Retour au profil
        </Link>
        <header className="mb-7 mt-5">
          <h1 className="text-3xl font-extrabold text-gray-950">Sécurité du compte</h1>
          <p className="mt-2 leading-7 text-gray-600">
            Gérez la double authentification et vos méthodes de connexion.
          </p>
        </header>
        <SecuritySettings />
      </main>
    </div>
  );
}
