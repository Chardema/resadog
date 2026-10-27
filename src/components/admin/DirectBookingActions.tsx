"use client";
import { useState } from "react";
import { getTodayDateKey } from "@/lib/booking-dates";
export function DirectBookingActions({ booking, onUpdated }: { booking: { id: string; status: string; totalPrice: number; payment?: { status: string } | null }; onUpdated: () => Promise<void> }) {
  const [action, setAction] = useState<"PAID" | "CANCEL" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = booking.payment?.status === "SUCCEEDED";
  if (booking.status === "CANCELLED") return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/bookings/direct/${booking.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reference: data.get("reference"), date: data.get("date"), refunded: data.get("refunded") === "on" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Modification impossible.");
      await onUpdated(); setAction(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Modification impossible."); } finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3" data-no-translate>
    <p className="text-sm font-bold">Réservation directe</p>
    {!action && <div className="flex flex-wrap gap-2">
      {booking.payment?.status === "PENDING" && <button className="rounded border bg-white px-3 py-2 text-sm font-semibold" onClick={() => setAction("PAID")}>Enregistrer le paiement reçu</button>}
      {["CONFIRMED", "IN_PROGRESS"].includes(booking.status) && <button className="rounded border bg-white px-3 py-2 text-sm font-semibold text-red-700" onClick={() => setAction("CANCEL")}>Annuler la garde directe</button>}
    </div>}
    {action && <form onSubmit={submit} className="space-y-3">
      <p className="text-sm">{action === "PAID" ? `Enregistrer ${booking.totalPrice.toFixed(2)} € réellement reçus.` : paid ? `Annuler après remboursement intégral des ${booking.totalPrice.toFixed(2)} € au client.` : "Annuler la garde et le paiement à recevoir."} Aucun transfert ni message automatique.</p>
      <label className="block text-sm">{action === "PAID" ? "Date d’encaissement" : paid ? "Date du remboursement" : "Date de l’annulation"}<input className="mt-1 w-full rounded border bg-white p-2" name="date" type="date" defaultValue={getTodayDateKey()} max={getTodayDateKey()} required disabled={busy}/></label>
      <label className="block text-sm">{action === "PAID" ? "Référence du paiement / reçu" : "Motif et trace de l’échange avec le client"}<textarea name="reference" required minLength={5} maxLength={500} className="mt-1 w-full rounded border bg-white p-2" disabled={busy}/></label>
      {action === "CANCEL" && paid && <label className="flex gap-2 text-sm"><input type="checkbox" name="refunded" required disabled={busy}/>J’ai déjà remboursé la totalité au client.</label>}
      <div className="flex gap-2"><button disabled={busy} className="rounded bg-orange-700 px-3 py-2 text-sm font-bold text-white">{busy ? "Enregistrement…" : "Valider l’enregistrement"}</button><button type="button" disabled={busy} onClick={() => { setAction(null); setError(""); }} className="rounded border bg-white px-3 py-2 text-sm">Fermer</button></div>
    </form>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>;
}
