"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Mail, Paperclip, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildCatVisitQuoteMail } from "@/lib/cat-visit-quote-mail";
import { makeCatVisitQuoteRequest } from "@/lib/cat-visit-quote-request";
import type { CatVisitQuote, CatVisitQuoteDetails } from "@/lib/cat-visit-quote";

export function CatVisitQuoteEmail({ quote, details }: { quote: CatVisitQuote; details: CatVisitQuoteDetails }) {
  const defaults = buildCatVisitQuoteMail(quote, details);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaults.subject);
  const [message, setMessage] = useState(defaults.message);
  const [busy, setBusy] = useState<"pdf" | "send" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [sentFor, setSentFor] = useState("");
  const inFlight = useRef(false);
  const signature = JSON.stringify({ to: to.trim(), subject: subject.trim(), message: message.trim() });
  const complete = Boolean(details.clientName.trim() && details.address.trim());
  const sent = sentFor === signature;

  async function act(mode: "pdf" | "send") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(mode); setError(""); setFeedback("");
    try {
      const response = await fetch(`/api/admin/quotes/cat-visits/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: makeCatVisitQuoteRequest(quote, details), ...(mode === "send" ? { mail: { to, subject, message } } : {}) }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "L’opération a échoué. Réessayez.");
      }
      if (mode === "pdf") {
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url; link.download = `${details.reference.toLowerCase()}.pdf`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setFeedback("PDF téléchargé. Ce document sera joint à l’e-mail.");
      } else {
        const result = await response.json();
        setSentFor(signature);
        setFeedback(result.message);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’opération a échoué. Réessayez.");
    } finally { inFlight.current = false; setBusy(null); }
  }

  return <section className="mt-6 rounded-lg border border-orange-200 bg-orange-50/50 p-5 sm:p-6" aria-labelledby="cat-quote-email-title" data-no-translate>
    <h3 id="cat-quote-email-title" className="flex items-center gap-2 text-lg font-bold text-gray-950"><Mail className="h-5 w-5 text-orange-600" aria-hidden="true" />Envoyer le devis par e-mail</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Relisez le destinataire et le message avant l’envoi. Le devis PDF est joint automatiquement ; les réponses arrivent à La Patte Dorée.</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-800"><Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-all">{details.reference.toLowerCase()}.pdf</span></p>
      <button type="button" disabled={busy !== null} onClick={() => act("pdf")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-bold hover:bg-gray-50 disabled:opacity-50">{busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Télécharger le PDF</button>
    </div>
    {!complete ? <p className="mt-4 text-sm font-medium text-orange-900">Complétez le nom et l’adresse du client puis générez à nouveau le devis pour pouvoir l’envoyer.</p> : null}
    <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); if (complete && !sent) void act("send"); }}>
      <fieldset disabled={busy !== null} className="space-y-4 disabled:opacity-60">
        <div><Label htmlFor="cat-quote-email-to">E-mail du destinataire</Label><Input id="cat-quote-email-to" type="email" autoComplete="email" required maxLength={254} value={to} onChange={(event) => { setTo(event.target.value); setFeedback(""); }} className="mt-2 h-11 bg-white" /></div>
        <div><Label htmlFor="cat-quote-email-subject">Objet de l’e-mail</Label><Input id="cat-quote-email-subject" required maxLength={200} value={subject} onChange={(event) => { setSubject(event.target.value); setFeedback(""); }} className="mt-2 h-11 bg-white" /></div>
        <div><Label htmlFor="cat-quote-email-message">Message</Label><textarea id="cat-quote-email-message" required maxLength={6000} rows={14} value={message} onChange={(event) => { setMessage(event.target.value); setFeedback(""); }} className="mt-2 w-full rounded-md border border-gray-300 bg-white p-3 text-sm leading-6 text-gray-950" /></div>
        <button type="submit" disabled={!complete || !to.trim() || !subject.trim() || !message.trim() || sent} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-orange-600 px-5 py-3 font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}{busy === "send" ? "Envoi en cours…" : sent ? "Devis envoyé" : "Envoyer l’e-mail avec le devis"}</button>
      </fieldset>
    </form>
    {feedback ? <p role="status" className="mt-4 text-sm font-medium text-green-800">{feedback}</p> : null}
    {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
  </section>;
}
