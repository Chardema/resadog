import Image from "next/image";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { CAT_VISIT_PRICING_DESCRIPTION } from "@/lib/pricing";
import {
  CAT_VISIT_ACCEPTANCE_TERMS, CAT_VISIT_PAYMENT_TERMS,
  formatQuoteAmount, formatVisitDate,
  type CatVisitQuote, type CatVisitQuoteDetails,
} from "@/lib/cat-visit-quote";
import styles from "./CatVisitQuoteDocument.module.css";

export function CatVisitQuoteDocument({ quote, details }: { quote: CatVisitQuote; details: CatVisitQuoteDetails }) {
  const draft = !details.clientName.trim() || !details.address.trim();

  return (
    <article className={styles.document} aria-label={`Devis ${details.reference}`} data-no-translate>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/logo-mark.png" width={56} height={56} alt="" unoptimized />
          <div><p className={styles.brandName}>La Patte Dorée</p><p className={styles.tagline}>Des attentions pour vos compagnons.</p></div>
        </div>
        <div className={styles.documentTitle}>
          <p className={styles.eyebrow}>Visites à domicile</p>
          <h2>Devis</h2>
          <p className={styles.reference}>{details.reference}</p>
          {draft ? <span className={styles.draft}>Projet à compléter</span> : null}
        </div>
      </header>

      <div className={styles.parties}>
        <section>
          <h3 className={styles.eyebrow}>Votre interlocutrice</h3>
          <p className={styles.name}>{LEGAL_INFORMATION.commercialName}</p>
          <p>{LEGAL_INFORMATION.ownerName} · Entrepreneur individuel</p>
          <p>{LEGAL_INFORMATION.address}</p>
          <p className={styles.contact}>{LEGAL_INFORMATION.phone}<br />{LEGAL_INFORMATION.contactEmail}</p>
          <p className={styles.muted}>SIRET {LEGAL_INFORMATION.siret}</p>
        </section>
        <section className={styles.client}>
          <h3 className={styles.eyebrow}>Préparé pour</h3>
          <p className={styles.name}>{details.clientName.trim() || "Nom du client à compléter"}</p>
          <p className={styles.address}>{details.address.trim() || "Adresse de la prestation à confirmer"}</p>
          <div className={styles.dates}>
            <p><span>Date du devis</span><strong>{formatVisitDate(details.issuedOn)}</strong></p>
            <p><span>Valable jusqu’au</span><strong>{formatVisitDate(details.validUntil)}</strong></p>
          </div>
        </section>
      </div>

      <section className={styles.service}>
        <p className={styles.eyebrow}>La prestation</p>
        <h3>Prendre soin de vos chats, chez vous</h3>
        <p>{quote.catCount} chat{quote.catCount > 1 ? "s" : ""} · {quote.quantity} visite{quote.quantity > 1 ? "s" : ""} · {quote.durationMinutes} minutes par passage</p>
        {details.petNames.trim() ? <p className={styles.petNames}>{details.petNames.trim()}</p> : null}
        <p className={styles.serviceDescription}>Repas et eau fraîche, entretien courant des litières, présence et jeux selon les besoins, nouvelles après chaque passage.</p>
      </section>

      <table className={styles.table}>
        <caption>Détail des prestations</caption>
        <colgroup><col className={styles.descriptionColumn} /><col className={styles.quantityColumn} /><col className={styles.priceColumn} /><col className={styles.priceColumn} /></colgroup>
        <thead><tr><th scope="col">Désignation</th><th scope="col">Qté</th><th scope="col">Prix unitaire</th><th scope="col">Montant</th></tr></thead>
        <tbody>
          {quote.dates.map((date) => <tr key={date}>
            <td><strong>Visite du {formatVisitDate(date)}</strong></td>
            <td>{quote.visitsPerDay}</td><td>{formatQuoteAmount(quote.unitPrice)}</td><td>{formatQuoteAmount(quote.unitPrice * quote.visitsPerDay)}</td>
          </tr>)}
          <tr className={styles.travelRow}><td><strong>Déplacement</strong><span>{quote.travelTotal > 0 ? "Supplément convenu par passage" : "Aucun supplément de déplacement"}</span></td><td>{quote.quantity}</td><td>{formatQuoteAmount(quote.travelFeePerVisit)}</td><td>{formatQuoteAmount(quote.travelTotal)}</td></tr>
        </tbody>
      </table>

      <div className={styles.summary}>
        <div className={styles.included}>
          <p className={styles.eyebrow}>Le prix comprend</p>
          <p>{CAT_VISIT_PRICING_DESCRIPTION}</p>
          <p className={styles.muted}>Durée totale sur place : {quote.totalMinutes / 60} h.<br />Tarif hors code promotionnel et avantage Premium.</p>
        </div>
        <div className={styles.totals}>
          <p><span>Total HT</span><strong>{formatQuoteAmount(quote.total)}</strong></p>
          <p><span>TVA</span><span>Non applicable</span></p>
          <div className={styles.grandTotal}><span>Total à payer</span><strong>{formatQuoteAmount(quote.total)}</strong></div>
          <p className={styles.taxNote}>{LEGAL_INFORMATION.vatMention}.</p>
        </div>
      </div>

      {details.notes.trim() ? <section className={styles.notes}><h3 className={styles.eyebrow}>Précisions convenues</h3><p>{details.notes.trim()}</p></section> : null}

      <div className={styles.agreement}>
        <section className={styles.terms}>
          <h3 className={styles.eyebrow}>Modalités</h3>
          <p>{CAT_VISIT_PAYMENT_TERMS}</p>
          <p>{CAT_VISIT_ACCEPTANCE_TERMS}</p>
          <p>Devis établi gratuitement.</p>
        </section>
        <section className={styles.signature}>
          <h3>Bon pour accord</h3>
          <p>Je reconnais avoir pris connaissance de ce devis et des conditions générales de vente.</p>
          <p className={styles.signatureLabel}>Date et signature du client</p>
          <div className={styles.signatureSpace} />
        </section>
      </div>

      <footer className={styles.footer}><span>La Patte Dorée · MM Services</span><span>www.lapatte-doree.fr</span></footer>
    </article>
  );
}
