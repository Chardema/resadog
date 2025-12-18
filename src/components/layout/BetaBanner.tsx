"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BetaBanner() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, path: pathname }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setIsOpen(false);
          setDescription("");
        }, 2000);
      }
    } catch (e) {
      alert("Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Banner Fixe en bas à droite (au-dessus du footer/nav mobile) */}
      <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-2">
        <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg border border-yellow-500 animate-pulse">
          🚧 VERSION BETA
        </div>
        <Button 
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white shadow-xl rounded-full px-6 h-12 font-bold flex items-center gap-2"
        >
          🐞 Signaler un bug
        </Button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Signaler un problème 🐛</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {success ? (
                <div className="text-center py-8 text-green-600">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="font-bold">Merci ! Le message a été envoyé.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Description du bug</Label>
                    <textarea
                      className="w-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl h-32 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                      placeholder="Décrivez ce qui ne marche pas... (ex: le bouton X ne clique pas sur la page Y)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={sending} className="bg-red-600 hover:bg-red-700 text-white">
                      {sending ? "Envoi..." : "Envoyer le rapport"}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
