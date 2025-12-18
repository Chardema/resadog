"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  autoApplyCoupon: Coupon | null;
  creditBatches: { remaining: number }[];
  stats: {
    totalBookings: number;
    completedBookings: number;
    totalSpent: number;
  };
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [selectedClientForVIP, setSelectedClientForVIP] = useState<string | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState("");
  
  // Gestion Crédits
  const [selectedClientForCredits, setSelectedClientForCredits] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");

  // Formulaire de création de coupon
  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discountType: "FIXED_AMOUNT" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, couponsRes] = await Promise.all([
        fetch("/api/admin/clients"),
        fetch("/api/admin/coupons"),
      ]);

      const clientsData = await clientsRes.json();
      const couponsData = await couponsRes.json();

      setClients(clientsData.clients || []);
      setCoupons(couponsData.coupons || []);
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponForm.code.toUpperCase(),
          description: couponForm.description,
          discountType: couponForm.discountType,
          discountValue: parseFloat(couponForm.discountValue),
        }),
      });

      if (response.ok) {
        setCouponForm({ code: "", description: "", discountType: "FIXED_AMOUNT", discountValue: "" });
        setShowCreateCoupon(false);
        loadData();
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const assignVIPCoupon = async (userId: string, couponId: string) => {
    try {
      const response = await fetch(`/api/admin/clients/${userId}/vip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId }),
      });

      if (response.ok) {
        setSelectedClientForVIP(null);
        setSelectedCoupon("");
        loadData();
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const removeVIPStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/clients/${userId}/vip`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleUpdateCredits = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedClientForCredits || !creditAmount) return;

      try {
          const res = await fetch(`/api/admin/clients/${selectedClientForCredits}/credits`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: parseInt(creditAmount) })
          });
          if (res.ok) {
              setSelectedClientForCredits(null);
              setCreditAmount("");
              loadData();
          } else {
              alert("Erreur");
          }
      } catch (e) { alert("Erreur"); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <DashboardNav />
        <div className="container mx-auto px-6 py-12">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🐾</div>
            <p className="text-gray-700 font-semibold">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <DashboardNav />

      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
            Gestion des Clients & VIP 👑
          </h1>
          <p className="text-gray-700 text-lg">
            Gérez les codes promo, les statuts VIP et les crédits d'abonnement.
          </p>
        </motion.div>

        {/* Section Codes Promo */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Codes Promo Disponibles</h2>
            <Button
              onClick={() => setShowCreateCoupon(!showCreateCoupon)}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {showCreateCoupon ? "Annuler" : "+ Créer un code promo"}
            </Button>
          </div>

          {showCreateCoupon && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-white rounded-2xl p-6 border-2 border-purple-200 mb-6"
            >
              <form onSubmit={createCoupon} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Code *</Label>
                    <Input
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      placeholder="VIP2024"
                      required
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label>Type de réduction *</Label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as any })}
                      className="w-full h-10 border-2 border-gray-200 rounded-lg px-3"
                    >
                      <option value="FIXED_AMOUNT">Montant fixe (€)</option>
                      <option value="PERCENTAGE">Pourcentage (%)</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Valeur *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                      placeholder={couponForm.discountType === "PERCENTAGE" ? "20" : "7.00"}
                      required
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={couponForm.description}
                      onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                      placeholder="Code réservé aux clients VIP"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
                  Créer le code promo
                </Button>
              </form>
            </motion.div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg text-purple-900">{coupon.code}</span>
                  {coupon.isActive ? (
                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">Actif</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-400 text-white text-xs rounded-full">Inactif</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  {coupon.discountType === "PERCENTAGE" ? (
                    <span className="font-semibold">{coupon.discountValue}% de réduction</span>
                  ) : (
                    <span className="font-semibold">{coupon.discountValue}€ de réduction</span>
                  )}
                </p>
                {coupon.description && (
                  <p className="text-xs text-gray-600">{coupon.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section Clients */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Liste des Clients</h2>
        <div className="space-y-4">
          {clients.map((client) => {
            const totalCredits = client.creditBatches?.reduce((acc, b) => acc + b.remaining, 0) || 0;
            
            return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 border-2 border-orange-200"
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      {client.name || "Sans nom"}
                    </h3>
                    {client.autoApplyCoupon && (
                      <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold rounded-full">
                        ⭐ VIP
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-3">{client.email}</p>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">Réservations</p>
                      <p className="text-lg font-bold text-blue-600">{client.stats.totalBookings}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600">Complétées</p>
                      <p className="text-lg font-bold text-green-600">{client.stats.completedBookings}</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs text-gray-600">Total dépensé</p>
                      <p className="text-lg font-bold text-orange-600">{client.stats.totalSpent.toFixed(2)}€</p>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg text-white">
                      <p className="text-xs text-gray-400">Solde Crédits</p>
                      <p className="text-lg font-bold text-white">{totalCredits}</p>
                    </div>
                  </div>

                  {client.autoApplyCoupon && (
                    <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-300 mb-3">
                      <p className="text-sm font-semibold text-purple-900 mb-1">
                        Code VIP actuel: {client.autoApplyCoupon.code}
                      </p>
                      <p className="text-xs text-purple-700">
                        {client.autoApplyCoupon.discountType === "PERCENTAGE"
                          ? `${client.autoApplyCoupon.discountValue}% de réduction`
                          : `${client.autoApplyCoupon.discountValue}€ de réduction`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {/* Gestion Crédits */}
                  <Button 
                    onClick={() => setSelectedClientForCredits(client.id)}
                    variant="outline" 
                    className="border-gray-900 text-gray-900 hover:bg-gray-100"
                  >
                    💰 Gérer Crédits
                  </Button>

                  {/* Gestion VIP */}
                  {!client.autoApplyCoupon ? (
                    selectedClientForVIP === client.id ? (
                      <div className="space-y-2 bg-purple-50 p-2 rounded-lg border border-purple-200">
                        <select
                          value={selectedCoupon}
                          onChange={(e) => setSelectedCoupon(e.target.value)}
                          className="h-10 border-2 border-purple-200 rounded-lg px-3 text-sm w-full"
                        >
                          <option value="">Sélectionner un code</option>
                          {coupons.filter(c => c.isActive).map((coupon) => (
                            <option key={coupon.id} value={coupon.id}>
                              {coupon.code}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => assignVIPCoupon(client.id, selectedCoupon)}
                            disabled={!selectedCoupon}
                            className="bg-purple-500 hover:bg-purple-600 flex-1"
                            size="sm"
                          >
                            OK
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedClientForVIP(null);
                              setSelectedCoupon("");
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            X
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setSelectedClientForVIP(client.id)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500"
                      >
                        👑 Passer VIP
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={() => removeVIPStatus(client.id)}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Retirer le VIP
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )})}
        </div>

        {/* Modale Gestion Crédits */}
        <AnimatePresence>
            {selectedClientForCredits && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white p-6 rounded-2xl w-full max-w-sm"
                    >
                        <h3 className="text-xl font-bold mb-4">Gérer les crédits</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Ajouter (positif) ou retirer (négatif) des crédits pour ce client.
                        </p>
                        <form onSubmit={handleUpdateCredits}>
                            <Input 
                                type="number" 
                                placeholder="Montant (ex: 5 ou -2)" 
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value)}
                                className="mb-4"
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={() => setSelectedClientForCredits(null)}>Annuler</Button>
                                <Button type="submit" className="bg-green-600 hover:bg-green-700">Valider</Button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

      </div>
    </div>
  );
}