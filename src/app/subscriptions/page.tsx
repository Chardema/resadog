"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  LoaderCircle,
  PawPrint,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import { calculatePremiumSubscriptionPlan } from "@/lib/subscription-pricing";

const formatMoney = (amount: number) =>
  amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SubscriptionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState("");

  const plan = calculatePremiumSubscriptionPlan();

  useEffect(() => {
    if (status !== "authenticated") return;

    const controller = new AbortController();
    const loadSubscription = async () => {
      try {
        const response = await fetch("/api/user/subscription", { signal: controller.signal });
        const result = await response.json();
        setIsPremium(Boolean(result.premium?.isPremium));
      } catch {
        if (!controller.signal.aborted) setError("Impossible de charger votre statut Premium.");
      } finally {
        if (!controller.signal.aborted) setSubscriptionLoaded(true);
      }
    };

    loadSubscription();
    return () => controller.abort();
  }, [status]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handleSubscribe = async () => {
    if (!session) {
      router.push("/auth/signin?callbackUrl=/subscriptions");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/subscribe", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Impossible de préparer le paiement.");
      }
      window.location.assign(result.url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de connexion.");
      setLoading(false);
    }
  };

  const subscriptionLoading = status === "authenticated" && !subscriptionLoaded;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12">
      <AppNav userName={session?.user?.name} />

      <main className={`mx-auto max-w-5xl px-4 sm:px-6 ${session ? "pt-6 md:pt-32" : "pt-24 md:pt-32"}`}>
        <header className="mb-6 max-w-2xl">
          <p className="text-sm font-bold text-orange-700">Premium La Patte Dorée</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950 sm:text-4xl">Plus d&apos;avantages, tout simplement</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            Premium ajoute des avantages concrets à chaque réservation. Le programme de fidélité gratuit reste ouvert à tous.
          </p>
        </header>

        {isPremium && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">Votre abonnement Premium est actif</p>
              <p className="mt-1 text-sm leading-6">Vous bénéficiez déjà de la remise de 10 %, des Pattes doublées et du badge Premium.</p>
              <Link href="/profile#subscription" className="mt-2 inline-flex min-h-10 items-center text-sm font-bold underline underline-offset-4">
                Gérer Premium
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-950">Avantages Premium</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, title: "-10 %", text: "La remise s’applique automatiquement sur toutes les réservations." },
                { icon: PawPrint, title: "Pattes doublées", text: "1 euro dépensé rapporte 2 Pattes au lieu de 1." },
                { icon: CalendarClock, title: "Priorité vacances", text: "Vos demandes passent en priorité sur les périodes chargées." },
                { icon: BadgeCheck, title: "Badge Premium", text: "Votre statut est visible dans l’espace client." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <Icon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                  <p className="mt-3 font-bold text-gray-950">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-orange-100 bg-orange-50 p-4">
              <p className="font-bold text-orange-950">Fidélité gratuite incluse pour tous</p>
              <p className="mt-1 text-sm leading-6 text-orange-900">
                Sans Premium : 1 euro dépensé = 1 Patte. Avec Premium : 1 euro dépensé = 2 Pattes.
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-white lg:sticky lg:top-28">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-orange-300">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <p className="text-xs font-bold uppercase">Mensuel</p>
              </div>
              <h2 className="mt-2 text-xl font-bold">{plan.name}</h2>

              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-bold sm:text-5xl">{formatMoney(plan.monthlyPrice)} €</span>
                <span className="pb-1 text-sm text-gray-400">/mois</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                Les avantages s&apos;appliquent automatiquement à vos réservations.
              </p>
            </div>

            <ul className="space-y-3 border-y border-white/10 bg-white/5 p-5 text-sm text-gray-300 sm:p-6">
              {plan.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3">
                  <Check className="h-5 w-5 shrink-0 text-emerald-400" />
                  {benefit}
                </li>
              ))}
            </ul>

            <div className="p-5 sm:p-6">
              <Button
                type="button"
                onClick={handleSubscribe}
                disabled={loading || subscriptionLoading || isPremium}
                className="h-12 w-full bg-white text-base font-bold text-gray-950 hover:bg-orange-50"
              >
                {loading || subscriptionLoading ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    {loading ? "Préparation" : "Chargement"}
                  </>
                ) : isPremium ? (
                  "Premium actif"
                ) : (
                  <>
                    Activer Premium
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-gray-400">
                Paiement sécurisé par Stripe. Résiliation depuis votre profil.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
