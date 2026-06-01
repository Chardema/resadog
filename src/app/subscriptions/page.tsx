"use client";

import { useState, useEffect } from "react";
import { AppNav } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { calculateSubscriptionPlan } from "@/lib/subscription-pricing";

export default function SubscriptionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [serviceType, setServiceType] = useState<"DOG_WALKING" | "DAY_CARE">("DOG_WALKING");
  const [daysPerWeek, setDaysPerWeek] = useState(2);
  const [petCount, setPetCount] = useState(1);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loading, setLoading] = useState(false);
  const [existingSubscription, setExistingSubscription] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
      if (session) {
          fetch("/api/user/subscription")
            .then(res => res.json())
            .then(data => {
                if (data.subscription && data.subscription.status === 'ACTIVE') {
                    setExistingSubscription(data.subscription);
                }
            });
      }
  }, [session]);

  const plan = calculateSubscriptionPlan({
    serviceType,
    daysPerWeek,
    petCount,
    billingCycle,
  });
  const billingChangeBlocked =
    existingSubscription && existingSubscription.billingPeriod !== billingCycle;
  const formatMoney = (amount: number) =>
    amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubscribe = async () => {
    if (!session) {
      router.push("/auth/signin?callbackUrl=/subscriptions");
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType, daysPerWeek, petCount, billingCycle }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Erreur lors de la création de l'abonnement");
      }
    } catch (e) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />
      
      <div className="container mx-auto px-6 pt-32 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            Abonnements <span className="text-orange-600">La Meute</span> 🐺
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Rejoignez le club et profitez de tarifs exclusifs toute l'année.
          </p>
        </motion.div>

        {existingSubscription && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-5 mb-8 rounded-2xl shadow-sm">
                <div>
                    <p className="font-bold">Vous êtes déjà membre du club ! ⚡</p>
                    <p className="text-sm mt-1">Vous pouvez ajuster le service, les jours et le nombre d'animaux sans débit immédiat. La nouvelle formule s'appliquera au prochain renouvellement.</p>
                </div>
            </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-8 rounded-2xl text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm flex relative">
            <motion.div 
              className="absolute top-1 bottom-1 bg-gray-900 rounded-full shadow-md z-0"
              initial={false}
              animate={{ 
                x: billingCycle === "MONTHLY" ? 0 : "100%", 
                width: "50%" 
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <button
              onClick={() => setBillingCycle("MONTHLY")}
              className={`relative z-10 px-6 py-2 rounded-full text-sm font-bold transition-colors ${billingCycle === "MONTHLY" ? "text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle("YEARLY")}
              className={`relative z-10 px-6 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${billingCycle === "YEARLY" ? "text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              Annuel <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-12 items-start">
          {/* Configurator */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="space-y-8 bg-white p-4 sm:p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-gray-100"
          >
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">1. Quel service ?</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setServiceType("DOG_WALKING")}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${serviceType === "DOG_WALKING" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="text-3xl">🐾</span>
                  <span className="font-bold text-gray-700">Promenade</span>
                </button>
                <button
                  onClick={() => setServiceType("DAY_CARE")}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${serviceType === "DAY_CARE" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="text-3xl">☀️</span>
                  <span className="font-bold text-gray-700">Garderie</span>
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">2. Combien d'animaux ?</h3>
              <div className="flex gap-4">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => setPetCount(count)}
                    className={`flex-1 p-3 rounded-xl font-bold transition-all border-2 ${petCount === count ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-100 text-gray-500 hover:border-gray-300"}`}
                  >
                    {count} {count > 1 ? "Animaux" : "Animal"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">3. Jours par semaine ?</h3>
              <div className="flex justify-between bg-gray-100 p-2 rounded-2xl">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDaysPerWeek(d)}
                    className={`w-12 h-12 rounded-xl font-bold transition-all ${daysPerWeek === d ? "bg-white text-orange-600 shadow-md scale-110" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-gray-500 mt-3">
                Soit <strong>{plan.creditsPerMonth} crédits</strong> par mois
              </p>
            </div>
          </motion.div>

          {/* Pricing Card */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-[3rem] blur-xl opacity-20 transform rotate-3" />
            <div className="bg-gray-900 text-white p-5 sm:p-8 md:p-10 rounded-[2.5rem] relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 bg-white/10 w-32 h-32 rounded-full blur-2xl -mr-10 -mt-10" />
              
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                  <p className="text-orange-300 font-medium mb-1 uppercase text-xs tracking-wider">
                    {billingCycle === "YEARLY" ? "Paiement Annuel" : "Paiement Mensuel"}
                  </p>
                  <h2 className="text-2xl font-bold">{serviceType === "DOG_WALKING" ? "Promenade" : "Garderie"} x{petCount}</h2>
                  <p className="text-gray-400 text-sm">{daysPerWeek} jours / semaine</p>
                </div>
                {billingCycle === "YEARLY" && (
                  <div className="bg-white/10 text-orange-200 px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                    Annuel
                  </div>
                )}
              </div>

              <div className="mb-8 relative z-10">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-extrabold">{formatMoney(plan.monthlyPrice)}€</span>
                  <span className="text-gray-400">/ mois</span>
                </div>
                
                {billingCycle === "YEARLY" ? (
                  <div className="mt-2 text-sm text-gray-400">
                    Facturé {formatMoney(plan.amountDueNow)}€ aujourd'hui pour 12 mois
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-400">
                    Facturé {formatMoney(plan.amountDueNow)}€ aujourd'hui puis chaque mois
                  </div>
                )}

                <div className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-sm">Prix public sans abonnement</span>
                    <span className="font-bold">{formatMoney(plan.publicMonthlyPrice)}€ / mois</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-sm">Prix par crédit</span>
                    <span className="font-bold">{formatMoney(plan.effectiveCreditPrice)}€</span>
                  </div>
                  <div className="flex justify-between items-center text-green-400">
                    <span className="text-sm font-bold">Remise réelle</span>
                    <span className="font-bold">-{Math.round(plan.effectiveDiscount * 100)}%</span>
                  </div>
                </div>
                {plan.guardApplied && (
                  <p className="mt-3 text-xs text-orange-200 bg-orange-500/10 border border-orange-400/20 rounded-xl p-3">
                    Prix plancher appliqué : cette formule ne descend jamais sous {formatMoney(plan.service.minimumCreditPrice)}€ par crédit.
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-10 text-gray-300 text-sm relative z-10">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">✓</span>
                  {plan.creditsPerMonth} crédits validité illimitée
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">✓</span>
                  Factures disponibles dans votre profil et dans Stripe
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">✓</span>
                  Résiliation à échéance après {billingCycle === "YEARLY" ? "12 mois" : "2 mois"}
                </li>
              </ul>

              {billingChangeBlocked && (
                <div className="mb-5 bg-yellow-400/10 border border-yellow-300/20 text-yellow-100 rounded-2xl p-4 text-sm">
                  Pour éviter une double facturation, le passage mensuel/annuel se fait à la fin de la période déjà payée.
                </div>
              )}

              <Button 
                onClick={handleSubscribe}
                disabled={loading || Boolean(billingChangeBlocked)}
                className="w-full h-16 rounded-2xl bg-white text-gray-900 font-bold text-lg hover:bg-orange-50 transition-colors shadow-lg relative z-10"
              >
                {loading ? "Traitement..." : (existingSubscription ? "Programmer la nouvelle formule" : (billingCycle === "YEARLY" ? "Payer l'année" : "M'abonner"))}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
