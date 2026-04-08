"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/layout/AppNav";
import { use } from "react";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
  gender?: string | null;
  spayedNeutered?: boolean | null;
  microchipNumber?: string | null;
  allergies?: string | null;
  insuranceInfo?: string | null;
  medicalInfo?: string | null;
  medications?: string | null;
  vetInfo?: string | null;
  lastVetVisit?: string | null;
  imageUrl?: string | null;
}

interface Vaccine {
  id: string;
  name: string;
  dateGiven: string;
  expiryDate?: string | null;
  batchNumber?: string | null;
  vetName?: string | null;
  notes?: string | null;
}

const COMMON_VACCINES_DOG = ["Rage", "CHPPIL (Maladie de Carré)", "Leptospirose", "Piroplasmose", "Toux du chenil"];
const COMMON_VACCINES_CAT = ["Rage", "Typhus (Panleucopénie)", "Coryza", "Leucose féline (FeLV)", "Chlamydiose"];

export default function PetHealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pet, setPet] = useState<Pet | null>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "vaccines" | "medical">("overview");
  const [showVaccineForm, setShowVaccineForm] = useState(false);
  const [vaccineForm, setVaccineForm] = useState({
    name: "", dateGiven: "", expiryDate: "", batchNumber: "", vetName: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingMedical, setEditingMedical] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    microchipNumber: "", allergies: "", insuranceInfo: "", medicalInfo: "", medications: "", lastVetVisit: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
    else if (status === "authenticated") fetchData();
  }, [status]);

  const fetchData = async () => {
    try {
      const [petRes, vaccRes] = await Promise.all([
        fetch(`/api/pets/${id}`),
        fetch(`/api/pets/${id}/vaccines`),
      ]);
      if (petRes.ok) {
        const { pet: p } = await petRes.json();
        setPet(p);
        setMedicalForm({
          microchipNumber: p.microchipNumber || "",
          allergies: p.allergies || "",
          insuranceInfo: p.insuranceInfo || "",
          medicalInfo: p.medicalInfo || "",
          medications: p.medications || "",
          lastVetVisit: p.lastVetVisit ? p.lastVetVisit.split("T")[0] : "",
        });
      }
      if (vaccRes.ok) {
        const { vaccines: v } = await vaccRes.json();
        setVaccines(v);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/pets/${id}/vaccines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vaccineForm),
      });
      if (res.ok) {
        const { vaccine } = await res.json();
        setVaccines([vaccine, ...vaccines]);
        setShowVaccineForm(false);
        setVaccineForm({ name: "", dateGiven: "", expiryDate: "", batchNumber: "", vetName: "", notes: "" });
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVaccine = async (vaccineId: string) => {
    if (!confirm("Supprimer ce vaccin ?")) return;
    try {
      await fetch(`/api/pets/${id}/vaccines?vaccineId=${vaccineId}`, { method: "DELETE" });
      setVaccines(vaccines.filter((v) => v.id !== vaccineId));
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleSaveMedical = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...medicalForm,
          lastVetVisit: medicalForm.lastVetVisit ? new Date(medicalForm.lastVetVisit).toISOString() : undefined,
        }),
      });
      if (res.ok) {
        const { pet: updated } = await res.json();
        setPet(updated);
        setEditingMedical(false);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setSaving(false);
    }
  };

  const getVaccineStatus = (vaccine: Vaccine) => {
    if (!vaccine.expiryDate) return "valid";
    const expiry = new Date(vaccine.expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry < 30) return "expiring";
    return "valid";
  };

  const commonVaccines = pet?.species === "CAT" ? COMMON_VACCINES_CAT : COMMON_VACCINES_DOG;

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center">
        <div className="text-6xl animate-bounce">🐾</div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center">
        <p className="text-gray-500">Animal introuvable</p>
      </div>
    );
  }

  const expiredVaccines = vaccines.filter((v) => getVaccineStatus(v) === "expired");
  const expiringVaccines = vaccines.filter((v) => getVaccineStatus(v) === "expiring");

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />

      <main className="container mx-auto px-6 pt-32 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/pets" className="text-gray-400 hover:text-gray-600 transition-colors">
            ← Retour
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-6 mb-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-4xl overflow-hidden shadow-lg flex-shrink-0">
            {pet.imageUrl ? <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover" /> : "🐾"}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Carnet de santé</h1>
            <p className="text-gray-500 text-lg">{pet.name} — {pet.breed || pet.species === "DOG" ? "Chien" : "Chat"}</p>
          </div>
        </motion.div>

        {/* Alertes */}
        {(expiredVaccines.length > 0 || expiringVaccines.length > 0) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 space-y-3">
            {expiredVaccines.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <p className="font-bold text-red-800">Vaccins expirés</p>
                  <p className="text-sm text-red-600">{expiredVaccines.map((v) => v.name).join(", ")}</p>
                </div>
              </div>
            )}
            {expiringVaccines.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-amber-800">Rappels bientôt</p>
                  <p className="text-sm text-amber-600">{expiringVaccines.map((v) => v.name).join(", ")} — dans moins de 30 jours</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white rounded-full p-1.5 shadow-sm border border-gray-100 w-fit">
          {[
            { key: "overview" as const, label: "Vue d'ensemble", icon: "📋" },
            { key: "vaccines" as const, label: "Vaccins", icon: "💉" },
            { key: "medical" as const, label: "Infos médicales", icon: "🏥" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? "bg-gray-900 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* TAB: Vue d'ensemble */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Poids", value: pet.weight ? `${pet.weight} kg` : "—", icon: "⚖️", color: "bg-blue-50 text-blue-700" },
                  { label: "Âge", value: pet.age ? `${pet.age} ans` : "—", icon: "🎂", color: "bg-purple-50 text-purple-700" },
                  { label: "Stérilisé", value: pet.spayedNeutered ? "Oui ✓" : "Non", icon: "✂️", color: pet.spayedNeutered ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700" },
                  { label: "Vaccins", value: `${vaccines.length}`, icon: "💉", color: expiredVaccines.length > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`${stat.color} rounded-2xl p-5 text-center`}
                  >
                    <div className="text-2xl mb-2">{stat.icon}</div>
                    <p className="text-2xl font-extrabold">{stat.value}</p>
                    <p className="text-xs font-medium opacity-70">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Infos clés */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">🏷️ Identification</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Puce électronique</span>
                      <span className="font-mono font-bold text-gray-900">{pet.microchipNumber || "Non renseigné"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Assurance</span>
                      <span className="font-bold text-gray-900">{pet.insuranceInfo || "Non renseigné"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dernière visite véto</span>
                      <span className="font-bold text-gray-900">
                        {pet.lastVetVisit ? new Date(pet.lastVetVisit).toLocaleDateString("fr-FR") : "Non renseigné"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">⚠️ Allergies & Traitements</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-500 block mb-1">Allergies connues</span>
                      <p className="font-medium text-gray-900">{pet.allergies || "Aucune allergie connue"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">Traitements en cours</span>
                      <p className="font-medium text-gray-900">{pet.medications || "Aucun traitement"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Derniers vaccins */}
              {vaccines.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">💉 Derniers vaccins</h3>
                  <div className="space-y-3">
                    {vaccines.slice(0, 3).map((v) => {
                      const vaccineStatus = getVaccineStatus(v);
                      return (
                        <div key={v.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              vaccineStatus === "expired" ? "bg-red-500" :
                              vaccineStatus === "expiring" ? "bg-amber-500" : "bg-green-500"
                            }`} />
                            <span className="font-medium text-gray-900">{v.name}</span>
                          </div>
                          <span className="text-sm text-gray-500">{new Date(v.dateGiven).toLocaleDateString("fr-FR")}</span>
                        </div>
                      );
                    })}
                  </div>
                  {vaccines.length > 3 && (
                    <button onClick={() => setActiveTab("vaccines")} className="mt-3 text-sm text-orange-600 font-bold hover:text-orange-700">
                      Voir tous les vaccins →
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: Vaccins */}
          {activeTab === "vaccines" && (
            <motion.div key="vaccines" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Carnet de vaccination</h2>
                <button
                  onClick={() => setShowVaccineForm(!showVaccineForm)}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-orange-600 transition-colors"
                >
                  {showVaccineForm ? "Annuler" : "+ Ajouter un vaccin"}
                </button>
              </div>

              {/* Formulaire ajout vaccin */}
              <AnimatePresence>
                {showVaccineForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddVaccine}
                    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <h3 className="font-bold text-gray-900 mb-4">Nouveau vaccin</h3>

                    {/* Quick select */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">Vaccins courants :</p>
                      <div className="flex flex-wrap gap-2">
                        {commonVaccines.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setVaccineForm({ ...vaccineForm, name })}
                            className={`px-3 py-2 rounded-full text-xs font-bold transition-all ${
                              vaccineForm.name === name
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600 font-medium block mb-1">Nom du vaccin *</label>
                        <input
                          required
                          value={vaccineForm.name}
                          onChange={(e) => setVaccineForm({ ...vaccineForm, name: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                          placeholder="Ex: Rage, CHPL..."
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 font-medium block mb-1">Date d'administration *</label>
                        <input
                          required
                          type="date"
                          value={vaccineForm.dateGiven}
                          onChange={(e) => setVaccineForm({ ...vaccineForm, dateGiven: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 font-medium block mb-1">Date de rappel</label>
                        <input
                          type="date"
                          value={vaccineForm.expiryDate}
                          onChange={(e) => setVaccineForm({ ...vaccineForm, expiryDate: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 font-medium block mb-1">Vétérinaire</label>
                        <input
                          value={vaccineForm.vetName}
                          onChange={(e) => setVaccineForm({ ...vaccineForm, vetName: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                          placeholder="Dr. ..."
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 font-medium block mb-1">N° de lot</label>
                        <input
                          value={vaccineForm.batchNumber}
                          onChange={(e) => setVaccineForm({ ...vaccineForm, batchNumber: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 font-medium block mb-1">Notes</label>
                        <input
                          value={vaccineForm.notes}
                          onChange={(e) => setVaccineForm({ ...vaccineForm, notes: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                          placeholder="Réaction, remarques..."
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="mt-4 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 w-full md:w-auto"
                    >
                      {saving ? "Enregistrement..." : "Ajouter le vaccin"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Liste des vaccins */}
              {vaccines.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                  <div className="text-6xl mb-4 grayscale opacity-50">💉</div>
                  <p className="text-gray-500 font-medium">Aucun vaccin enregistré</p>
                  <p className="text-sm text-gray-400 mt-1">Ajoutez les vaccins de {pet.name} pour suivre les rappels</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vaccines.map((v, i) => {
                    const vaccineStatus = getVaccineStatus(v);
                    return (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`bg-white rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${
                          vaccineStatus === "expired" ? "border-red-200 bg-red-50/30" :
                          vaccineStatus === "expiring" ? "border-amber-200 bg-amber-50/30" : "border-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                              vaccineStatus === "expired" ? "bg-red-100" :
                              vaccineStatus === "expiring" ? "bg-amber-100" : "bg-green-100"
                            }`}>
                              {vaccineStatus === "expired" ? "❌" : vaccineStatus === "expiring" ? "⚠️" : "✅"}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{v.name}</p>
                              <p className="text-sm text-gray-500">
                                Fait le {new Date(v.dateGiven).toLocaleDateString("fr-FR")}
                                {v.expiryDate && ` — Rappel le ${new Date(v.expiryDate).toLocaleDateString("fr-FR")}`}
                              </p>
                              {v.vetName && <p className="text-xs text-gray-400 mt-0.5">Dr. {v.vetName}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteVaccine(v.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                          >
                            🗑️
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: Infos médicales */}
          {activeTab === "medical" && (
            <motion.div key="medical" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Informations médicales</h2>
                <button
                  onClick={() => editingMedical ? handleSaveMedical() : setEditingMedical(true)}
                  disabled={saving}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${
                    editingMedical
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-900 text-white hover:bg-orange-600"
                  }`}
                >
                  {saving ? "Sauvegarde..." : editingMedical ? "Sauvegarder ✓" : "Modifier"}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { key: "microchipNumber" as const, label: "N° de puce électronique", icon: "🏷️", placeholder: "250XXXXXXXXXXXX", mono: true },
                  { key: "lastVetVisit" as const, label: "Dernière visite vétérinaire", icon: "📅", type: "date" },
                  { key: "allergies" as const, label: "Allergies connues", icon: "🚫", placeholder: "Poulet, acariens...", textarea: true },
                  { key: "medications" as const, label: "Traitements en cours", icon: "💊", placeholder: "Antiparasitaire mensuel...", textarea: true },
                  { key: "medicalInfo" as const, label: "Antécédents médicaux", icon: "📄", placeholder: "Opérations, maladies passées...", textarea: true },
                  { key: "insuranceInfo" as const, label: "Assurance santé", icon: "🛡️", placeholder: "Nom de l'assurance, n° de contrat..." },
                ].map((field) => (
                  <div key={field.key} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <label className="text-sm text-gray-500 font-medium flex items-center gap-2 mb-2">
                      {field.icon} {field.label}
                    </label>
                    {editingMedical ? (
                      field.textarea ? (
                        <textarea
                          value={medicalForm[field.key]}
                          onChange={(e) => setMedicalForm({ ...medicalForm, [field.key]: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none min-h-[80px]"
                          placeholder={field.placeholder}
                        />
                      ) : (
                        <input
                          type={field.type || "text"}
                          value={medicalForm[field.key]}
                          onChange={(e) => setMedicalForm({ ...medicalForm, [field.key]: e.target.value })}
                          className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none ${field.mono ? "font-mono" : ""}`}
                          placeholder={field.placeholder}
                        />
                      )
                    ) : (
                      <p className={`text-gray-900 font-medium ${field.mono ? "font-mono" : ""} ${!medicalForm[field.key] ? "text-gray-300 italic" : ""}`}>
                        {field.key === "lastVetVisit" && medicalForm[field.key]
                          ? new Date(medicalForm[field.key]).toLocaleDateString("fr-FR")
                          : medicalForm[field.key] || "Non renseigné"}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Vétérinaire */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">🩺 Vétérinaire traitant</h3>
                <p className="text-gray-700 whitespace-pre-line">{pet.vetInfo || "Non renseigné — ajoutez les coordonnées dans la fiche de l'animal"}</p>
                <Link href={`/pets/${id}/edit`} className="text-sm text-blue-600 font-bold mt-2 inline-block hover:text-blue-700">
                  Modifier la fiche →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
