import { PAYMENT_PLAN_ENABLED } from "@/lib/payment-plan";

export const LEGAL_INFORMATION = {
  brandName: "La Patte Dorée",
  commercialName: "MM Services",
  ownerName: "Mégane Mélique",
  legalForm: "Entrepreneur individuel",
  publicationDirector: "Mégane Mélique",
  contactEmail: "contact@lapatte-doree.fr",
  privacyEmail: "contact@lapatte-doree.fr",
  phone: "07 64 46 12 70",
  phoneE164: "+33764461270",
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

// CGV du plan acompte + solde (spec 07) : publiées seulement quand
// PAYMENT_PLAN_ENABLED vaut true. Mettre la date à jour le jour de l'activation,
// après relecture juridique. Drapeau désactivé : version actuelle inchangée.
export const PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION = "2026-11-27";
export const PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION_LABEL = "27 novembre 2026";
export const LEGAL_DOCUMENT_VERSION = PAYMENT_PLAN_ENABLED ? PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION : "2026-09-13";
export const LEGAL_DOCUMENT_VERSION_LABEL = PAYMENT_PLAN_ENABLED ? PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION_LABEL : "13 septembre 2026";
// Version des CGV qui a introduit l'engagement Premium de trois mois : ne suit
// pas les versions ultérieures des CGV.
export const PREMIUM_COMMITMENT_VERSION_LABEL = "13 septembre 2026";
// Version propre à la politique cookies : la mettre à jour ne change pas la
// version des CGV acceptée lors des paiements (LEGAL_DOCUMENT_VERSION).
export const COOKIES_POLICY_VERSION_LABEL = "16 novembre 2026";
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
