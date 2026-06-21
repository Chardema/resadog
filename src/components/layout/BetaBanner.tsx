"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bug, CheckCircle2, X } from "lucide-react";

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
    } catch {
      alert("Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-20 right-3 z-40 md:bottom-6 md:right-6">
        <Button 
          onClick={() => setIsOpen(true)}
          size="icon"
          aria-label="Signaler un problème"
          title="Signaler un problème"
          className="h-11 w-11 rounded-full border border-gray-200 bg-white text-gray-700 shadow-lg hover:bg-gray-50"
        >
          <Bug className="h-5 w-5" />
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
                <h3 className="text-xl font-bold text-gray-900">Signaler un problème</h3>
                <button onClick={() => setIsOpen(false)} aria-label="Fermer" className="p-2 text-gray-500 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {success ? (
                <div className="text-center py-8 text-green-600">
                  <CheckCircle2 className="mx-auto mb-2 h-10 w-10" />
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
