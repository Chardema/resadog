import React from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { CAT_VISIT_PRICING_DESCRIPTION } from "@/lib/pricing";
import { CAT_VISIT_ACCEPTANCE_TERMS, CAT_VISIT_PAYMENT_TERMS, formatQuoteAmount, formatVisitDate, type CatVisitQuote, type CatVisitQuoteDetails } from "@/lib/cat-visit-quote";

const ink = "#182b35", gold = "#ad711c", muted = "#65717a";
const styles = {
  page: { padding: 34, paddingBottom: 50, fontFamily: "NotoSans", fontSize: 9, lineHeight: 1.4, color: ink },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: gold, paddingBottom: 14, marginBottom: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 40, height: 40 },
  brandName: { fontFamily: "NotoSerif", fontWeight: 700, fontSize: 23, lineHeight: 1.15 },
  tagline: { color: muted, fontSize: 7, lineHeight: 1.4, marginTop: 3 },
  right: { textAlign: "right" },
  title: { fontFamily: "NotoSerif", fontSize: 33, lineHeight: 1.1 },
  eyebrow: { color: gold, fontSize: 7, lineHeight: 1.4, fontFamily: "NotoSans", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  reference: { color: muted, fontSize: 7, lineHeight: 1.4, marginTop: 5 },
  draft: { color: gold, fontSize: 7, lineHeight: 1.4, marginTop: 5 },
  parties: { flexDirection: "row", gap: 24, marginBottom: 18 },
  half: { width: "50%" },
  client: { width: "50%", padding: 12, borderWidth: 0.6, borderColor: "#e8e2d8", borderRadius: 4, backgroundColor: "#fbfaf7" },
  name: { fontFamily: "NotoSans", fontWeight: 700, fontSize: 11, lineHeight: 1.4, marginTop: 6, marginBottom: 4 },
  contact: { marginTop: 7 },
  muted: { color: muted, fontSize: 7.5, lineHeight: 1.4 },
  dates: { borderTopWidth: 0.6, borderTopColor: "#e8e2d8", marginTop: 10, paddingTop: 7, fontSize: 7.5, lineHeight: 1.4 },
  spread: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  service: { marginBottom: 13 },
  serviceTitle: { fontFamily: "NotoSerif", fontWeight: 700, fontSize: 17, lineHeight: 1.25, marginTop: 3, marginBottom: 4 },
  description: { color: muted, fontSize: 8, lineHeight: 1.4, marginTop: 5 },
  petNames: { color: gold, marginTop: 3 },
  tableHead: { flexDirection: "row", backgroundColor: ink, color: "#ffffff", fontSize: 8, lineHeight: 1.4, paddingVertical: 8, paddingHorizontal: 9 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e6e9e9", paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, lineHeight: 1.4 },
  stripe: { backgroundColor: "#fcfcfa" },
  descCol: { width: "49%" }, qtyCol: { width: "9%", textAlign: "center" }, priceCol: { width: "21%", textAlign: "right" },
  summary: { flexDirection: "row", gap: 26, marginTop: 14 },
  included: { width: "50%", fontSize: 8, lineHeight: 1.4 }, totals: { width: "50%" },
  includedText: { marginTop: 6 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, fontSize: 8.5, lineHeight: 1.4 },
  totalBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f5eddd", borderLeftWidth: 2, borderLeftColor: gold, padding: 10, marginTop: 6 },
  bold: { fontFamily: "NotoSans", fontWeight: 700 }, bigTotal: { fontFamily: "NotoSans", fontWeight: 700, fontSize: 23, lineHeight: 1.15 },
  tax: { color: muted, fontSize: 6.5, lineHeight: 1.4, marginTop: 5 },
  notes: { backgroundColor: "#fbfaf7", padding: 10, marginTop: 14, fontSize: 8, lineHeight: 1.4 },
  agreement: { flexDirection: "row", gap: 24, marginTop: 16 },
  terms: { width: "52%", fontSize: 7, lineHeight: 1.4, color: muted },
  paragraph: { marginTop: 5 },
  signature: { width: "48%", borderWidth: 0.6, borderColor: "#d9dfe1", borderRadius: 3, padding: 10, fontSize: 7, lineHeight: 1.4, minHeight: 110 },
  signatureTitle: { fontFamily: "NotoSans", fontWeight: 700, fontSize: 10, lineHeight: 1.4 },
  signatureLabel: { marginTop: 12 },
  footer: { position: "absolute", left: 34, right: 34, top: 801, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.6, borderTopColor: "#d5b582", paddingTop: 8, color: muted, fontSize: 6.5, lineHeight: 1.4 },
} as const;

// Use a fixed creation date so retries attach identical bytes for the same quote.
export async function renderCatVisitQuotePdf(quote: CatVisitQuote, details: CatVisitQuoteDetails) {
  const { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } = await import("@react-pdf/renderer");
  Font.registerHyphenationCallback((word) => [word]);
  Font.register({ family: "NotoSans", fonts: [
    { src: path.join(process.cwd(), "public/fonts/devis/NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public/fonts/devis/NotoSans-Bold.ttf"), fontWeight: 700 },
  ] });
  Font.register({ family: "NotoSerif", fonts: [
    { src: path.join(process.cwd(), "public/fonts/devis/NotoSerif-Regular.ttf") },
    { src: path.join(process.cwd(), "public/fonts/devis/NotoSerif-Bold.ttf"), fontWeight: 700 },
  ] });
  const s = StyleSheet.create(styles);
  const logo = await readFile(path.join(process.cwd(), "public/logo-mark.png"));
  return renderToBuffer(<Document title={`Devis ${details.reference} - La Patte Dorée`} author="MM Services - La Patte Dorée" language="fr-FR" creationDate={new Date(`${details.issuedOn}T12:00:00.000Z`)} modificationDate={new Date(`${details.issuedOn}T12:00:00.000Z`)}>
    <Page size="A4" style={s.page}>
      <View style={s.header} wrap={false}>
        <View style={s.brand}>
          {/* React PDF Image consumes embedded bytes; it is not an HTML image. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={{ data: logo, format: "png" }} style={s.logo} />
          <View><Text style={s.brandName}>La Patte Dorée</Text><Text style={s.tagline}>Des attentions pour vos compagnons.</Text></View>
        </View>
        <View style={s.right}><Text style={s.eyebrow}>Visites à domicile</Text><Text style={s.title}>Devis</Text><Text style={s.reference}>{details.reference}</Text>{!details.clientName || !details.address ? <Text style={s.draft}>Projet à compléter</Text> : null}</View>
      </View>
      <View style={s.parties} wrap={false}>
        <View style={s.half}><Text style={s.eyebrow}>Votre interlocutrice</Text><Text style={s.name}>{LEGAL_INFORMATION.commercialName}</Text><Text>{LEGAL_INFORMATION.ownerName} · Entrepreneur individuel</Text><Text>{LEGAL_INFORMATION.address}</Text><Text style={s.contact}>{LEGAL_INFORMATION.phone}{"\n"}{LEGAL_INFORMATION.contactEmail}</Text><Text style={s.muted}>SIRET {LEGAL_INFORMATION.siret}</Text></View>
        <View style={s.client}><Text style={s.eyebrow}>Préparé pour</Text><Text style={s.name}>{details.clientName || "Nom du client à compléter"}</Text><Text>{details.address || "Adresse de la prestation à confirmer"}</Text><View style={s.dates}><View style={s.spread}><Text>Date du devis</Text><Text>{formatVisitDate(details.issuedOn)}</Text></View><View style={s.spread}><Text>Valable jusqu’au</Text><Text>{formatVisitDate(details.validUntil)}</Text></View></View></View>
      </View>
      <View style={s.service} wrap={false} minPresenceAhead={60}><Text style={s.eyebrow}>La prestation</Text><Text style={s.serviceTitle}>Prendre soin de vos chats, chez vous</Text><Text>{quote.catCount} chat{quote.catCount > 1 ? "s" : ""} · {quote.quantity} visite{quote.quantity > 1 ? "s" : ""} · {quote.durationMinutes} minutes par passage</Text>{details.petNames ? <Text style={s.petNames}>{details.petNames}</Text> : null}<Text style={s.description}>Repas et eau fraîche, entretien courant des litières, présence et jeux selon les besoins, nouvelles après chaque passage.</Text></View>
      <View style={s.tableHead} wrap={false} minPresenceAhead={25}><Text style={s.descCol}>Désignation</Text><Text style={s.qtyCol}>Qté</Text><Text style={s.priceCol}>Prix unitaire</Text><Text style={s.priceCol}>Montant</Text></View>
      {quote.dates.map((date, index) => <View key={date} style={[s.row, ...(index % 2 ? [s.stripe] : [])]} wrap={false}><Text style={s.descCol}>Visite du {formatVisitDate(date)}</Text><Text style={s.qtyCol}>{quote.visitsPerDay}</Text><Text style={s.priceCol}>{formatQuoteAmount(quote.unitPrice)}</Text><Text style={s.priceCol}>{formatQuoteAmount(quote.unitPrice * quote.visitsPerDay)}</Text></View>)}
      <View style={[s.row, s.stripe]} wrap={false}><Text style={s.descCol}>Déplacement{quote.travelTotal === 0 ? " (sans supplément)" : ""}</Text><Text style={s.qtyCol}>{quote.quantity}</Text><Text style={s.priceCol}>{formatQuoteAmount(quote.travelFeePerVisit)}</Text><Text style={s.priceCol}>{formatQuoteAmount(quote.travelTotal)}</Text></View>
      <View style={s.summary} wrap={false}>
        <View style={s.included}><Text style={s.eyebrow}>Le prix comprend</Text><Text style={s.includedText}>{CAT_VISIT_PRICING_DESCRIPTION}</Text><Text style={[s.muted, s.includedText]}>Durée totale sur place : {quote.totalMinutes / 60} h.{"\n"}Tarif hors code promotionnel et avantage Premium.</Text></View>
        <View style={s.totals}><View style={s.totalLine}><Text>Total HT</Text><Text style={s.bold}>{formatQuoteAmount(quote.total)}</Text></View><View style={s.totalLine}><Text>TVA</Text><Text>Non applicable</Text></View><View style={s.totalBox}><Text style={s.bold}>Total à payer</Text><Text style={s.bigTotal}>{formatQuoteAmount(quote.total)}</Text></View><Text style={s.tax}>{LEGAL_INFORMATION.vatMention}.</Text></View>
      </View>
      {details.notes ? <View style={s.notes}><Text style={s.eyebrow}>Précisions convenues</Text><Text style={s.paragraph}>{details.notes}</Text></View> : null}
      <View style={s.agreement} wrap={false}>
        <View style={s.terms}><Text style={s.eyebrow}>Modalités</Text><Text style={s.paragraph}>{CAT_VISIT_PAYMENT_TERMS}</Text><Text style={s.paragraph}>{CAT_VISIT_ACCEPTANCE_TERMS}</Text><Text style={s.paragraph}>Devis établi gratuitement.</Text></View>
        <View style={s.signature}><Text style={s.signatureTitle}>Bon pour accord</Text><Text style={[s.muted, s.paragraph]}>Je reconnais avoir pris connaissance de ce devis et des conditions générales de vente.</Text><Text style={s.signatureLabel}>Date et signature du client</Text></View>
      </View>
      <View style={s.footer} fixed><Text>La Patte Dorée · MM Services · {details.reference}</Text><Text render={({ pageNumber, totalPages }) => `www.lapatte-doree.fr · ${pageNumber}/${totalPages}`} /></View>
    </Page>
  </Document>);
}
