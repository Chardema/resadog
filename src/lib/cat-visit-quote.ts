import { calculateBookingPrice, CAT_VISIT_PRICING_DESCRIPTION } from "@/lib/pricing";
import { addCalendarDays, dateKeyToLocalDate, localDateToDateKey } from "@/lib/booking-dates";
import { LEGAL_INFORMATION } from "@/lib/legal";

export const CAT_VISIT_DURATIONS = [30, 60, 90, 120] as const;

export function isValidVisitDate(value: string) {
  const date = dateKeyToLocalDate(value);
  return Number.isFinite(date.getTime()) && localDateToDateKey(date) === value;
}

export function formatVisitDate(value: string) {
  return dateKeyToLocalDate(value).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function formatQuoteAmount(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function calculateCatVisitQuote(input: {
  catCount: number;
  dates: string[];
  visitsPerDay: number;
  durationMinutes: number;
  travelFeePerVisit: number;
}) {
  const dates = [...new Set(input.dates)].sort();
  if (
    !Number.isInteger(input.catCount) || input.catCount < 1 || input.catCount > 20
    || !Number.isInteger(input.visitsPerDay) || input.visitsPerDay < 1 || input.visitsPerDay > 4
    || !CAT_VISIT_DURATIONS.some((duration) => duration === input.durationMinutes)
    || !Number.isFinite(input.travelFeePerVisit) || input.travelFeePerVisit < 0
    || input.travelFeePerVisit > 1000
    || dates.length === 0 || dates.length > 366 || dates.some((date) => !isValidVisitDate(date))
  ) return null;

  const pets = Array.from({ length: input.catCount }, (_, index) => ({
    id: `quote-cat-${index + 1}`, species: "CAT" as const,
  }));
  const pricing = calculateBookingPrice({
    serviceType: "DROP_IN",
    pets,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    // This estimates a price only; an actual booking requires agreed visit times.
    visitSlots: dates.flatMap((date) => Array.from({ length: input.visitsPerDay }, () => ({
      date, startTime: "", duration: input.durationMinutes,
    }))),
  });
  const travelFeePerVisit = Math.round(input.travelFeePerVisit * 100) / 100;
  const travelTotal = Math.round(travelFeePerVisit * pricing.quantity * 100) / 100;
  return {
    ...input,
    dates,
    travelFeePerVisit,
    quantity: pricing.quantity,
    unitPrice: Math.round(pricing.total / pricing.quantity * 100) / 100,
    serviceTotal: pricing.total,
    travelTotal,
    total: Math.round((pricing.total + travelTotal) * 100) / 100,
    totalMinutes: pricing.quantity * input.durationMinutes,
  };
}

export type CatVisitQuote = NonNullable<ReturnType<typeof calculateCatVisitQuote>>;

export interface CatVisitQuoteDetails {
  clientName: string;
  address: string;
  notes: string;
  issuedOn: string;
  reference: string;
  validUntil: string;
  petNames: string;
}

export function getQuoteValidUntil(issuedOn: string, firstVisit: string, validityDays: number) {
  const limit = addCalendarDays(issuedOn, validityDays);
  return firstVisit && firstVisit < limit ? firstVisit : limit;
}

export const CAT_VISIT_PAYMENT_TERMS = "Règlement par carte bancaire via le site. Autorisation bancaire à la demande, débit après confirmation de la disponibilité.";
export const CAT_VISIT_ACCEPTANCE_TERMS = "Horaires et disponibilités à confirmer avant acceptation. Si la réservation est demandée moins de 24 h avant le premier passage, un supplément unique de 10 € sera ajouté au devis avant acceptation. Tout frais complémentaire nécessite un accord préalable. Conditions générales : www.lapatte-doree.fr/legal/cgv.";

export function buildCatVisitQuoteText(quote: CatVisitQuote, details: CatVisitQuoteDetails) {
  return [
    `DEVIS ${details.reference} — VISITES DE CHATS À DOMICILE`,
    !details.clientName.trim() || !details.address.trim() ? "PROJET — Coordonnées du client à compléter" : "",
    `${LEGAL_INFORMATION.brandName} · ${LEGAL_INFORMATION.commercialName}`,
    `${LEGAL_INFORMATION.ownerName}, ${LEGAL_INFORMATION.legalForm}`,
    `SIRET ${LEGAL_INFORMATION.siret}`,
    LEGAL_INFORMATION.address,
    `${LEGAL_INFORMATION.phone} · ${LEGAL_INFORMATION.contactEmail}`,
    "",
    `Établi le ${formatVisitDate(details.issuedOn)}`,
    `Valable jusqu’au ${formatVisitDate(details.validUntil)}`,
    `Client : ${details.clientName.trim() || "À compléter"}`,
    `Domicile de la prestation : ${details.address.trim() || "À confirmer"}`,
    "",
    `${quote.catCount} chat${quote.catCount > 1 ? "s" : ""} au même domicile`,
    details.petNames.trim() ? `Animaux : ${details.petNames.trim()}` : "",
    `${quote.visitsPerDay} visite${quote.visitsPerDay > 1 ? "s" : ""} par jour sélectionné, ${quote.durationMinutes} minutes par visite pour l’ensemble des chats.`,
    "Horaires à convenir.",
    CAT_VISIT_PRICING_DESCRIPTION,
    "",
    "DATES ET MONTANTS",
    ...quote.dates.map((date) => `${formatVisitDate(date)} : ${quote.visitsPerDay} × ${formatQuoteAmount(quote.unitPrice)} = ${formatQuoteAmount(quote.visitsPerDay * quote.unitPrice)}`),
    "",
    `${quote.quantity} visites × ${formatQuoteAmount(quote.unitPrice)} = ${formatQuoteAmount(quote.serviceTotal)}`,
    quote.travelTotal > 0
      ? `Déplacement : ${quote.quantity} × ${formatQuoteAmount(quote.travelFeePerVisit)} = ${formatQuoteAmount(quote.travelTotal)}`
      : "Déplacement : aucun supplément prévu dans cette estimation.",
    `TOTAL À PAYER : ${formatQuoteAmount(quote.total)}`,
    `${LEGAL_INFORMATION.vatMention}.`,
    "Tarif hors code promotionnel et avantage Premium.",
    "",
    "Repas, eau, entretien courant des litières, présence, jeux et nouvelles après chaque passage selon les consignes convenues.",
    details.notes.trim() ? `Précisions : ${details.notes.trim()}` : "",
    "",
    "Devis établi gratuitement.",
    CAT_VISIT_PAYMENT_TERMS,
    CAT_VISIT_ACCEPTANCE_TERMS,
    "",
    "BON POUR ACCORD — Date et signature du client :",
    "Je reconnais avoir pris connaissance de ce devis et des conditions générales de vente.",
  ].filter((line) => line !== undefined).join("\n");
}
