"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppNav } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    image: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (session?.user) {
      setFormData({
        name: session.user.name || "",
        email: session.user.email || "",
        phone: "", // À récupérer via API si stocké
        image: session.user.image || "",
      });
      fetchSubscription();
    }
  }, [status, session, router]);

  const fetchSubscription = async () => {
      try {
          const res = await fetch("/api/user/subscription");
          if (res.ok) {
              const data = await res.json();
              setSubscriptionData(data);
          }
      } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulation mise à jour (à connecter à une API réelle /api/user/profile)
    await new Promise(r => setTimeout(r, 1000));
    await update({ name: formData.name });
    setIsEditing(false);
    setIsLoading(false);
  };

  const formatMoney = (amount: number) =>
    amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const manageSubscription = async (action: "cancel_at_period_end" | "resume") => {
    setSubscriptionActionLoading(true);
    setSubscriptionMessage("");

    try {
      const res = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubscriptionMessage(data.error || "Impossible de modifier l'abonnement.");
        return;
      }

      setSubscriptionMessage(
        action === "cancel_at_period_end"
          ? "Résiliation programmée à la fin de la période payée."
          : "Résiliation annulée, votre abonnement continue."
      );
      await fetchSubscription();
    } catch (e) {
      setSubscriptionMessage("Erreur de connexion.");
    } finally {
      setSubscriptionActionLoading(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">👤</div>;

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-20">
      <AppNav userName={session?.user?.name} />

      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 pt-32 max-w-4xl relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center md:text-left"
        >
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Mon Profil 👤</h1>
          <p className="text-gray-500 text-lg">Gérez vos informations personnelles</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Carte Identité (Gauche) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-1"
          >
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border border-gray-100 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-orange-400 to-amber-500" />
              
              <div className="relative mt-8 mb-4">
                <div className="w-32 h-32 mx-auto bg-white p-1 rounded-full shadow-xl">
                  {formData.image ? (
                    <img src={formData.image} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-orange-100 flex items-center justify-center text-4xl font-bold text-orange-600">
                      {formData.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {isEditing && (
                  <button className="absolute bottom-0 right-1/2 translate-x-12 bg-gray-900 text-white p-2 rounded-full shadow-lg hover:bg-orange-600 transition-colors text-xs">
                    📷
                  </button>
                )}
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-1">{formData.name}</h2>
              <p className="text-gray-500 text-sm mb-6">{formData.email}</p>

              <div className="flex justify-center gap-2 flex-wrap">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                  Client Vérifié
                </span>
                {subscriptionData?.subscription && (
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                    <span>⚡</span> Membre Club
                    </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Formulaire & Abo (Droite) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-2 space-y-8"
          >
            {/* Infos Perso */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-gray-100">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-gray-900">Informations</h3>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl">
                    Modifier
                  </Button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Nom complet</Label>
                    <Input 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      disabled={!isEditing}
                      className="bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      value={formData.email} 
                      disabled={true} // Email souvent non modifiable
                      className="bg-gray-100 border-gray-200 h-12 rounded-xl text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input 
                      value={formData.phone} 
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      disabled={!isEditing}
                      placeholder="+33 6..."
                      className="bg-gray-50 border-gray-200 h-12 rounded-xl focus:ring-orange-500"
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                    <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="h-12 rounded-xl">
                      Annuler
                    </Button>
                    <Button type="submit" disabled={isLoading} className="bg-gray-900 hover:bg-orange-600 text-white h-12 rounded-xl px-8 shadow-lg">
                      {isLoading ? "Enregistrement..." : "Sauvegarder"}
                    </Button>
                  </div>
                )}
              </form>
            </div>

            {/* Section Abonnement */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-gray-700 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 relative z-10">
                    <div>
                        <h3 className="text-xl font-bold mb-2">Mon Abonnement</h3>
                        {subscriptionData?.subscription ? (
                            <div className="space-y-1">
                                <p className="text-orange-400 font-medium">Formule {subscriptionData.subscription.serviceType === "DOG_WALKING" ? "Promenade" : "Garderie"}</p>
                                <p className="text-sm text-gray-400">
                                    {subscriptionData.subscription.daysPerWeek} jours/semaine • {subscriptionData.subscription.creditsPerMonth} crédits/mois
                                </p>
                                <p className="text-sm text-gray-400">
                                    Montant : {formatMoney(subscriptionData.subscription.price)}€ / {subscriptionData.subscription.billingPeriod === "YEARLY" ? "an" : "mois"}
                                </p>
                                <p className="text-sm text-gray-400">
                                    Statut : {subscriptionData.subscription.status === 'ACTIVE' 
                                        ? (subscriptionData.cancelAtPeriodEnd ? "Résiliation demandée" : "Actif") 
                                        : subscriptionData.subscription.status}
                                </p>
                                {subscriptionData.currentPeriodEnd && (
                                    <p className="text-sm text-gray-400">
                                        {subscriptionData.cancelAtPeriodEnd ? "Prend fin le" : "Prochain renouvellement le"} : {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString("fr-FR")}
                                    </p>
                                )}
                                {subscriptionData.commitmentEndsAt && new Date(subscriptionData.commitmentEndsAt) > new Date() && (
                                    <p className="text-xs text-orange-300 mt-1 font-semibold">
                                        🔒 Engagement jusqu'au {new Date(subscriptionData.commitmentEndsAt).toLocaleDateString("fr-FR")}
                                    </p>
                                )}
                                {subscriptionData.cancelAtPeriodEnd && (
                                    <p className="text-xs text-yellow-200 mt-2 font-semibold">
                                        Votre abonnement restera actif jusqu'à la date de fin. Les crédits déjà acquis restent utilisables.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm max-w-md">
                                Vous n'avez pas encore d'abonnement actif. Rejoignez le club pour économiser sur vos gardes !
                            </p>
                        )}
                    </div>
                    {subscriptionData?.subscription ? (
                        <div className={`${subscriptionData.cancelAtPeriodEnd ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"} px-3 py-1 rounded-full text-xs font-bold border`}>
                            {subscriptionData.cancelAtPeriodEnd ? "FIN PROGRAMMÉE" : "ACTIF"}
                        </div>
                    ) : (
                        <div className="bg-white/10 text-gray-400 px-3 py-1 rounded-full text-xs font-bold">
                            INACTIF
                        </div>
                    )}
                </div>

                {subscriptionMessage && (
                    <div className="relative z-10 mt-6 bg-white/10 border border-white/10 rounded-2xl p-4 text-sm text-orange-100">
                        {subscriptionMessage}
                    </div>
                )}

                <div className="relative z-10 mt-8 grid gap-4 md:grid-cols-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Résiliation</p>
                        <p className="text-sm text-gray-300">
                            {subscriptionData?.isLocked
                                ? "Disponible après la période d'engagement."
                                : "Se programme à la fin de la période payée, jamais en coupure immédiate."}
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Factures</p>
                        <p className="text-sm text-gray-300">
                            Les dernières factures sont listées ici et restent aussi accessibles via Stripe.
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Crédits</p>
                        <p className="text-sm text-gray-300">
                            Les crédits obtenus restent utilisables, même après une résiliation à échéance.
                        </p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-4 relative z-10">
                    {subscriptionData?.subscription ? (
                        <>
                            <Button onClick={() => router.push('/subscriptions')} className="bg-orange-500 hover:bg-orange-600 text-white h-12 rounded-xl px-6 font-bold">
                                Changer de formule
                            </Button>
                            {subscriptionData.cancelAtPeriodEnd ? (
                                <Button
                                  onClick={() => manageSubscription("resume")}
                                  disabled={subscriptionActionLoading}
                                  className="bg-green-500 hover:bg-green-600 text-white h-12 rounded-xl px-6 font-bold"
                                >
                                  Garder mon abonnement
                                </Button>
                            ) : (
                                <Button
                                  onClick={() => manageSubscription("cancel_at_period_end")}
                                  disabled={subscriptionActionLoading || subscriptionData.isLocked}
                                  variant="outline"
                                  className="bg-transparent border-white/20 text-white hover:bg-white/10 h-12 rounded-xl px-6 font-bold"
                                >
                                  Résilier à échéance
                                </Button>
                            )}
                            {subscriptionData.portalUrl && (
                                <a href={subscriptionData.portalUrl} className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors">
                                    Moyen de paiement Stripe
                                </a>
                            )}
                        </>
                    ) : (
                        <Button onClick={() => router.push('/subscriptions')} className="bg-orange-500 hover:bg-orange-600 text-white h-12 rounded-xl px-6 font-bold">
                            Découvrir les offres
                        </Button>
                    )}
                </div>

                {subscriptionData?.invoices?.length > 0 && (
                    <div className="relative z-10 mt-8 pt-6 border-t border-white/10">
                        <h4 className="font-bold mb-4">Dernières factures</h4>
                        <div className="space-y-3">
                            {subscriptionData.invoices.map((invoice: any) => (
                                <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <div>
                                        <p className="font-bold text-sm">{invoice.number || "Facture Stripe"}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(invoice.createdAt).toLocaleDateString("fr-FR")} • {invoice.status}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold">{formatMoney(invoice.amountPaid || invoice.amountDue)}€</span>
                                        {invoice.hostedInvoiceUrl && (
                                            <a href={invoice.hostedInvoiceUrl} className="text-sm font-bold text-orange-300 hover:text-orange-200">
                                                Voir
                                            </a>
                                        )}
                                        {invoice.invoicePdf && (
                                            <a href={invoice.invoicePdf} className="text-sm font-bold text-orange-300 hover:text-orange-200">
                                                PDF
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

          </motion.div>

        </div>
      </div>
    </div>
  );
}
