"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/layout/AppNav";
import { useSession } from "next-auth/react";

export default function ConceptPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[#FDFbf7] selection:bg-orange-200">
      <AppNav userName={session?.user?.name} />

      {/* Decorative Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-orange-300/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-yellow-200/20 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 pt-32 pb-24 container mx-auto px-6">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full font-bold text-sm mb-6"
          >
            🚀 Nouveau : Le Club La Meute
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight"
          >
            Plus de liberté,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
              moins de dépenses.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto"
          >
            Découvrez notre système d'abonnement par crédits. Fini les paiements à chaque réservation, profitez d'un tarif préférentiel toute l'année.
          </motion.p>
        </div>

        {/* How it works - Steps */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {[
            {
              icon: "💳",
              title: "1. Choisissez votre formule",
              desc: "Définissez votre rythme (ex: 2 promenades par semaine) et obtenez votre pack de crédits mensuel."
            },
            {
              icon: "🪙",
              title: "2. Recevez vos crédits",
              desc: "Chaque mois, vos crédits sont ajoutés à votre compte. 1 Crédit = 1 Jour de garde ou 1 Promenade."
            },
            {
              icon: "📅",
              title: "3. Réservez en 1 clic",
              desc: "Utilisez vos crédits pour réserver quand vous voulez. Plus besoin de sortir la carte bancaire !"
            }
          ].map((step, idx) => (
            <motion.div
              key={idx}
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
              <p className="text-gray-600 leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-gray-900 text-white rounded-[3rem] p-8 md:p-16 mb-24 relative overflow-hidden"
        >
          {/* Background FX */}
          <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] bg-orange-600/20 rounded-full blur-[150px]" />

          <div className="relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Pourquoi passer au Club ?</h2>
              <p className="text-gray-400">Comparatif garderie 2 jours / semaine (1 chien)</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Classique */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                <h3 className="text-xl font-bold text-gray-400 mb-6">Client Classique</h3>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Prix par jour (chien)</span>
                    <span className="font-mono">23€</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300">
                    <span>8 jours / mois</span>
                    <span className="font-mono">184€</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Paiement</span>
                    <span>À chaque résa</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Annulation</span>
                    <span>48h avant</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total mensuel</span>
                    <span className="text-2xl font-bold">184€</span>
                  </div>
                </div>
              </div>

              {/* Club */}
              <div className="bg-gradient-to-b from-orange-500 to-amber-600 rounded-3xl p-8 shadow-2xl transform md:scale-105 border border-orange-400 relative">
                <div className="absolute top-4 right-4 bg-white text-orange-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Recommandé
                </div>
                <h3 className="text-xl font-bold text-white mb-6">Membre La Meute</h3>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-orange-100">
                    <span>Prix par jour</span>
                    <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded">~19€</span>
                  </div>
                  <div className="flex justify-between items-center text-orange-100">
                    <span>Paiement</span>
                    <span>Automatique</span>
                  </div>
                  <div className="flex justify-between items-center text-orange-100">
                    <span>Crédits reportables</span>
                    <span>Illimité</span>
                  </div>
                  <div className="flex justify-between items-center text-orange-100">
                    <span>Supplément jeune animal</span>
                    <span className="font-bold bg-white text-orange-600 px-2 py-0.5 rounded">OFFERT</span>
                  </div>
                  <div className="flex justify-between items-center text-orange-100">
                    <span>Tarif chat</span>
                    <span>Dès 12€/visite</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-100">Total mensuel</span>
                    <span className="text-3xl font-extrabold">~149€</span>
                  </div>
                  <div className="mt-2 text-right text-xs font-bold text-white/80">
                    Économisez jusqu'à 420€ / an ! 💰
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-24">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              { q: "Est-ce que je peux annuler quand je veux ?", a: "Oui ! L'abonnement mensuel est sans engagement au-delà des 2 premiers mois. L'annuel vous engage sur 12 mois en échange d'un tarif imbattable." },
              { q: "Si je pars en vacances ?", a: "Pas de panique ! Vos crédits sont valables à vie ! Vous pouvez les cumuler pour une plus grosse garde le mois suivant." },
              { q: "Ça marche pour plusieurs animaux ?", a: "Absolument. Vous pouvez prendre un abonnement 'Multi-animaux' et utiliser vos crédits indifféremment." },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h4 className="font-bold text-gray-900 mb-2">{faq.q}</h4>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Prêt à rejoindre la meute ?</h2>
          <Link href="/subscriptions">
            <Button className="h-16 px-10 rounded-full bg-gray-900 text-white font-bold text-xl hover:bg-orange-600 hover:scale-105 transition-all shadow-xl">
              Configurer mon abonnement →
            </Button>
          </Link>
          <p className="mt-4 text-sm text-gray-500">2 minutes pour s'inscrire, des heures de bonheur pour votre compagnon.</p>
        </div>

      </main>
    </div>
  );
}
