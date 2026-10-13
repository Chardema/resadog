export const LEGAL_INFORMATION = {
  brandName: "La Patte Dorée",
  commercialName: "MM Services",
  ownerName: "Mégane Mélique",
  legalForm: "Entrepreneur individuel",
  publicationDirector: "Mégane Mélique",
  contactEmail: "contact@lapatte-doree.fr",
  privacyEmail: "contact@lapatte-doree.fr",
  phone: "07.71.59.30.16",
  taxStatus: "FRANCHISE_BASE",
  vatMention: "TVA non applicable, article 293 B du Code général des impôts",
  siren: "108 969 825",
  siret: "108 969 825 00018",
  rneRegistrationDate: "3 septembre 2026",
  activityStartDate: "23 août 2026",
  address: "29 boulevard des 100 Arpents, 77600 Bussy-Saint-Georges, France",
  activity:
    "Garde d’animaux à domicile, visites, promenades et soins courants aux animaux confiés",
  excludedActivities: "Actes vétérinaires et toilettage exclus",
  acaced: {
    number: "2026/f9c3-6ee5",
    categories: ["Chien", "Chat"],
    evaluationDate: "3 juin 2026",
    issueDate: "8 juin 2026",
  },
  host: {
    name: "Vercel Inc.",
    address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
    phone: "+1 559 288 7060",
    url: "https://vercel.com",
  },
} as const;

export const LEGAL_DOCUMENT_VERSION = "2026-09-13";
export const LEGAL_DOCUMENT_VERSION_LABEL = "13 septembre 2026";
// Seules les sessions Checkout créées avec cette version déclenchent l'envoi
// automatique d'une facture de réservation. Les anciennes restent intactes.
export const BOOKING_INVOICE_VERSION = "2026-09-06";

export type BusinessTaxStatus = "FRANCHISE_BASE" | "VAT_SUBJECT";

export function getInvoiceLegalFooter() {
  return [
    `${LEGAL_INFORMATION.commercialName} – ${LEGAL_INFORMATION.brandName}`,
    `${LEGAL_INFORMATION.ownerName}, entrepreneur individuel`,
    `SIREN ${LEGAL_INFORMATION.siren} – SIRET ${LEGAL_INFORMATION.siret}`,
    LEGAL_INFORMATION.address,
    LEGAL_INFORMATION.vatMention,
    "Paiement par carte encaissé à la confirmation de la réservation",
    `${LEGAL_INFORMATION.contactEmail} – ${LEGAL_INFORMATION.phone}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
