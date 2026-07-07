"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Home,
  LoaderCircle,
  Minus,
  PawPrint,
  Plus,
  ShieldCheck,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import {
  calculateSubscriptionPlan,
  SUBSCRIPTION_SERVICES,
  type SubscriptionServiceType,
} from "@/lib/subscription-pricing";

type ServiceType = SubscriptionServiceType;
type BillingCycle = "MONTHLY" | "YEARLY";

type ExistingSubscription = {
  status: string;
  billingPeriod: BillingCycle;
  serviceType: ServiceType;
  daysPerWeek: number;
  creditsPerMonth: number;
  petCount: number;
};

const formatMoney = (amount: number) =>
  amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const serviceOptions: Array<{ value: ServiceType; icon: LucideIcon }> = [
  { value: "BOARDING", icon: Home },
  { value: "HOUSE_SITTING", icon: ShieldCheck },
  { value: "DAY_CARE", icon: Sun },
  { value: "DROP_IN", icon: CalendarClock },
  { value: "DOG_WALKING", icon: PawPrint },
];

export default function SubscriptionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceType>("DOG_WALKING");
  const [daysPerWeek, setDaysPerWeek] = useState(2);
  const [petCount, setPetCount] = useState(1);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [loading, setLoading] = useState(false);
  const [existingSubscription, setExistingSubscription] = useState<ExistingSubscription | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [cancellationScheduled, setCancellationScheduled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;

    const controller = new AbortController();
    const loadSubscription = async () => {
      try {
        const response = await fetch("/api/user/subscription", { signal: controller.signal });
        const result = await response.json();
        if (result.subscription?.status === "ACTIVE") {
          setExistingSubscription(result.subscription);
          setCancellationScheduled(Boolean(result.cancelAtPeriodEnd));
          setServiceType(result.subscription.serviceType);
          setDaysPerWeek(result.subscription.daysPerWeek);
          setPetCount(result.subscription.petCount || 1);
          setBillingCycle(result.subscription.billingPeriod);
        }
      } catch {
        if (!controller.signal.aborted) setError("Impossible de charger votre abonnement.");
      } finally {
        if (!controller.signal.aborted) setSubscriptionLoaded(true);
      }
    };

    loadSubscription();
    return () => controller.abort();
  }, [status]);

  const plan = calculateSubscriptionPlan({ serviceType, daysPerWeek, petCount, billingCycle });
  const billingChangeBlocked = Boolean(
    existingSubscription && existingSubscription.billingPeriod !== billingCycle
  );
  const subscriptionLoading = status === "authenticated" && !subscriptionLoaded;
  const savings = Math.max(0, plan.publicMonthlyPrice - plan.monthlyPrice);

  const handleSubscribe = async () => {
    if (!session) {
      router.push("/auth/signin?callbackUrl=/subscriptions");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType, daysPerWeek, petCount, billingCycle }),
      });
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

  const updateNumber = (value: number, delta: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value + delta));

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12">
      <AppNav userName={session?.user?.name} />

      <main className={`mx-auto max-w-5xl px-4 sm:px-6 ${session ? "pt-6 md:pt-32" : "pt-24 md:pt-32"}`}>
        <header className="mb-6 max-w-2xl">
          <p className="text-sm font-bold text-orange-700">Club La Meute</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950 sm:text-4xl">Une formule adaptée à votre rythme</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            Des crédits pour chaque service, avec un prix clair avant paiement.
          </p>
        </header>

        {existingSubscription && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">
                {cancellationScheduled ? "Une fin d'abonnement est déjà programmée" : "Vous avez déjà un abonnement actif"}
              </p>
              <p className="mt-1 text-sm leading-6">
                {cancellationScheduled
                  ? "Annulez d'abord la résiliation depuis votre profil pour modifier la formule."
                  : "Les modifications de service s'appliquent au prochain renouvellement, sans débit immédiat."}
              </p>
              <Link href="/profile#subscription" className="mt-2 inline-flex min-h-10 items-center text-sm font-bold underline underline-offset-4">
                Gérer mon abonnement
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1" aria-label="Période de facturation">
          <button
            type="button"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`min-h-11 rounded-md px-3 text-sm font-bold ${
              billingCycle === "MONTHLY" ? "bg-gray-950 text-white" : "text-gray-600"
            }`}
            aria-pressed={billingCycle === "MONTHLY"}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("YEARLY")}
            className={`min-h-11 rounded-md px-3 text-sm font-bold ${
              billingCycle === "YEARLY" ? "bg-gray-950 text-white" : "text-gray-600"
            }`}
            aria-pressed={billingCycle === "YEARLY"}
          >
            Annuel
          </button>
        </div>
        <p className="-mt-2 mb-5 text-center text-xs font-medium text-gray-500">
          {billingCycle === "YEARLY" ? "Paiement unique pour 12 mois" : "Engagement initial de 2 mois"}
        </p>

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Service</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {serviceOptions.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setServiceType(value)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-bold ${
                      serviceType === value
                        ? "border-orange-600 bg-orange-50 text-orange-800"
                        : "border-gray-200 text-gray-700"
                    }`}
                    aria-pressed={serviceType === value}
                  >
                    <Icon className="h-5 w-5" />
                    {SUBSCRIPTION_SERVICES[value].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-950">Nombre d’animaux</h2>
                  <p className="mt-1 text-sm text-gray-500">De 1 à 3 animaux</p>
                </div>
                <div className="flex items-center gap-2" aria-label={`${petCount} animaux`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPetCount(updateNumber(petCount, -1, 1, 3))}
                    disabled={petCount === 1}
                    aria-label="Retirer un animal"
                    className="border-gray-300"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-xl font-bold text-gray-950">{petCount}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPetCount(updateNumber(petCount, 1, 1, 3))}
                    disabled={petCount === 3}
                    aria-label="Ajouter un animal"
                    className="border-gray-300"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-950">Rythme hebdomadaire</h2>
                  <p className="mt-1 text-sm text-gray-500">{plan.creditsPerMonth} crédits chaque mois</p>
                </div>
                <div className="flex items-center gap-2" aria-label={`${daysPerWeek} utilisations par semaine`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDaysPerWeek(updateNumber(daysPerWeek, -1, 1, 5))}
                    disabled={daysPerWeek === 1}
                    aria-label="Retirer une utilisation"
                    className="border-gray-300"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-xl font-bold text-gray-950">{daysPerWeek}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDaysPerWeek(updateNumber(daysPerWeek, 1, 1, 5))}
                    disabled={daysPerWeek === 5}
                    aria-label="Ajouter une utilisation"
                    className="border-gray-300"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-white lg:sticky lg:top-28">
            <div className="p-5 sm:p-6">
              <p className="text-xs font-bold uppercase text-orange-300">
                {billingCycle === "YEARLY" ? "Paiement annuel" : "Paiement mensuel"}
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {plan.service.label} · {petCount} {petCount > 1 ? "animaux" : "animal"}
              </h2>

              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-bold sm:text-5xl">{formatMoney(plan.monthlyPrice)} €</span>
                <span className="pb-1 text-sm text-gray-400">/mois</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                {billingCycle === "YEARLY"
                  ? `${formatMoney(plan.amountDueNow)} € prélevés aujourd’hui pour 12 mois.`
                  : `${formatMoney(plan.amountDueNow)} € prélevés aujourd’hui, puis chaque mois.`}
              </p>
            </div>

            <div className="border-y border-white/10 bg-white/5 px-5 py-4 sm:px-6">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400">Crédits inclus</span>
                <span className="font-bold">{billingCycle === "YEARLY" ? plan.creditsPerMonth * 12 : plan.creditsPerMonth}</span>
              </div>
              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-gray-400">Prix par crédit</span>
                <span className="font-bold">{formatMoney(plan.effectiveCreditPrice)} €</span>
              </div>
              <div className="mt-3 flex justify-between gap-4 text-sm text-emerald-300">
                <span>Économie mensuelle</span>
                <span className="font-bold">{formatMoney(savings)} €</span>
              </div>
            </div>

            <ul className="space-y-3 p-5 text-sm text-gray-300 sm:p-6">
              <li className="flex gap-3"><Check className="h-5 w-5 shrink-0 text-emerald-400" /> Crédits sans date d’expiration</li>
              <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" /> Paiement sécurisé par Stripe</li>
              <li className="flex gap-3"><CalendarClock className="h-5 w-5 shrink-0 text-emerald-400" /> Résiliation programmable dès l’inscription</li>
            </ul>

            {billingChangeBlocked && (
              <div className="mx-5 mb-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100 sm:mx-6">
                Le changement mensuel/annuel sera disponible à la fin de la période déjà payée.
              </div>
            )}
            {cancellationScheduled && (
              <div className="mx-5 mb-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100 sm:mx-6">
                Annulez la résiliation programmée depuis votre profil avant de changer de formule.
              </div>
            )}

            <div className="border-t border-white/10 p-5 sm:p-6">
              <Button
                type="button"
                onClick={handleSubscribe}
                disabled={loading || subscriptionLoading || billingChangeBlocked || cancellationScheduled}
                className="h-12 w-full bg-white text-base font-bold text-gray-950 hover:bg-orange-50"
              >
                {loading || subscriptionLoading ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    {loading ? "Préparation" : "Chargement de votre formule"}
                  </>
                ) : (
                  <>
                    {existingSubscription ? "Enregistrer la formule" : "Continuer vers le paiement"}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-gray-400">
                Le montant et la fréquence sont confirmés une dernière fois avant paiement.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
