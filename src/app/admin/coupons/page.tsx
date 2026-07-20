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
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL";
  discountValue: number;
  isActive: boolean;
  minAmount?: number;
  maxUses?: number;
  currentUses: number;
  restrictedTo: string[];
  applicableServices: string[];
}

const serviceOptions = [
  { id: "BOARDING", label: "Hébergement" },
  { id: "HOUSE_SITTING", label: "Garde à domicile" },
  { id: "DAY_CARE", label: "Garderie" },
  { id: "DROP_IN", label: "Visite" },
  { id: "DOG_WALKING", label: "Promenade" },
];

const formatCouponValue = (coupon: Pick<Coupon, "discountType" | "discountValue">) => {
  if (coupon.discountType === "CUSTOM_TOTAL") return `${coupon.discountValue}€ final`;
  if (coupon.discountType === "PERCENTAGE") return `-${coupon.discountValue}%`;
  return `-${coupon.discountValue}€`;
};

const discountTypeLabel = {
  PERCENTAGE: "Pourcentage",
  FIXED_AMOUNT: "Réduction en euros",
  CUSTOM_TOTAL: "Tarif final",
} as const;

type CouponFormState = {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL";
  discountValue: number;
  minAmount: number;
  maxUses: number;
  restrictedTo: string;
  applicableServices: string[];
};

const emptyCouponForm: CouponFormState = {
  code: "",
  description: "",
  discountType: "CUSTOM_TOTAL",
  discountValue: 0,
  minAmount: 0,
  maxUses: 0,
  restrictedTo: "",
  applicableServices: [],
};

const couponToForm = (coupon: Coupon): CouponFormState => ({
  code: coupon.code,
  description: coupon.description || "",
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  minAmount: coupon.minAmount || 0,
  maxUses: coupon.maxUses || 0,
  restrictedTo: coupon.restrictedTo.join(", "),
  applicableServices: coupon.applicableServices,
});

export default function AdminCouponsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CouponFormState>(emptyCouponForm);

  const formTitle = editingCouponId ? "Modifier le code promo" : "Créer un nouveau coupon";
  const submitLabel = editingCouponId ? "Enregistrer" : "Créer le coupon";

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

  const buildCouponPayload = () => ({
    ...formData,
    code: formData.code.toUpperCase(),
    minAmount: formData.minAmount || undefined,
    maxUses: formData.maxUses || undefined,
    restrictedTo: formData.restrictedTo
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  });

  const resetForm = () => {
    setFormData(emptyCouponForm);
    setEditingCouponId(null);
    setShowForm(false);
  };

  const handleSubmitCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: editingCouponId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildCouponPayload(),
          couponId: editingCouponId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchCoupons();
        resetForm();
      } else {
        alert("Erreur: " + (data.error || "Opération impossible"));
      }
    } catch { alert("Erreur serveur"); }
    setIsLoading(false);
  };

  const startEdit = (coupon: Coupon) => {
    setFormData(couponToForm(coupon));
    setEditingCouponId(coupon.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`Supprimer définitivement le code ${coupon.code} ?`)) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId: coupon.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Suppression impossible");
      await fetchCoupons();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erreur serveur");
    } finally {
      setIsLoading(false);
    }
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
        <Button
          onClick={() => {
            if (!showForm) setFormData(emptyCouponForm);
            setEditingCouponId(null);
            setShowForm(!showForm);
          }}
          className="bg-gray-900 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all"
        >
          {showForm ? "Fermer" : "+ Nouveau Code"}
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 mb-10">
          <h2 className="text-xl font-bold mb-6">{formTitle}</h2>
          <form onSubmit={handleSubmitCoupon} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Code (ex: PROMO2026)</Label>
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
                  onChange={e => setFormData({...formData, discountType: e.target.value as "FIXED_AMOUNT" | "PERCENTAGE" | "CUSTOM_TOTAL"})}
                >
                  <option value="CUSTOM_TOTAL">Tarif final à payer</option>
                  <option value="FIXED_AMOUNT">Réduction en euros</option>
                  <option value="PERCENTAGE">Réduction en pourcentage</option>
                </select>
              </div>
              <div>
                <Label>
                  {formData.discountType === "CUSTOM_TOTAL"
                    ? "Total final à payer (€)"
                    : formData.discountType === "FIXED_AMOUNT"
                      ? "Réduction (€)"
                      : "Réduction (%)"}
                </Label>
                <Input type="number" value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: parseFloat(e.target.value)})} required min="0" max={formData.discountType === "PERCENTAGE" ? 20 : undefined} />
                {formData.discountType === "PERCENTAGE" && (
                  <p className="mt-1 text-xs text-gray-500">Maximum 20% pour préserver le prix plancher.</p>
                )}
                {formData.discountType === "FIXED_AMOUNT" && (
                  <p className="mt-1 text-xs text-gray-500">Réduction en euros, plafonnée à 20% du total.</p>
                )}
                {formData.discountType === "CUSTOM_TOTAL" && (
                  <p className="mt-1 text-xs text-gray-500">Exemple : 40 pour faire payer exactement 40€, même si le total normal est 81€.</p>
                )}
              </div>
              <div>
                <Label>Montant Min. Commande (€)</Label>
                <Input type="number" value={formData.minAmount} onChange={e => setFormData({...formData, minAmount: parseFloat(e.target.value)})} min="0" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Emails autorisés</Label>
                <Input
                  value={formData.restrictedTo}
                  onChange={e => setFormData({...formData, restrictedTo: e.target.value})}
                  placeholder="client@email.fr, autre@email.fr"
                />
                <p className="mt-1 text-xs text-gray-500">Vide = code utilisable par tout client qui connaît le code.</p>
              </div>
              <div>
                <Label>Utilisations max</Label>
                <Input
                  type="number"
                  value={formData.maxUses}
                  onChange={e => setFormData({...formData, maxUses: parseInt(e.target.value || "0", 10)})}
                  min="0"
                  placeholder="1"
                />
                <p className="mt-1 text-xs text-gray-500">0 = illimité. Pour un geste commercial unique, mets 1.</p>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Services applicables (Laisser vide pour tous)</Label>
              <div className="flex flex-wrap gap-3">
                {serviceOptions.map((s) => (
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
              {editingCouponId && (
                <Button type="button" variant="outline" onClick={resetForm} className="mr-3 h-12 rounded-xl px-6">
                  Annuler
                </Button>
              )}
              <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-xl h-12">
                {isLoading ? "Enregistrement..." : submitLabel}
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
                {formatCouponValue(coupon)}
              </p>
              <p className="text-gray-500 text-sm mt-1">{coupon.description || "Aucune description"}</p>
            </div>

            <div className="space-y-2 text-xs text-gray-500 mb-6">
              <p>Type: {discountTypeLabel[coupon.discountType]}</p>
              <p>🛒 Min: {coupon.minAmount ? `${coupon.minAmount}€` : "Aucun"}</p>
              <p>🔄 Utilisé: {coupon.currentUses}{coupon.maxUses ? ` / ${coupon.maxUses}` : ""} fois</p>
              {coupon.restrictedTo.length > 0 && (
                <p>Clients: {coupon.restrictedTo.join(", ")}</p>
              )}
              {coupon.applicableServices.length > 0 && (
                <p>🔒 Services: {coupon.applicableServices.length} sélectionnés</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => startEdit(coupon)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Modifier
              </button>
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
              <button
                onClick={() => deleteCoupon(coupon)}
                className="col-span-3 px-3 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
