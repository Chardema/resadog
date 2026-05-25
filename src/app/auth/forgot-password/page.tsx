import Link from "next/link";

const supportEmail = process.env.ADMIN_EMAIL || "meganemelique36@gmail.com";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#FDFbf7] flex items-center justify-center p-6">
      <section className="w-full max-w-[460px] bg-white/90 rounded-[2rem] shadow-2xl shadow-orange-900/10 border border-orange-100 p-8 sm:p-10 text-center">
        <Link href="/" className="inline-flex mb-6">
          <span className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg">
            🐾
          </span>
        </Link>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
          Mot de passe oublié ?
        </h1>
        <p className="text-gray-600 leading-relaxed mb-8">
          La réinitialisation automatique arrive bientôt. En attendant, envoyez
          un message avec l&apos;adresse email de votre compte pour récupérer
          l&apos;accès rapidement.
        </p>

        <div className="grid gap-3">
          <a
            href={`mailto:${supportEmail}?subject=Mot%20de%20passe%20oublie%20-%20La%20Patte%20Doree`}
            className="h-12 rounded-xl bg-gray-900 hover:bg-orange-600 text-white font-bold inline-flex items-center justify-center transition-colors"
          >
            Contacter La Patte Dorée
          </a>
          <Link
            href="/auth/signin"
            className="h-12 rounded-xl border border-gray-200 hover:border-orange-200 hover:bg-orange-50 text-gray-700 font-bold inline-flex items-center justify-center transition-colors"
          >
            Retour à la connexion
          </Link>
        </div>
      </section>
    </main>
  );
}
