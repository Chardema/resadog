import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { sendBookingInvoiceEmail } from "@/lib/email";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { stripe } from "@/lib/stripe/config";
import {
  BOOKING_INVOICE_VERSION,
  getInvoiceLegalFooter,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_INFORMATION,
} from "@/lib/legal";

function getBookingIds(metadata: Stripe.Metadata | null | undefined) {
  if (!metadata) return [];
  if (metadata.bookingIds) return metadata.bookingIds.split(",").filter(Boolean);
  if (metadata.bookingId) return [metadata.bookingId];
  return [];
}

function getInvoiceLineDescription(booking: {
  id: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  pets: { name: string }[];
  pet: { name: string | null } | null;
}) {
  const details = getBookingEmailDetails(booking);
  const reference = `#${booking.id.slice(-8).toUpperCase()}`;
  const pricingDetail = booking.notes
    ?.split("\n")
    .find((line) => line.startsWith("Détail facturation:"));

  return [
    `${details.serviceLabel} – ${details.petName}`,
    `Réservation ${reference}`,
    `Prestation prévue du ${details.startDate}${booking.startTime ? ` à ${booking.startTime}` : ""} au ${details.endDate}${booking.endTime ? ` à ${booking.endTime}` : ""}`,
    pricingDetail,
  ].filter(Boolean).join(" · ");
}

async function findExistingInvoice(paymentIntentId: string) {
  const result = await stripe.invoices.search({
    query: `metadata['paymentIntentId']:'${paymentIntentId}'`,
    limit: 1,
  });
  return result.data[0] || null;
}

/**
 * Génère une facture seulement après la capture effective d'une nouvelle réservation.
 * La facture réutilise le PaymentIntent déjà encaissé : aucun second débit n'est créé.
 */
export async function ensureBookingInvoice(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata.bookingInvoiceVersion !== BOOKING_INVOICE_VERSION) return null;
  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Facture impossible avant encaissement (${paymentIntent.id}: ${paymentIntent.status})`);
  }

  const bookingIds = getBookingIds(paymentIntent.metadata);
  if (bookingIds.length !== 1) {
    throw new Error(`La facturation automatique attend exactement une réservation (${paymentIntent.id})`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingIds[0] },
    include: { client: true, pets: true, pet: true },
  });
  if (!booking) throw new Error(`Réservation ${bookingIds[0]} introuvable pour ${paymentIntent.id}`);

  const customerId = typeof paymentIntent.customer === "string"
    ? paymentIntent.customer
    : paymentIntent.customer?.id;
  if (!customerId) throw new Error(`Client Stripe absent de ${paymentIntent.id}`);

  const expectedAmount = Math.round(booking.totalPrice * 100);
  if (paymentIntent.amount_received !== expectedAmount) {
    throw new Error(
      `Montant encaissé incohérent pour ${booking.id}: ${paymentIntent.amount_received} au lieu de ${expectedAmount}`
    );
  }

  const idempotencyPrefix = `booking-invoice:${BOOKING_INVOICE_VERSION}:${paymentIntent.id}`;
  const bookingReference = `#${booking.id.slice(-8).toUpperCase()}`;
  let invoice = await findExistingInvoice(paymentIntent.id);

  if (!invoice) {
    invoice = await stripe.invoices.create(
      {
        customer: customerId,
        auto_advance: false,
        collection_method: "charge_automatically",
        pending_invoice_items_behavior: "exclude",
        description: `Facture de la réservation ${bookingReference} – prestation ${LEGAL_INFORMATION.brandName} proposée par ${LEGAL_INFORMATION.commercialName}`,
        footer: getInvoiceLegalFooter(),
        custom_fields: [
          { name: "SIREN", value: LEGAL_INFORMATION.siren },
          { name: "SIRET", value: LEGAL_INFORMATION.siret },
          { name: "Réservation", value: bookingReference },
        ],
        metadata: {
          bookingIds: booking.id,
          bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
          legalVersion: LEGAL_DOCUMENT_VERSION,
          paymentIntentId: paymentIntent.id,
          providerSiren: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
        },
      },
      { idempotencyKey: `${idempotencyPrefix}:create` }
    );

    await stripe.paymentIntents.update(
      paymentIntent.id,
      { metadata: { bookingInvoiceId: invoice.id } },
      { idempotencyKey: `${idempotencyPrefix}:link` }
    );
  }

  if (invoice.status === "draft") {
    const draft = await stripe.invoices.retrieve(invoice.id, { expand: ["lines"] });
    if (draft.lines.data.length === 0) {
      await stripe.invoiceItems.create(
        {
          customer: customerId,
          invoice: draft.id,
          amount: paymentIntent.amount_received,
          currency: paymentIntent.currency,
          description: getInvoiceLineDescription(booking),
          period: {
            start: Math.floor(booking.startDate.getTime() / 1000),
            end: Math.floor(booking.endDate.getTime() / 1000),
          },
          metadata: {
            bookingId: booking.id,
            bookingInvoiceVersion: BOOKING_INVOICE_VERSION,
          },
        },
        { idempotencyKey: `${idempotencyPrefix}:item` }
      );
    }

    invoice = await stripe.invoices.finalizeInvoice(
      invoice.id,
      { auto_advance: false },
      { idempotencyKey: `${idempotencyPrefix}:finalize` }
    );
  }

  if (invoice.status === "open") {
    invoice = await stripe.invoices.attachPayment(
      invoice.id,
      { payment_intent: paymentIntent.id, expand: ["payments"] },
      { idempotencyKey: `${idempotencyPrefix}:attach` }
    );
  }

  if (invoice.status !== "paid") {
    throw new Error(`La facture ${invoice.id} n'est pas acquittée (statut: ${invoice.status})`);
  }

  const completeInvoice = invoice.hosted_invoice_url
    ? invoice
    : await stripe.invoices.retrieve(invoice.id);
  if (!completeInvoice.hosted_invoice_url) {
    throw new Error(`Lien de facture indisponible pour ${invoice.id}`);
  }

  await sendBookingInvoiceEmail(
    booking.client.email,
    booking.client.name || "Client",
    getBookingEmailDetails(booking),
    {
      number: completeInvoice.number || invoice.id,
      amountPaid: completeInvoice.amount_paid / 100,
      hostedUrl: completeInvoice.hosted_invoice_url,
      pdfUrl: completeInvoice.invoice_pdf || undefined,
    },
    { idempotencyKey: `booking-invoice-${invoice.id}-${booking.id}` }
  );

  return completeInvoice;
}
