"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

type CalendarSyncClientProps = {
  initialToken: string;
  configuredBaseUrl: string;
};

export function CalendarSyncClient({ initialToken, configuredBaseUrl }: CalendarSyncClientProps) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");

  const baseUrl = configuredBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const httpsUrl = useMemo(() => `${baseUrl}/api/calendar/ical?token=${token}&mode=admin`, [baseUrl, token]);
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  const handleCopy = () => {
    navigator.clipboard.writeText(httpsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const rotateToken = async () => {
    if (!confirm("Révoquer l'ancien lien calendrier et en générer un nouveau ?")) {
      return;
    }

    setError("");
    setRotating(true);

    try {
      const response = await fetch("/api/admin/calendar-token", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de renouveler le lien calendrier.");
      }

      setToken(data.token);
      setCopied(false);
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : "Impossible de renouveler le lien calendrier.");
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-3xl font-extrabold text-gray-900">Synchroniser avec Apple Calendar</h1>
      <p className="mb-8 text-gray-500">Toutes vos réservations et indisponibilités, synchronisées automatiquement.</p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 rounded-lg border border-gray-100 bg-white p-8 shadow-sm"
      >
        <div>
          <h3 className="mb-3 font-bold text-gray-900">Ce qui apparaîtra dans votre calendrier :</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">OK</span>
              <span className="text-gray-700"><strong>Réservations confirmées</strong> - avec nom du client, animaux, téléphone</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">...</span>
              <span className="text-gray-700"><strong>Réservations en attente</strong> - en attente de validation</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">X</span>
              <span className="text-gray-700"><strong>Dates bloquées</strong> - vos indisponibilités par service</span>
            </div>
          </div>
        </div>

        <a
          href={webcalUrl}
          className="block w-full rounded-lg bg-gray-900 py-4 text-center text-lg font-bold text-white shadow-lg transition-colors hover:bg-orange-600"
        >
          Ajouter à Apple Calendar
        </a>
        <p className="-mt-3 text-center text-xs text-gray-400">Cliquez pour ouvrir directement dans Apple Calendar</p>

        <div className="rounded-lg bg-gray-50 p-4">
          <label className="mb-2 block text-xs font-medium text-gray-500">Ou copiez le lien manuellement :</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={httpsUrl}
              className="flex-1 truncate rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-600"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                copied ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-orange-600"
              }`}
            >
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <button
            type="button"
            onClick={rotateToken}
            disabled={rotating}
            className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rotating ? "Renouvellement..." : "Révoquer et générer un nouveau lien"}
          </button>
          {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        <div>
          <h3 className="mb-3 font-bold text-gray-900">Comment l'ajouter :</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600">1</div>
              <div>
                <p className="font-medium text-gray-900">Apple Calendar (Mac)</p>
                <p className="text-sm text-gray-500">Fichier &gt; Nouvel abonnement à un calendrier &gt; collez l'URL</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600">2</div>
              <div>
                <p className="font-medium text-gray-900">Apple Calendar (iPhone)</p>
                <p className="text-sm text-gray-500">Réglages &gt; Calendrier &gt; Comptes &gt; Ajouter un compte &gt; Autre &gt; Abonnement à un calendrier &gt; collez l'URL</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600">3</div>
              <div>
                <p className="font-medium text-gray-900">Google Calendar</p>
                <p className="text-sm text-gray-500">Paramètres &gt; Ajouter un calendrier &gt; À partir d'une URL &gt; collez l'URL</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <span className="text-sm font-bold text-blue-900">Info</span>
          <div className="text-sm text-blue-800">
            <p className="font-bold">Mise à jour automatique</p>
            <p>Apple Calendar re-synchronise le flux environ toutes les 15 minutes. Les nouvelles réservations et changements d'indisponibilité apparaîtront automatiquement.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
