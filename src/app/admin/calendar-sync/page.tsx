"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function CalendarSyncPage() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const userId = session?.user?.id;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const httpsUrl = `${baseUrl}/api/calendar/ical?token=${userId}&mode=admin`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  const handleCopy = () => {
    navigator.clipboard.writeText(httpsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Synchroniser avec Apple Calendar</h1>
      <p className="text-gray-500 mb-8">Toutes vos réservations et indisponibilités, synchronisées automatiquement.</p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6"
      >
        {/* Ce qui est synchro */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Ce qui apparaîtra dans votre calendrier :</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">✅</span>
              <span className="text-gray-700"><strong>Réservations confirmées</strong> — avec nom du client, animaux, téléphone</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">⏳</span>
              <span className="text-gray-700"><strong>Réservations en attente</strong> — en attente de validation</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">🚫</span>
              <span className="text-gray-700"><strong>Dates bloquées</strong> — vos indisponibilités par service</span>
            </div>
          </div>
        </div>

        {/* Bouton direct Apple Calendar */}
        {!userId ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-orange-800 font-medium">Chargement de votre session...</p>
          </div>
        ) : (
          <>
            <a
              href={webcalUrl}
              className="block w-full text-center bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg"
            >
              📅 Ajouter à Apple Calendar
            </a>
            <p className="text-center text-xs text-gray-400 -mt-3">Cliquez pour ouvrir directement dans Apple Calendar</p>

            {/* Lien manuel */}
            <div className="bg-gray-50 rounded-xl p-4">
              <label className="text-xs text-gray-500 font-medium block mb-2">Ou copiez le lien manuellement :</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={httpsUrl}
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    copied
                      ? "bg-green-500 text-white"
                      : "bg-gray-900 text-white hover:bg-orange-600"
                  }`}
                >
                  {copied ? "Copié !" : "Copier"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Instructions */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Comment l'ajouter :</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div>
                <p className="font-medium text-gray-900">Apple Calendar (Mac)</p>
                <p className="text-sm text-gray-500">Fichier &gt; Nouvel abonnement à un calendrier &gt; collez l'URL</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div>
                <p className="font-medium text-gray-900">Apple Calendar (iPhone)</p>
                <p className="text-sm text-gray-500">Réglages &gt; Calendrier &gt; Comptes &gt; Ajouter un compte &gt; Autre &gt; Abonnement à un calendrier &gt; collez l'URL</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
              <div>
                <p className="font-medium text-gray-900">Google Calendar</p>
                <p className="text-sm text-gray-500">Paramètres &gt; Ajouter un calendrier &gt; À partir d'une URL &gt; collez l'URL</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info mise à jour */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <div className="text-sm text-blue-800">
            <p className="font-bold">Mise à jour automatique</p>
            <p>Apple Calendar re-synchronise le flux environ toutes les 15 minutes. Les nouvelles réservations et changements d'indisponibilité apparaîtront automatiquement.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
