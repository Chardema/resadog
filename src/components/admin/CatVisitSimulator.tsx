"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Cat, Copy, Download, Plus, Printer, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CatVisitQuoteDocument } from "@/components/admin/CatVisitQuoteDocument";
import { CatVisitQuoteEmail } from "@/components/admin/CatVisitQuoteEmail";
import { getTodayDateKey } from "@/lib/booking-dates";
import { CAT_VISIT_PRICING_DESCRIPTION, getServiceDisplayPrice } from "@/lib/pricing";
import {
  buildCatVisitQuoteText, calculateCatVisitQuote, CAT_VISIT_DURATIONS,
  formatQuoteAmount, formatVisitDate, getQuoteValidUntil, isValidVisitDate,
} from "@/lib/cat-visit-quote";

const exampleDates = [17, 19, 22, 24, 26, 29].map((day) => `2026-09-${day}`);
const controlClass = "mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50";

export function CatVisitSimulator() {
  const [catCount, setCatCount] = useState("2");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [visitsPerDay, setVisitsPerDay] = useState(1);
  const [dates, setDates] = useState<string[]>([]);
  const [dateToAdd, setDateToAdd] = useState("");
  const [travelFee, setTravelFee] = useState("0");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [petNames, setPetNames] = useState("");
  const [validityDays, setValidityDays] = useState("30");
  const [reference, setReference] = useState("");
  const [generatedFor, setGeneratedFor] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [feedback, setFeedback] = useState("");
  const quote = calculateCatVisitQuote({
    catCount: Number(catCount), dates, visitsPerDay, durationMinutes,
    travelFeePerVisit: travelFee.trim() === "" ? Number.NaN : Number(travelFee),
  });
  const signature = JSON.stringify({ catCount, dates, durationMinutes, visitsPerDay, travelFee, clientName, address, notes, petNames, validityDays });
  const details = {
    clientName, address, notes, issuedOn, reference, petNames,
    validUntil: getQuoteValidUntil(issuedOn || getTodayDateKey(), quote?.dates[0] || "", Number(validityDays)),
  };
  const validityIsValid = Number.isInteger(Number(validityDays)) && Number(validityDays) >= 1 && Number(validityDays) <= 90;
  const canGenerate = Boolean(quote && validityIsValid && quote.dates[0] >= getTodayDateKey());
  const quoteText = quote && generatedFor === signature
    ? buildCatVisitQuoteText(quote, details)
    : "";

  function addDate() {
    if (!isValidVisitDate(dateToAdd)) {
      setFeedback("Choisissez une date valide.");
      return;
    }
    if (dates.includes(dateToAdd)) {
      setFeedback("Cette date est déjà sélectionnée.");
      return;
    }
    setDates((current) => [...current, dateToAdd].sort());
    setDateToAdd("");
    setFeedback("");
  }

  function loadExample() {
    setCatCount("2");
    setDurationMinutes(30);
    setVisitsPerDay(1);
    setDates(exampleDates);
    setDateToAdd("");
    setTravelFee("0");
    setGeneratedFor("");
    setReference("");
    setFeedback("");
  }

  function generateQuote() {
    if (!canGenerate) return;
    const date = getTodayDateKey();
    setIssuedOn(date);
    if (!reference || issuedOn !== date) setReference(`DEV-${date.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
    setGeneratedFor(signature);
    setFeedback("Devis prêt. Vous pouvez le copier, le télécharger ou l’imprimer.");
  }

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(quoteText);
      setFeedback("Devis copié.");
    } catch {
      setFeedback("Copie indisponible : sélectionnez le texte du devis ou téléchargez-le.");
    }
  }

  function downloadQuote() {
    const url = URL.createObjectURL(new Blob([quoteText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reference.toLowerCase()}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-orange-200 bg-orange-50 p-5">
        <div className="flex items-center gap-2 font-bold text-orange-950"><Cat className="h-5 w-5" aria-hidden="true" />Visites de chats au même domicile</div>
        <p className="mt-2 text-sm leading-6 text-orange-900">À partir de {getServiceDisplayPrice("DROP_IN").catPrice} € pour 30 minutes. {CAT_VISIT_PRICING_DESCRIPTION}</p>
        <button type="button" onClick={loadExample} className={`${actionClass} mt-4`}>Charger l’exemple : 2 chats · 6 visites en septembre 2026</button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-gray-950">Chats et passages</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div><Label htmlFor="cat-visit-count">Nombre de chats</Label><Input id="cat-visit-count" type="number" min="1" max="20" step="1" value={catCount} onChange={(event) => setCatCount(event.target.value)} className="mt-2 h-11" /></div>
            <div><Label htmlFor="cat-visit-duration">Durée de chaque visite</Label><select id="cat-visit-duration" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className={controlClass}>{CAT_VISIT_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}</select></div>
            <div><Label htmlFor="cat-visits-per-day">Visites par jour sélectionné</Label><select id="cat-visits-per-day" value={visitsPerDay} onChange={(event) => setVisitsPerDay(Number(event.target.value))} className={controlClass}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></div>
            <div><Label htmlFor="cat-visit-travel">Déplacement par visite (€)</Label><Input id="cat-visit-travel" type="number" min="0" max="1000" step="0.01" value={travelFee} onChange={(event) => setTravelFee(event.target.value)} className="mt-2 h-11" /><p className="mt-2 text-xs text-gray-500">0 € par défaut. Tout supplément doit être convenu avec le client.</p></div>
          </div>
          <div className="mt-6">
            <Label htmlFor="cat-visit-date">Dates des visites</Label>
            <p className="mt-1 text-sm leading-6 text-gray-600">Ajoutez chaque date souhaitée. Les jours entre ces dates ne sont pas facturés.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input id="cat-visit-date" type="date" value={dateToAdd} onChange={(event) => setDateToAdd(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDate(); } }} className="h-11 min-w-0 flex-1" />
              <button type="button" onClick={addDate} disabled={!dateToAdd || dates.length >= 366} className={actionClass}><Plus className="h-4 w-4" aria-hidden="true" />Ajouter</button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Dates sélectionnées">
              {dates.map((date) => <li key={date}><button type="button" onClick={() => { setDates((current) => current.filter((value) => value !== date)); setFeedback(""); }} aria-label={`Retirer le ${formatVisitDate(date)}`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900 ring-1 ring-orange-200">{formatVisitDate(date)}<X className="h-4 w-4" aria-hidden="true" /></button></li>)}
            </ul>
          </div>
          <div className="mt-6 space-y-5 border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-950">Informations pour le devis</h3>
            <p className="text-xs leading-5 text-gray-500">Complétez le nom et l’adresse pour obtenir un devis prêt à transmettre. Sans ces informations, le document reste un projet.</p>
            <div><Label htmlFor="cat-visit-client">Nom du client</Label><Input id="cat-visit-client" value={clientName} maxLength={160} onChange={(event) => setClientName(event.target.value)} className="mt-2 h-11" /></div>
            <div><Label htmlFor="cat-visit-address">Adresse du client et de la prestation</Label><textarea id="cat-visit-address" value={address} maxLength={300} onChange={(event) => setAddress(event.target.value)} rows={2} placeholder="Numéro et rue, code postal et ville" className={`${controlClass} h-auto py-3`} /></div>
            <div><Label htmlFor="cat-visit-pet-names">Noms des chats (facultatif)</Label><Input id="cat-visit-pet-names" value={petNames} maxLength={200} onChange={(event) => setPetNames(event.target.value)} className="mt-2 h-11" /></div>
            <div><Label htmlFor="cat-visit-validity">Validité du devis (jours)</Label><Input id="cat-visit-validity" type="number" min="1" max="90" step="1" value={validityDays} onChange={(event) => setValidityDays(event.target.value)} className="mt-2 h-11" /><p className="mt-2 text-xs text-gray-500">De 1 à 90 jours, au plus tard jusqu’à la première visite. La référence est attribuée à la génération.</p></div>
            <div><Label htmlFor="cat-visit-notes">Précisions (facultatif)</Label><textarea id="cat-visit-notes" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Consignes particulières, remise des clés…" className={`${controlClass} h-auto py-3`} /></div>
          </div>
        </section>

        <section aria-live="polite" className="min-w-0 self-start rounded-lg bg-gray-950 p-5 text-white sm:p-6">
          {quote ? <>
            <p className="text-sm font-bold text-emerald-300">Total estimé pour tous les chats</p>
            <p className="mt-4 text-5xl font-extrabold tracking-tight">{formatQuoteAmount(quote.total)}</p>
            <p className="mt-3 text-sm leading-6 text-gray-300">{quote.catCount} chat{quote.catCount > 1 ? "s" : ""} · {quote.quantity} visite{quote.quantity > 1 ? "s" : ""} de {quote.durationMinutes} min</p>
            <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-gray-400">Jours sélectionnés</dt><dd>{quote.dates.length}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-gray-400">Visites par jour</dt><dd>{quote.visitsPerDay}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-gray-400">Tarif par visite, tous les chats</dt><dd className="text-right font-bold">{formatQuoteAmount(quote.unitPrice)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-gray-400">Visites</dt><dd className="text-right">{quote.quantity} × {formatQuoteAmount(quote.unitPrice)} = {formatQuoteAmount(quote.serviceTotal)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-gray-400">Déplacement</dt><dd className="text-right">{quote.quantity} × {formatQuoteAmount(quote.travelFeePerVisit)} = {formatQuoteAmount(quote.travelTotal)}</dd></div>
            </dl>
            <button type="button" onClick={generateQuote} disabled={!canGenerate} className="mt-6 min-h-12 w-full rounded-md bg-orange-500 px-4 py-3 font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">Générer le devis</button>
            {!canGenerate ? <p role="alert" className="mt-3 text-sm text-amber-200">Choisissez des dates à venir et une validité entre 1 et 90 jours pour établir le devis.</p> : null}
            <p className="mt-3 text-xs leading-5 text-gray-400">Hors promotions et Premium. La réservation et les horaires restent à confirmer.</p>
          </> : <>
            <h2 className="text-lg font-bold">Préparez votre estimation</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">Ajoutez au moins une date, indiquez de 1 à 20 chats et un montant de déplacement valide pour calculer le tarif.</p>
          </>}
        </section>
      </div>

      <p role="status" className="text-sm font-medium text-orange-900">{generatedFor && generatedFor !== signature ? "Les informations ont changé. Générez à nouveau le devis pour actualiser le document." : feedback}</p>
      {quoteText && quote ? <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-950">Votre devis</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyQuote} className={actionClass}><Copy className="h-4 w-4" aria-hidden="true" />Copier</button>
            <button type="button" onClick={downloadQuote} className={actionClass}><Download className="h-4 w-4" aria-hidden="true" />Télécharger le texte</button>
            <button type="button" onClick={() => window.print()} className={actionClass}><Printer className="h-4 w-4" aria-hidden="true" />Imprimer / PDF</button>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">Téléchargez le devis pour le conserver ou envoyez-le par e-mail ci-dessous. Il ne crée pas de réservation.</p>
        <div className="mt-5 rounded-lg bg-gray-100 py-4 sm:p-6"><CatVisitQuoteDocument quote={quote} details={details} /></div>
        <CatVisitQuoteEmail key={`${reference}-${generatedFor}`} quote={quote} details={details} />
        {createPortal(<div id="cat-visit-print" data-no-translate className="hidden"><CatVisitQuoteDocument quote={quote} details={details} /></div>, document.body)}
      </section> : null}
    </div>
  );
}
