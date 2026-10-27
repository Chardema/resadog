"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isDropOffService, noShowMessage } from "@/lib/booking-attendance";

type Props = {
  booking: {
    id: string; status: string; startDate: string; endDate: string; startTime?: string | null; endTime?: string | null;
    serviceType: string; totalPrice: number; pets: { name: string }[];
    client: { name: string; email: string; phone?: string | null };
    payment?: { capturedAmount: number } | null;
    noShow?: { contactEvidence: string; lossEvidence: string; reminderSentAt: string; responseDeadline: string } | null;
    notices?: { id: string; kind: string; state: string; sentAt?: string | null; error?: string | null }[];
  };
  onUpdated: () => void;
};
export function BookingAttendanceActions({ booking, onUpdated }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState("");
  const [contact, setContact] = useState("");
  const [loss, setLoss] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [sentAt, setSentAt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [previewAt, setPreviewAt] = useState(new Date(0));
  const notice = booking.notices?.find(n => n.kind === "NO_SHOW");
  const preview = noShowMessage({ ...booking, startDate: new Date(booking.startDate), endDate: new Date(booking.endDate) }, booking.payment?.capturedAmount || 0, previewAt);

  async function submit(retry = false) {
    setWorking(true); setResult("");
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/no-show`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retry && booking.noShow ? { confirmed: true, ...booking.noShow } : {
          confirmed, contactEvidence: contact, lossEvidence: loss, legacyDeadlineAgreed: legacy,
          reminderSentAt: sentAt, responseDeadline: deadline,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Traitement non confirmé");
      setResult(data.sent ? "Réservation annulée sans remboursement. Email accepté par le service d’envoi (livraison à vérifier dans Resend)." : `Réservation annulée. Email non confirmé : ${data.error || "réessayer l’envoi"}`);
      onUpdated(); dialog.current?.close();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Erreur d’envoi");
    } finally { setWorking(false); }
  }
  return <div className="space-y-2">
    {booking.notices?.map(n => <p key={n.id} className="text-xs text-gray-600">{n.kind === "NO_SHOW" ? "Email d’absence" : n.kind === "PICKUP" ? "Rappel de récupération" : "Rappel de réservation"} : {n.state === "SENT" ? "accepté par le service d’envoi" : n.state === "SKIPPED" ? "non envoyé (expiré ou annulé)" : n.state === "FAILED" ? "échec, réessai nécessaire" : "en attente d’envoi"}</p>)}
    {booking.status === "CONFIRMED" && isDropOffService(booking.serviceType) && <Button type="button" variant="outline" className="w-full border-red-300 text-red-800" onClick={() => { setPreviewAt(new Date()); setConfirmed(false); setResult(""); dialog.current?.showModal(); }}>Constater une non-présentation</Button>}
    {booking.noShow && notice?.state !== "SENT" && <Button type="button" variant="outline" disabled={working} onClick={() => submit(true)}>Réessayer l’envoi du mail d’absence</Button>}
    {result && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">{result}</p>}
    <dialog ref={dialog} aria-labelledby={`absence-${booking.id}`} className="fixed inset-0 m-auto max-h-[90vh] w-[min(94vw,720px)] overflow-y-auto rounded-xl p-6 shadow-xl backdrop:bg-black/50" onCancel={e => { if (working) e.preventDefault(); }}>
      <h2 id={`absence-${booking.id}`} className="text-xl font-bold">Non-présentation — examen avant annulation</h2>
      <p className="mt-3 text-sm">Après au moins 30 minutes de retard au dépôt, uniquement si l’animal n’a pas été confié et qu’aucun report n’a été convenu. Envoyez d’abord une relance écrite indiquant un délai raisonnable et l’annulation possible. Ce délai doit être expiré. Pour un séjour de plusieurs jours, examinez les journées restantes séparément.</p>
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-medium">Relance écrite envoyée le (heure de Paris)<input type="datetime-local" value={sentAt} onChange={e => setSentAt(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block text-sm font-medium">Délai de réponse indiqué au client (heure de Paris)<input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block text-sm font-medium">Trace de la relance et vérification des échanges<textarea value={contact} onChange={e => setContact(e.target.value)} maxLength={1500} placeholder="Canal, destinataire, contenu, délai annoncé, appels et absence de réponse. Conservez le message original." className="mt-1 h-24 w-full rounded border p-2" /></label>
        <label className="block text-sm font-medium">Pourquoi la retenue totale correspond-elle au préjudice ?<textarea value={loss} onChange={e => setLoss(e.target.value)} maxLength={1500} placeholder="Temps mobilisé, place non réattribuée, coûts économisés déduits. Si le préjudice est inférieur au paiement, ne pas utiliser cette action : prévoir un remboursement partiel." className="mt-1 h-24 w-full rounded border p-2" /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={legacy} onChange={e => setLegacy(e.target.checked)} />Pour une réservation antérieure au 12 septembre 2026, le client a expressément accepté le délai supplémentaire ; j’en conserve la preuve dans la trace ci-dessus. Une simple absence de réponse ne vaut pas accord.</label>
        <details className="rounded border p-3" open><summary className="cursor-pointer font-bold">Mail qui sera envoyé à {booking.client.email}</summary><p className="mt-3 font-semibold">{preview.subject}</p><p className="mt-3 whitespace-pre-wrap text-sm">{preview.text}</p><p className="mt-2 text-xs text-gray-500">L’heure de constat sera actualisée au moment de la validation.</p></details>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Je confirme l’absence réelle, la relance écrite restée sans réponse, l’expiration du délai, l’absence de report accepté et l’examen des CGV acceptées, du préjudice, de la force majeure et des droits de rétractation. Je valide l’annulation et l’envoi de ce mail sans remboursement ni nouveau débit.</label>
        {result && <p role="alert" className="rounded bg-amber-50 p-3 text-sm">{result}</p>}
        <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={working} onClick={() => dialog.current?.close()}>Retour</Button><Button variant="destructive" disabled={working || !confirmed || contact.trim().length < 20 || loss.trim().length < 20 || !sentAt || !deadline} onClick={() => submit()}>{working ? "Traitement…" : "Annuler sans remboursement et envoyer"}</Button></div>
      </div>
    </dialog>
  </div>;
}
