"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  isActive: boolean;
  minAmount?: number;
  maxUses?: number;
  currentUses: number;
  restrictedTo: string[];
  applicableServices: string[];
}

export default function AdminCouponsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "FIXED_AMOUNT",
    discountValue: 0,
    minAmount: 0,
    applicableServices: [] as string[],
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
    if (session?.user?.role === "ADMIN") {
      fetchCoupons();
    }
  }, [session, status, router]);

  const fetchCoupons = async () => {
    try {
      const res = await fetch("/api/admin/coupons");
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons);
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          code: formData.code.toUpperCase(),
          minAmount: formData.minAmount || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchCoupons();
        setShowForm(false);
        setFormData({ code: "", description: "", discountType: "FIXED_AMOUNT", discountValue: 0, minAmount: 0, applicableServices: [] });
      } else {
        alert("Erreur: " + (data.error || "Création impossible"));
      }
    } catch (e) { alert("Erreur serveur"); }
    setIsLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId: id, isActive: !currentStatus }),
      });
      if (res.ok) fetchCoupons();
    } catch (e) { console.error(e); }
  };

  const toggleService = (service: string) => {
    setFormData(prev => {
      const services = prev.applicableServices.includes(service)
        ? prev.applicableServices.filter(s => s !== service)
        : [...prev.applicableServices, service];
      return { ...prev, applicableServices: services };
    });
  };

  if (status === "loading") return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Codes Promo 🎟️</h1>
          <p className="text-gray-500">Gérez vos offres et réductions</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-gray-900 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all">
          {showForm ? "Fermer" : "+ Nouveau Code"}
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 mb-10">
          <h2 className="text-xl font-bold mb-6">Créer un nouveau coupon</h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Code (ex: PROMO2025)</Label>
                <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="uppercase font-mono font-bold" required />
              </div>
              <div>
                <Label>Description (optionnel)</Label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Offre de printemps..." />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label>Type de réduction</Label>
                <select 
                  className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  value={formData.discountType}
                  onChange={e => setFormData({...formData, discountType: e.target.value as any})}
                >
                  <option value="FIXED_AMOUNT">Montant Fixe (€)</option>
                  <option value="PERCENTAGE">Pourcentage (%)</option>
                </select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input type="number" value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: parseFloat(e.target.value)})} required min="0" />
              </div>
              <div>
                <Label>Montant Min. Commande (€)</Label>
                <Input type="number" value={formData.minAmount} onChange={e => setFormData({...formData, minAmount: parseFloat(e.target.value)})} min="0" />
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Services applicables (Laisser vide pour tous)</Label>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: "BOARDING", label: "🏠 Hébergement" },
                  { id: "DAY_CARE", label: "☀️ Garderie" },
                  { id: "DROP_IN", label: "🚪 Visite" },
                  { id: "DOG_WALKING", label: "🦮 Promenade" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                      formData.applicableServices.includes(s.id)
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-xl h-12">
                {isLoading ? "Création..." : "Créer le coupon ✨"}
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Liste des coupons */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.map((coupon) => (
          <motion.div
            key={coupon.id}
            layout
            className={`p-6 rounded-[2rem] border-2 relative overflow-hidden group ${coupon.isActive ? "bg-white border-gray-100 shadow-lg" : "bg-gray-50 border-gray-200 opacity-70"}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-gray-900 text-white px-3 py-1 rounded-lg font-mono font-bold text-sm tracking-wider">
                {coupon.code}
              </div>
              <div className={`w-3 h-3 rounded-full ${coupon.isActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            </div>

            <div className="mb-6">
              <p className="text-3xl font-extrabold text-orange-600">
                -{coupon.discountValue}{coupon.discountType === "PERCENTAGE" ? "%" : "€"}
              </p>
              <p className="text-gray-500 text-sm mt-1">{coupon.description || "Aucune description"}</p>
            </div>

            <div className="space-y-2 text-xs text-gray-500 mb-6">
              <p>🏷️ Type: {coupon.discountType === "PERCENTAGE" ? "Pourcentage" : "Montant fixe"}</p>
              <p>🛒 Min: {coupon.minAmount ? `${coupon.minAmount}€` : "Aucun"}</p>
              <p>🔄 Utilisé: {coupon.currentUses} fois</p>
              {coupon.applicableServices.length > 0 && (
                <p>🔒 Services: {coupon.applicableServices.length} sélectionnés</p>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-400">
                {coupon.isActive ? "ACTIF" : "INACTIF"}
              </span>
              <button
                onClick={() => toggleStatus(coupon.id, coupon.isActive)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  coupon.isActive 
                    ? "bg-red-50 text-red-600 hover:bg-red-100" 
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                }`}
              >
                {coupon.isActive ? "Désactiver" : "Activer"}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
