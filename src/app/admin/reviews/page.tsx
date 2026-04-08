"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Review {
  id: string;
  source: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  isActive: boolean;
  order: number;
}

interface AlloVoisinsData {
  rating: number | null;
  reviewCount: number | null;
  fetchedAt: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alloData, setAlloData] = useState<AlloVoisinsData | null>(null);
  const [alloLoading, setAlloLoading] = useState(false);

  const [formData, setFormData] = useState({
    source: "ROVER" as string,
    author: "",
    rating: 5,
    date: "",
    content: "",
    order: 0,
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/admin/reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncAlloVoisins = async () => {
    setAlloLoading(true);
    try {
      const res = await fetch("/api/admin/reviews/sync-allovoisins");
      if (res.ok) {
        const data = await res.json();
        setAlloData(data);
      }
    } catch (error) {
      console.error("Erreur sync:", error);
    } finally {
      setAlloLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchReviews();
        setShowForm(false);
        setFormData({ source: "ROVER", author: "", rating: 5, date: "", content: "", order: 0 });
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (reviewId: string, isActive: boolean) => {
    await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, isActive: !isActive }),
    });
    await fetchReviews();
  };

  const deleteReview = async (reviewId: string) => {
    if (!confirm("Supprimer cet avis ?")) return;
    await fetch(`/api/admin/reviews?id=${reviewId}`, { method: "DELETE" });
    await fetchReviews();
  };

  const sourceColors: Record<string, string> = {
    ALLOVOISINS: "bg-blue-100 text-blue-700",
    ROVER: "bg-green-100 text-green-700",
    GOOGLE: "bg-red-100 text-red-700",
    WEBSITE: "bg-orange-100 text-orange-700",
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Avis Clients</h1>
          <p className="text-gray-500">Gérez les avis affichés sur le site</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={syncAlloVoisins} disabled={alloLoading} className="rounded-xl">
            {alloLoading ? "Sync..." : "🔄 Sync AlloVoisins"}
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-gray-900 hover:bg-orange-600">
            {showForm ? "Annuler" : "+ Ajouter un avis"}
          </Button>
        </div>
      </div>

      {/* AlloVoisins Stats */}
      {alloData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">⭐</span>
            <div>
              <p className="font-bold text-blue-900">AlloVoisins — Note : {alloData.rating}/5</p>
              <p className="text-sm text-blue-600">{alloData.reviewCount} avis au total</p>
            </div>
          </div>
          <p className="text-xs text-blue-400">Mis à jour : {new Date(alloData.fetchedAt).toLocaleString("fr-FR")}</p>
        </motion.div>
      )}

      {/* Formulaire ajout */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={handleCreate}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8 space-y-4"
        >
          <h3 className="font-bold text-gray-900 text-lg">Nouvel avis</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Source</Label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm"
              >
                <option value="ROVER">Rover</option>
                <option value="ALLOVOISINS">AlloVoisins</option>
                <option value="GOOGLE">Google</option>
                <option value="WEBSITE">Site web</option>
              </select>
            </div>
            <div>
              <Label>Auteur</Label>
              <Input
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="bg-gray-50 rounded-xl"
                placeholder="Prénom du client"
              />
            </div>
            <div>
              <Label>Note (1-5)</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: n })}
                    className={`text-2xl transition-transform ${n <= formData.rating ? "text-yellow-400 scale-110" : "text-gray-200"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Date affichée</Label>
              <Input
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-gray-50 rounded-xl"
                placeholder="Ex: 14 août 2024"
              />
            </div>
            <div className="col-span-2">
              <Label>Contenu de l'avis</Label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm min-h-[80px]"
                placeholder="Texte de l'avis..."
              />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 rounded-xl">
            {saving ? "Enregistrement..." : "Ajouter l'avis"}
          </Button>
        </motion.form>
      )}

      {/* Liste des avis */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="text-6xl mb-4 grayscale opacity-50">💬</p>
            <p className="text-gray-500">Aucun avis. Ajoutez-en depuis Rover ou AlloVoisins.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl p-5 border shadow-sm flex items-start justify-between gap-4 ${
                review.isActive ? "border-gray-100" : "border-red-100 bg-red-50/30 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceColors[review.source] || "bg-gray-100"}`}>
                    {review.source}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{review.author}</span>
                  <span className="text-xs text-gray-400">{review.date}</span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`text-xs ${i < review.rating ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 italic truncate">&ldquo;{review.content}&rdquo;</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(review.id, review.isActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    review.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {review.isActive ? "Actif" : "Masqué"}
                </button>
                <button
                  onClick={() => deleteReview(review.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100"
                >
                  🗑️
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
