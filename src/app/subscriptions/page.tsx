"use client";

import { useState } from "react";
import { AppNav } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SubscriptionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [serviceType, setServiceType] = useState<"DOG_WALKING" | "DAY_CARE">("DOG_WALKING");
  const [daysPerWeek, setDaysPerWeek] = useState(2);
  const [petCount, setPetCount] = useState(1);

  // Prix de base (avant réduction) par animal
  const basePrices = {
    DOG_WALKING: 15, // Promenade
    DAY_CARE: 25,    // Garderie
  };

  // Calcul du prix mensuel (4 semaines)
  const calculatePrice = () => {
    const unitPrice = basePrices[serviceType];
    const totalDays = daysPerWeek * 4;
    const rawPrice = (unitPrice * totalDays) * petCount;
    
    // Réduction progressive : 10% pour 1-2 jours, 15% pour 3-4, 20% pour 5+
    let discount = 0.10;
    if (daysPerWeek >= 3) discount = 0.15;
    if (daysPerWeek >= 5) discount = 0.20;

    const finalPrice = rawPrice * (1 - discount);
    return {
      monthly: Math.round(finalPrice),
      perDay: (finalPrice / (totalDays * petCount)).toFixed(2), // Prix par jour par chien
      savings: Math.round(rawPrice - finalPrice),
      credits: totalDays * petCount // Total crédits (ex: 2 chiens x 8 jours = 16 crédits)
    };
  };

  const plan = calculatePrice();

  const handleSubscribe = () => {
    if (!session) {
      router.push("/auth/signin?callbackUrl=/subscriptions");
      return;
    }
    // TODO: Connecter à Stripe Subscription
    alert("Redirection vers le paiement de l'abonnement (Simulation)");
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
            Simplifiez-vous la vie. Choisissez vos jours, obtenez des crédits mensuels à prix réduit et réservez quand vous voulez.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Configurator */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="space-y-8 bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100"
          >
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">1. Quel service ?</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setServiceType("DOG_WALKING")}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${serviceType === "DOG_WALKING" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="text-3xl">🦮</span>
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
                    {count} {count > 1 ? "Chiens" : "Chien"}
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
                Soit <strong>{plan.credits} crédits</strong> par mois
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
            <div className="bg-gray-900 text-white p-10 rounded-[2.5rem] relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 bg-white/10 w-32 h-32 rounded-full blur-2xl -mr-10 -mt-10" />
              
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-orange-300 font-medium mb-1">Votre formule</p>
                  <h2 className="text-2xl font-bold">{serviceType === "DOG_WALKING" ? "Promenade" : "Garderie"} x{petCount}</h2>
                  <p className="text-gray-400 text-sm">{daysPerWeek} jours / semaine</p>
                </div>
                <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  -{Math.round((1 - (parseFloat(plan.perDay) / basePrices[serviceType])) * 100)}%
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-extrabold">{plan.monthly}€</span>
                  <span className="text-gray-400">/ mois</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Soit {plan.perDay}€ par jour/chien (au lieu de {basePrices[serviceType]}€)
                </p>
                <div className="mt-4 inline-block bg-white/10 px-4 py-2 rounded-xl text-green-400 font-bold text-sm">
                  Vous économisez {plan.savings}€ / mois 💰
                </div>
              </div>

              <ul className="space-y-4 mb-10 text-gray-300 text-sm">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">✓</span>
                  {plan.credits} crédits valables 2 mois
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">✓</span>
                  1 Crédit = 1 prestation pour 1 chien
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">✓</span>
                  Sans engagement, annulable à tout moment
                </li>
              </ul>

              <Button 
                onClick={handleSubscribe}
                className="w-full h-16 rounded-2xl bg-white text-gray-900 font-bold text-lg hover:bg-orange-50 transition-colors shadow-lg"
              >
                S'abonner maintenant ⚡
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}