"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddChargeModalProps {
  bookingId: string;
  clientName: string;
  cardLast4?: string;
  cardBrand?: string;
  onSuccess?: () => void;
}

export function AddChargeModal({
  bookingId,
  clientName,
  cardLast4,
  cardBrand,
  onSuccess,
}: AddChargeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    description: "",
  });

  const predefinedReasons = [
    { label: "Retard de récupération", value: "Retard de récupération", baseAmount: 15 },
    { label: "Médicaments urgents", value: "Médicaments urgents", baseAmount: 20 },
    { label: "Nourriture spéciale", value: "Nourriture spéciale", baseAmount: 10 },
    { label: "Visite vétérinaire", value: "Visite vétérinaire d'urgence", baseAmount: 50 },
    { label: "Dégâts matériels", value: "Dégâts matériels", baseAmount: 30 },
    { label: "Autre", value: "", baseAmount: 0 },
  ];

  const handleQuickSelect = (reason: string, amount: number) => {
    setFormData({
      ...formData,
      reason,
      amount: amount > 0 ? amount.toString() : "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/additional-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          amount: parseFloat(formData.amount),
          reason: formData.reason,
          description: formData.description || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Une erreur est survenue");
      }

      setSuccess(data.message || `Supplément de ${formData.amount}€ débité avec succès !`);

      // Réinitialiser le formulaire
      setFormData({ amount: "", reason: "", description: "" });

      // Fermer après 2 secondes
      setTimeout(() => {
        setIsOpen(false);
        setSuccess("");
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold shadow-lg"
        >
          💳 Débiter un supplément
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 border-2 border-orange-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    💳 Débiter un supplément
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(false)}
                    className="h-10 w-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-600"
                  >
                    ×
                  </motion.button>
                </div>

                {/* Info client */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-semibold">Client:</span> {clientName}
                  </p>
                  {cardLast4 && cardBrand && (
                    <p className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="font-semibold">Carte enregistrée:</span>
                      <span className="px-3 py-1 bg-white rounded-lg font-mono text-sm border border-blue-300">
                        {cardBrand.toUpperCase()} •••• {cardLast4}
                      </span>
                    </p>
                  )}
                  {!cardLast4 && (
                    <p className="text-sm text-red-600 font-semibold">
                      ⚠️ Aucune carte enregistrée - impossible de débiter automatiquement
                    </p>
                  )}
                </div>

                {/* Boutons rapides */}
                <div className="mb-6">
                  <Label className="text-gray-700 font-semibold mb-3 block">
                    🚀 Raisons fréquentes
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {predefinedReasons.map((item) => (
                      <motion.button
                        key={item.label}
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleQuickSelect(item.value, item.baseAmount)}
                        className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                          formData.reason === item.value
                            ? "border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 text-orange-900"
                            : "border-gray-200 hover:border-orange-300 bg-white text-gray-700"
                        }`}
                      >
                        {item.label}
                        {item.baseAmount > 0 && (
                          <span className="block text-xs text-gray-600 mt-1">
                            {item.baseAmount}€ suggéré
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Raison */}
                  <div>
                    <Label htmlFor="reason" className="text-gray-700 font-semibold">
                      Raison du supplément *
                    </Label>
                    <Input
                      id="reason"
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="Ex: Retard de 4h à la récupération"
                      required
                      className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl h-12"
                    />
                  </div>

                  {/* Montant */}
                  <div>
                    <Label htmlFor="amount" className="text-gray-700 font-semibold">
                      Montant à débiter (€) *
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="15.00"
                      required
                      className="mt-2 border-2 border-orange-200 focus:border-orange-400 rounded-xl h-12 text-lg font-bold"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description" className="text-gray-700 font-semibold">
                      Description détaillée (optionnel)
                    </Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Détails supplémentaires pour la facture..."
                      className="mt-2 w-full border-2 border-orange-200 rounded-xl p-3 focus:border-orange-400 outline-none h-24 resize-none"
                    />
                  </div>

                  {/* Messages d'erreur et succès */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-100 border-2 border-red-300 rounded-xl text-red-700 font-semibold"
                    >
                      ❌ {error}
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-green-100 border-2 border-green-300 rounded-xl text-green-700 font-semibold"
                    >
                      ✅ {success}
                    </motion.div>
                  )}

                  {/* Avertissement */}
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                    <p className="text-sm text-yellow-800 font-semibold mb-2">
                      ⚠️ Débit automatique immédiat
                    </p>
                    <p className="text-xs text-yellow-700">
                      En cliquant sur "Débiter maintenant", la carte enregistrée du client sera
                      débitée immédiatement sans confirmation supplémentaire. Le client recevra
                      une facture par email.
                    </p>
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      variant="outline"
                      className="flex-1 border-2 border-gray-300 hover:bg-gray-100 font-semibold"
                      size="lg"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading || !cardLast4}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50"
                      size="lg"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Débit en cours...</span>
                        </div>
                      ) : (
                        `💳 Débiter ${formData.amount ? parseFloat(formData.amount).toFixed(2) : "0.00"}€`
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
