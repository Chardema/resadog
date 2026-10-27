import { LEGAL_INFORMATION } from "@/lib/legal";
import { formatQuoteAmount, formatVisitDate, type CatVisitQuote, type CatVisitQuoteDetails } from "@/lib/cat-visit-quote";

export function buildCatVisitQuoteMail(quote: CatVisitQuote, details: CatVisitQuoteDetails) {
  const dates = quote.dates.length <= 12
    ? quote.dates.map(formatVisitDate).join(", ")
    : `${quote.dates.length} dates entre le ${formatVisitDate(quote.dates[0])} et le ${formatVisitDate(quote.dates[quote.dates.length - 1])}, détaillées dans le devis`;
  return {
    subject: `Votre devis ${details.reference} - Visites de chats | La Patte Dorée`,
    message: [
      details.clientName.trim() ? `Bonjour ${details.clientName.trim()},` : "Bonjour,",
      "",
      `Vous trouverez en pièce jointe votre devis ${details.reference} pour les visites à domicile de vos chats.`,
      "",
      `${quote.quantity} visite${quote.quantity > 1 ? "s" : ""} de ${quote.durationMinutes} minutes pour ${quote.catCount} chat${quote.catCount > 1 ? "s" : ""}, au tarif total de ${formatQuoteAmount(quote.total)}.`,
      `Dates prévues : ${dates}.`,
      `Ce devis est valable jusqu’au ${formatVisitDate(details.validUntil)}.`,
      "",
      "Si cette proposition vous convient, vous pouvez me répondre pour convenir des horaires et finaliser la réservation, sous réserve des disponibilités.",
      "Je reste à votre disposition pour toute question.",
      "",
      "Bien cordialement,",
      "Mégane",
      `${LEGAL_INFORMATION.brandName} · ${LEGAL_INFORMATION.commercialName}`,
      LEGAL_INFORMATION.phone,
    ].join("\n"),
  };
}
