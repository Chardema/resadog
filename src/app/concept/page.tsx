"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PREMIUM_SUBSCRIPTION } from "@/lib/subscription-pricing";
import { LOYALTY_REWARDS } from "@/lib/loyalty";

export default function ConceptPage() {

  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200">

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-orange-300/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-yellow-200/20 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 pt-32 pb-24 container mx-auto px-6">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full font-bold text-sm mb-6"
          >
            Nouveau : Premium et fidélité
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight"
          >
            Des récompenses claires,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
              faciles à suivre.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto"
          >
            Tous les clients gagnent des Pattes à chaque réservation. Premium ajoute une remise automatique, les Pattes doublées et des avantages de confort.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {[
            {
              icon: "🐾",
              title: "1. Réservez",
              desc: "Chaque euro dépensé rapporte 1 Patte dans le programme gratuit."
            },
            {
              icon: "🏅",
              title: "2. Montez de niveau",
              desc: "Bronze, Argent, Or puis Diamant : votre statut progresse automatiquement."
            },
            {
              icon: "🎁",
              title: "3. Débloquez des récompenses",
              desc: "300 Pattes donnent 5 €, 700 Pattes donnent 15 € et 1500 Pattes donnent 24 € de réduction."
            }
          ].map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              whileHover={{ y: -10 }}
              className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-orange-100/50 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-6xl mb-6 bg-orange-50 w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner">
                {step.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-600 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-gray-900 text-white rounded-[3rem] p-8 md:p-16 mb-24 relative overflow-hidden"
        >
          <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] bg-orange-600/20 rounded-full blur-[150px]" />

          <div className="relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Gratuit ou Premium ?</h2>
              <p className="text-gray-400">Le programme fidélité reste inclus pour tous les clients.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                <h3 className="text-xl font-bold text-gray-400 mb-6">Fidélité gratuite</h3>
                <div className="space-y-4 mb-8 text-gray-300">
                  <div className="flex justify-between gap-4"><span>Pattes gagnées</span><span className="font-bold">1 euro = 1 Patte</span></div>
                  <div className="flex justify-between gap-4"><span>Niveaux</span><span>Bronze à Diamant</span></div>
                  <div className="space-y-2">
                    <p className="font-bold text-white">Récompenses</p>
                    {LOYALTY_REWARDS.map((reward) => (
                      <div key={reward.threshold} className="flex justify-between gap-4 text-sm">
                        <span>{reward.threshold} Pattes</span>
                        <span>{reward.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between gap-4"><span>Prix</span><span>0 euro</span></div>
                </div>
              </div>

              <div className="bg-gradient-to-b from-orange-500 to-amber-600 rounded-3xl p-8 shadow-2xl transform md:scale-105 border border-orange-400 relative">
                <div className="absolute top-4 right-4 bg-white text-orange-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Premium
                </div>
                <h3 className="text-xl font-bold text-white mb-6">{PREMIUM_SUBSCRIPTION.name}</h3>
                <div className="space-y-4 mb-8 text-orange-100">
                  <div className="flex justify-between gap-4"><span>Remise</span><span className="font-bold">-10% jusqu’à 20 €</span></div>
                  <div className="flex justify-between gap-4"><span>Pattes gagnées</span><span className="font-bold">1 euro = 2 Pattes</span></div>
                  <div className="flex justify-between gap-4"><span>Priorité vacances</span><span>Incluse</span></div>
                  <div className="flex justify-between gap-4"><span>Report</span><span>Prioritaire au moins 24h avant</span></div>
                </div>
                <div className="pt-6 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-100">Prix mensuel</span>
                    <span className="text-3xl font-extrabold">{PREMIUM_SUBSCRIPTION.monthlyPrice.toFixed(2).replace(".", ",")}€</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="max-w-3xl mx-auto mb-24">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              { q: "Est-ce que le programme fidélité est payant ?", a: "Non. Tous les clients gagnent des Pattes automatiquement à chaque réservation." },
              { q: "Que donne Premium ?", a: "Premium donne -10% jusqu’à 20 € par réservation, sans cumul avec une autre remise, les Pattes doublées, la priorité vacances, une demande de report prioritaire au moins 24h avant sous réserve de disponibilité, et le badge Premium." },
              { q: "Que deviennent mes Pattes si j’arrête Premium ?", a: "Elles restent dans votre espace client. Seuls les avantages Premium s’arrêtent." },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h4 className="font-bold text-gray-900 mb-2">{faq.q}</h4>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Prêt à passer Premium ?</h2>
          <Link href="/subscriptions">
            <Button className="h-16 px-10 rounded-full bg-gray-900 text-white font-bold text-xl hover:bg-orange-600 hover:scale-105 transition-all shadow-xl">
              Voir Premium
            </Button>
          </Link>
          <Link href="/tarifs" className="mt-4 block text-sm font-bold text-orange-700 underline underline-offset-4">
            Consulter tous les tarifs
          </Link>
          <p className="mt-4 text-sm text-gray-500">Le programme fidélité gratuit reste actif quoi qu&apos;il arrive.</p>
        </div>
      </main>
    </div>
  );
}
