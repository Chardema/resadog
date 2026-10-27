import Link from "next/link";
import { PawPrint } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FDFbf7] px-6 py-20 font-sans selection:bg-orange-200">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-700">
          <PawPrint className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-3 text-sm font-bold text-emerald-800">Erreur 404</p>
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Oups, cette page s&apos;est égarée
        </h1>
        <p className="mb-10 text-lg leading-relaxed text-gray-600">
          La page que vous cherchez n&apos;existe pas ou a été déplacée. Retournez à l&apos;accueil ou réservez directement votre séjour.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="flex items-center justify-center rounded-2xl bg-orange-700 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/30 transition-all hover:bg-orange-800"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/booking"
            className="flex items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white px-8 py-4 text-lg font-bold text-emerald-800 transition-all hover:bg-emerald-50"
          >
            Réserver un séjour
          </Link>
        </div>
      </div>
    </main>
  );
}
