"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceSettings } from "@/lib/finance";

type Props = { settings: FinanceSettings; onSaved: () => Promise<void> };
const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 disabled:bg-gray-100";

export function FinanceSettingsForm({ settings, onSaved }: Props) {
  const [standard, setStandard] = useState(String(settings.standardRateBps / 100));
  const [enabled, setEnabled] = useState(settings.acreEnabled);
  const [acre, setAcre] = useState(settings.acreRateBps === null ? "" : String(settings.acreRateBps / 100));
  const [start, setStart] = useState(settings.acreStartsOn || "");
  const [end, setEnd] = useState(settings.acreEndsOn || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/revenue/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardRateBps: Math.round(Number(standard) * 100), acreEnabled: enabled,
          acreRateBps: acre === "" ? null : Math.round(Number(acre) * 100), acreStartsOn: start || null, acreEndsOn: end || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      await onSaved();
      setMessage("Réglages enregistrés. Les estimations ont été recalculées.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Enregistrement impossible.");
    } finally { setSaving(false); }
  }

  return (
    <details className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer font-bold text-gray-950">Régler la provision Urssaf et l’ACRE</summary>
      <form onSubmit={save} className="mt-4 space-y-4">
        <p className="max-w-3xl text-sm leading-6 text-gray-600">Le taux proposé de 22 % est une réserve indicative, pas votre taux Urssaf confirmé. Ajustez-le pour couvrir vos cotisations, la contribution formation et, si souhaité, le versement libératoire. Les estimations de l’historique sont recalculées avec ces réglages.</p>
        <label className="block max-w-xs text-sm font-semibold text-gray-800">Taux de provision habituel (%)
          <input aria-label="Taux de provision habituel (%)" className={inputClass} type="number" min="0" max="100" step="0.01" required value={standard} onChange={(event) => setStandard(event.target.value)} />
        </label>
        <label className="flex items-start gap-3 text-sm font-semibold text-gray-800">
          <input className="mt-1 h-4 w-4 accent-emerald-700" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Mon ACRE a été accordée : appliquer une provision différente pendant cette période
        </label>
        <p className="text-xs text-gray-600">Laissez cette option désactivée tant que votre demande n’est pas accordée. Le taux habituel reprend après la date de fin.</p>
        <fieldset disabled={!enabled || saving} className="grid gap-4 sm:grid-cols-3">
          <legend className="sr-only">Période ACRE accordée</legend>
          <label className="text-sm font-semibold text-gray-800">Provision avec ACRE (%)<input className={inputClass} aria-label="Provision avec ACRE (%)" type="number" min="0" max="100" step="0.01" required={enabled} value={acre} onChange={(event) => setAcre(event.target.value)} /></label>
          <label className="text-sm font-semibold text-gray-800">Début de l’ACRE<input className={inputClass} aria-label="Début de l’ACRE" type="date" required={enabled} value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label className="text-sm font-semibold text-gray-800">Fin de l’ACRE incluse<input className={inputClass} aria-label="Fin de l’ACRE incluse" type="date" min={start || undefined} required={enabled} value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        </fieldset>
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm font-semibold text-emerald-700">{message}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
      </form>
    </details>
  );
}
