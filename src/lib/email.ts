import { Resend, type CreateEmailOptions } from 'resend';
import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { GOOGLE_REVIEW_URL } from "@/lib/google-reviews";
import { getServiceDisplayPrice } from "@/lib/pricing";
import { LEGAL_INFORMATION } from "@/lib/legal";
import {
  WELCOME_OFFER_CODE,
  WELCOME_OFFER_DISCOUNT_PERCENT,
  WELCOME_OFFER_MAX_CLIENTS,
} from "@/lib/welcome-offer";

let resend: Resend | null | undefined;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'christo59@pm.me';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || LEGAL_INFORMATION.contactEmail;
const DEV_EMAIL = process.env.DEV_EMAIL || 'christo59@pm.me';
const APP_URL = process.env.NEXTAUTH_URL || 'https://resadog.vercel.app';
const EMAIL_FROM = process.env.RESEND_FROM || 'La Patte Dorée <onboarding@resend.dev>';
const BUG_EMAIL_FROM = process.env.RESEND_BUG_FROM || EMAIL_FROM;
const BOOKING_ADDRESS = LEGAL_INFORMATION.address.replace(", France", "");
const BOOKING_ITEMS_FR = [
  "le panier de votre animal",
  "son jouet",
  "sa gamelle d'eau",
  "sa nourriture si nécessaire",
  "sa laisse pour les sorties",
];
const BOOKING_ITEMS_EN = [
  "your pet's bed or basket",
  "their toy",
  "their water bowl",
  "their food if needed",
  "their leash for walks",
];
const SERVICE_LOCATION =
  process.env.WELCOME_LOCATION ||
  process.env.BUSINESS_ADDRESS ||
  "secteur Val d'Europe, à proximité de Disneyland Paris";
const SERVICE_LOCATION_EN =
  process.env.WELCOME_LOCATION ||
  process.env.BUSINESS_ADDRESS ||
  "Val d'Europe area, near Disneyland Paris";

type EmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  attachments?: CreateEmailOptions["attachments"];
};

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (resend === undefined) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  return resend;
}

// Protection XSS : échapper les caractères HTML dans les données utilisateur
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

async function sendTransactionalEmail(payload: EmailPayload, idempotencyKey?: string) {
  const basePayload = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    replyTo: payload.replyTo,
    ...(payload.attachments ? { attachments: payload.attachments } : {}),
  };

  if (!payload.html && !payload.text) {
    throw new Error("Email HTML ou texte requis.");
  }

  try {
    const resendClient = getResend();
    if (!resendClient) {
      throw new Error("RESEND_API_KEY manquante. Email non envoyé.");
    }

    const emailPayload: CreateEmailOptions = payload.html
      ? {
          ...basePayload,
          html: payload.html,
          ...(payload.text ? { text: payload.text } : {}),
        }
      : {
          ...basePayload,
          text: payload.text as string,
        };

    const result = await resendClient.emails.send(
      emailPayload,
      idempotencyKey
        ? { headers: { "Idempotency-Key": idempotencyKey } }
        : undefined
    );

    if (result.error) {
      throw new Error(getErrorMessage(result.error));
    }

    await recordEmailLog({
      payload,
      idempotencyKey,
      resendId: result.data?.id,
      status: "SENT",
    });

    return result.data;
  } catch (error) {
    await recordEmailLog({
      payload,
      idempotencyKey,
      status: "FAILED",
      error: getErrorMessage(error),
    });
    throw error;
  }
}

export async function sendCatVisitQuoteEmail(input: {
  to: string; subject: string; message: string; reference: string; pdf: Buffer;
}, idempotencyKey: string) {
  return sendTransactionalEmail({
    from: EMAIL_FROM,
    to: input.to,
    replyTo: SUPPORT_EMAIL,
    subject: input.subject,
    text: input.message,
    html: emailLayout({
      preview: input.subject,
      title: "Votre devis de visites à domicile",
      subtitle: `Référence ${input.reference} · PDF en pièce jointe`,
      children: input.message.split(/\n\s*\n/).map((paragraph) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join(""),
    }),
    attachments: [{ filename: `${input.reference.toLowerCase()}.pdf`, content: input.pdf, contentType: "application/pdf" }],
  }, idempotencyKey);
}

async function recordEmailLog({
  payload,
  idempotencyKey,
  resendId,
  status,
  error,
}: {
  payload: EmailPayload;
  idempotencyKey?: string;
  resendId?: string;
  status: "SENT" | "FAILED";
  error?: string;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        resendId,
        status,
        from: payload.from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        idempotencyKey,
        error,
      },
    });
  } catch (logError) {
    console.error("Erreur journalisation email:", logError);
  }
}

function emailLayout({
  preview,
  title,
  subtitle,
  children,
  accent = "#c66a2d",
  bilingualFooter = false,
}: {
  preview: string;
  title: string;
  subtitle: string;
  children: string;
  accent?: string;
  bilingualFooter?: boolean;
}) {
  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(preview)}</title>
      </head>
      <body style="margin:0; padding:0; background:#f7f2ea; font-family:Arial, Helvetica, sans-serif; color:#1f2933;">
        <div style="max-width:640px; margin:0 auto; padding:28px 16px;">
          <div style="background:#ffffff; border:1px solid #eadfce; border-radius:14px; overflow:hidden;">
            <div style="padding:26px 28px; background:#fffaf2; border-bottom:1px solid #eadfce;">
              <p style="margin:0 0 8px; color:${accent}; font-size:13px; font-weight:700;">La Patte Dorée</p>
              <h1 style="margin:0; color:#171717; font-size:24px; line-height:1.3;">${escapeHtml(title)}</h1>
              <p style="margin:10px 0 0; color:#5f6b76; font-size:16px; line-height:1.6;">${escapeHtml(subtitle)}</p>
            </div>
            <div style="padding:26px 28px;">
              ${children}
            </div>
            <div style="padding:18px 28px; background:#171717; color:#f7f2ea;">
              <p style="margin:0; font-size:14px; line-height:1.6;">
                Une question ? Répondez directement à cet email ou écrivez à ${escapeHtml(SUPPORT_EMAIL)}.
              </p>
              ${bilingualFooter ? `
                <p lang="en" style="margin:6px 0 0; font-size:14px; line-height:1.6;">
                  Any questions? Reply to this email or write to ${escapeHtml(SUPPORT_EMAIL)}.
                </p>
              ` : ""}
              <p style="margin:10px 0 0; color:#b7bec7; font-size:12px; line-height:1.5;">
                La Patte Dorée · activité de ${escapeHtml(LEGAL_INFORMATION.commercialName)}, EI · SIREN ${escapeHtml(LEGAL_INFORMATION.siren)}
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function detailRows(rows: { label: string; value: string }[]) {
  return `
    <div style="margin:20px 0; padding:16px 18px; border:1px solid #eadfce; border-radius:10px; background:#fffdf9;">
      ${rows.map((row, index) => `
        <p style="margin:${index === 0 ? "0" : "10px"} 0 0; color:#202124; font-size:15px; line-height:1.5;">
          <strong>${escapeHtml(row.label)} :</strong> ${escapeHtml(row.value)}
        </p>
      `).join("")}
    </div>
  `;
}

function actionButton(label: string, href: string, background = "#171717") {
  return `
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(href)}" style="display:inline-block; background:${background}; color:#ffffff; text-decoration:none; border-radius:8px; padding:12px 16px; font-weight:700; font-size:14px;">
        ${escapeHtml(label)}
      </a>
    </p>
  `;
}

function plainTextEmail({
  title,
  greeting,
  body,
  rows = [],
  url,
  locale = "fr",
}: {
  title: string;
  greeting: string;
  body: string[];
  rows?: { label: string; value: string }[];
  url?: string;
  locale?: "fr" | "en";
}) {
  const urlLabel = locale === "fr" ? "Accéder à mon espace" : "Open my account";
  const supportLine = locale === "fr"
    ? `Pour toute question, répondez à cet email ou écrivez à ${SUPPORT_EMAIL}.`
    : `If you have any questions, reply to this email or write to ${SUPPORT_EMAIL}.`;

  return [
    "La Patte Dorée",
    title,
    "",
    greeting,
    "",
    ...body,
    ...(rows.length > 0
      ? [
          "",
          ...rows.map((row) => `${row.label} : ${row.value}`),
        ]
      : []),
    ...(url ? ["", `${urlLabel}: ${url}`] : []),
    "",
    supportLine,
    `La Patte Dorée · activité de ${LEGAL_INFORMATION.commercialName}, EI · SIREN ${LEGAL_INFORMATION.siren}`,
  ].join("\n");
}

type PlainTextEmailOptions = Parameters<typeof plainTextEmail>[0];

function bilingualPlainTextEmail({
  fr,
  en,
}: {
  fr: Omit<PlainTextEmailOptions, "locale">;
  en: Omit<PlainTextEmailOptions, "locale">;
}) {
  return [
    plainTextEmail({ ...fr, locale: "fr" }),
    "",
    "────────── ENGLISH ──────────",
    "",
    plainTextEmail({ ...en, locale: "en" }),
  ].join("\n");
}

function bilingualEmailLayout({
  previewFr,
  previewEn,
  titleFr,
  titleEn,
  subtitleFr,
  subtitleEn,
  childrenFr,
  childrenEn,
  accent,
}: {
  previewFr: string;
  previewEn: string;
  titleFr: string;
  titleEn: string;
  subtitleFr: string;
  subtitleEn: string;
  childrenFr: string;
  childrenEn: string;
  accent?: string;
}) {
  return emailLayout({
    preview: `${previewFr} / ${previewEn}`,
    title: titleFr,
    subtitle: `${subtitleFr} · English version below`,
    accent,
    bilingualFooter: true,
    children: `
      <section lang="fr">
        ${childrenFr}
      </section>
      <div style="margin:32px 0; border-top:2px solid #eadfce;"></div>
      <section lang="en">
        <h2 style="margin:0; color:#171717; font-size:22px; line-height:1.3;">${escapeHtml(titleEn)}</h2>
        <p style="margin:10px 0 22px; color:#5f6b76; font-size:16px; line-height:1.6;">${escapeHtml(subtitleEn)}</p>
        ${childrenEn}
      </section>
    `,
  });
}

function getWelcomeRates() {
  const boarding = getServiceDisplayPrice("BOARDING");
  const dayCare = getServiceDisplayPrice("DAY_CARE");
  const dropIn = getServiceDisplayPrice("DROP_IN");
  const dogWalking = getServiceDisplayPrice("DOG_WALKING");
  const houseSitting = getServiceDisplayPrice("HOUSE_SITTING");

  return {
    fr: [
      { label: "Hébergement familial", value: `chien ${boarding.dogPrice} € · chat ${boarding.catPrice} € / période de 24 h commencée` },
      { label: "Garde à votre domicile", value: `à partir de ${houseSitting.dogPrice} € pour un chien` },
      { label: "Garderie de jour", value: `chien ${dayCare.dogPrice} € · chat ${dayCare.catPrice} € / jour` },
      { label: "Visite à domicile (30 min)", value: `chien ${dropIn.dogPrice} € · chat ${dropIn.catPrice} €` },
      { label: "Promenade (30 min)", value: `chien à partir de ${dogWalking.dogPrice} €` },
    ],
    en: [
      { label: "Family boarding", value: `dog €${boarding.dogPrice} · cat €${boarding.catPrice} / started 24-hour period` },
      { label: "Pet sitting in your home", value: `from €${houseSitting.dogPrice} for one dog` },
      { label: "Day care", value: `dog €${dayCare.dogPrice} · cat €${dayCare.catPrice} / day` },
      { label: "Home visit (30 min)", value: `dog €${dropIn.dogPrice} · cat €${dropIn.catPrice}` },
      { label: "Dog walk (30 min)", value: `from €${dogWalking.dogPrice}` },
    ],
  };
}

export const sendBookingConfirmationEmail = async (
  email: string,
  userName: string,
  bookingDetails: {
    petName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    serviceLabel?: string;
    bookingId?: string;
    serviceAddress?: string;
  },
  options?: { idempotencyKey?: string }
) => {
  try {
    const rows = [
      ...(bookingDetails.bookingId ? [{ label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Animal", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
      { label: "Statut", value: "Réservation validée" },
      { label: "Début", value: bookingDetails.startDate },
      { label: "Fin", value: bookingDetails.endDate },
      { label: "Adresse", value: bookingDetails.serviceAddress || BOOKING_ADDRESS },
      { label: "Téléphone", value: LEGAL_INFORMATION.phone },
      { label: "Paiement", value: `${formatCurrency(bookingDetails.totalPrice)} € validés` },
    ];
    const rowsEn = [
      ...(bookingDetails.bookingId ? [{ label: "Booking", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Pet", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Service", value: bookingDetails.serviceLabel }] : []),
      { label: "Status", value: "Booking confirmed" },
      { label: "Start", value: bookingDetails.startDate },
      { label: "End", value: bookingDetails.endDate },
      { label: "Address", value: bookingDetails.serviceAddress || BOOKING_ADDRESS },
      { label: "Phone", value: LEGAL_INFORMATION.phone },
      { label: "Payment", value: `€${formatCurrency(bookingDetails.totalPrice)} confirmed` },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Réservation validée / Booking confirmed - La Patte Dorée',
      text: bilingualPlainTextEmail({
        fr: {
          title: "Réservation validée",
          greeting: `Bonjour ${userName},`,
          body: [
            `La garde de ${bookingDetails.petName} est acceptée par l'équipe La Patte Dorée.`,
            "Le paiement associé à cette réservation est maintenant validé.",
            "",
            "À apporter :",
            ...BOOKING_ITEMS_FR.map((item) => `- ${item}`),
            "",
            `Nous vous recontactons si nécessaire avant l'arrivée de ${bookingDetails.petName}.`,
          ],
          rows,
          url: `${APP_URL}/dashboard`,
        },
        en: {
          title: "Booking confirmed",
          greeting: `Hello ${userName},`,
          body: [
            `The booking for ${bookingDetails.petName} has been accepted by the La Patte Dorée team.`,
            "The payment for this booking is now confirmed.",
            "",
            "Please bring:",
            ...BOOKING_ITEMS_EN.map((item) => `- ${item}`),
            "",
            `We will contact you if needed before ${bookingDetails.petName} arrives.`,
          ],
          rows: rowsEn,
          url: `${APP_URL}/dashboard`,
        },
      }),
      html: bilingualEmailLayout({
        previewFr: `La réservation de ${bookingDetails.petName} est validée.`,
        previewEn: `The booking for ${bookingDetails.petName} is confirmed.`,
        titleFr: "Réservation validée",
        titleEn: "Booking confirmed",
        subtitleFr: `Bonjour ${userName}, votre demande est confirmée. Le paiement est maintenant validé.`,
        subtitleEn: `Hello ${userName}, your request is confirmed and payment is now validated.`,
        accent: "#15803d",
        childrenFr: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Bonne nouvelle : la garde de <strong>${escapeHtml(bookingDetails.petName)}</strong> est officiellement acceptée par l'équipe.
          </p>
          ${detailRows(rows)}
          <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#f0fdf4;">
            <p style="margin:0; color:#166534; font-size:15px; font-weight:700; line-height:1.5;">
              À apporter
            </p>
            <ul style="margin:10px 0 0; padding-left:20px; color:#344054; font-size:15px; line-height:1.7;">
              ${BOOKING_ITEMS_FR.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Nous vous recontactons si nécessaire pour caler les derniers détails pratiques avant l'arrivée de ${escapeHtml(bookingDetails.petName)}.
          </p>
          ${actionButton("Voir ma réservation", `${APP_URL}/dashboard`, "#15803d")}
        `,
        childrenEn: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Good news: the booking for <strong>${escapeHtml(bookingDetails.petName)}</strong> has been officially accepted by our team.
          </p>
          ${detailRows(rowsEn)}
          <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#f0fdf4;">
            <p style="margin:0; color:#166534; font-size:15px; font-weight:700; line-height:1.5;">
              Please bring
            </p>
            <ul style="margin:10px 0 0; padding-left:20px; color:#344054; font-size:15px; line-height:1.7;">
              ${BOOKING_ITEMS_EN.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            We will contact you if needed to confirm the final practical details before ${escapeHtml(bookingDetails.petName)} arrives.
          </p>
          ${actionButton("View my booking", `${APP_URL}/dashboard`, "#15803d")}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de confirmation:", error);
    throw error;
  }
};

export const sendBookingInvoiceEmail = async (
  email: string,
  userName: string,
  bookingDetails: {
    petName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    serviceLabel?: string;
    bookingId?: string;
  },
  invoice: {
    number: string;
    amountPaid: number;
    hostedUrl: string;
    pdfUrl?: string;
  },
  options?: { idempotencyKey?: string }
) => {
  const bookingReference = bookingDetails.bookingId
    ? `#${bookingDetails.bookingId.slice(-8).toUpperCase()}`
    : "";
  const rows = [
    { label: "Facture", value: invoice.number },
    ...(bookingReference ? [{ label: "Réservation", value: bookingReference }] : []),
    ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
    { label: "Animal", value: bookingDetails.petName },
    { label: "Période", value: `${bookingDetails.startDate} – ${bookingDetails.endDate}` },
    { label: "Montant acquitté", value: `${formatCurrency(invoice.amountPaid)} €` },
  ];
  const rowsEn = [
    { label: "Invoice", value: invoice.number },
    ...(bookingReference ? [{ label: "Booking", value: bookingReference }] : []),
    ...(bookingDetails.serviceLabel ? [{ label: "Service", value: bookingDetails.serviceLabel }] : []),
    { label: "Pet", value: bookingDetails.petName },
    { label: "Period", value: `${bookingDetails.startDate} – ${bookingDetails.endDate}` },
    { label: "Amount paid", value: `€${formatCurrency(invoice.amountPaid)}` },
  ];

  await sendTransactionalEmail({
    from: EMAIL_FROM,
    to: email,
    subject: `Votre facture ${invoice.number} / Your invoice - La Patte Dorée`,
    text: bilingualPlainTextEmail({
      fr: {
        title: "Votre facture est disponible",
        greeting: `Bonjour ${userName},`,
        body: [
          "Le paiement de votre réservation a bien été encaissé.",
          "Votre facture et son justificatif de paiement sont disponibles depuis le lien sécurisé ci-dessous.",
        ],
        rows,
        url: invoice.hostedUrl,
      },
      en: {
        title: "Your invoice is available",
        greeting: `Hello ${userName},`,
        body: [
          "Payment for your booking has been successfully captured.",
          "Your invoice and payment receipt are available through the secure link below.",
        ],
        rows: rowsEn,
        url: invoice.hostedUrl,
      },
    }),
    html: bilingualEmailLayout({
      previewFr: `Votre facture ${invoice.number} est disponible.`,
      previewEn: `Your invoice ${invoice.number} is available.`,
      titleFr: "Facture et paiement",
      titleEn: "Invoice and payment",
      subtitleFr: "Le paiement de votre réservation a bien été encaissé.",
      subtitleEn: "Payment for your booking has been successfully captured.",
      accent: "#15803d",
      childrenFr: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Votre facture est générée automatiquement au nom de <strong>${escapeHtml(LEGAL_INFORMATION.commercialName)}</strong> après l'encaissement de la réservation.
        </p>
        ${detailRows(rows)}
        ${actionButton("Consulter et télécharger ma facture", invoice.hostedUrl, "#15803d")}
      `,
      childrenEn: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Your invoice is generated automatically for <strong>${escapeHtml(LEGAL_INFORMATION.commercialName)}</strong> after payment is captured.
        </p>
        ${detailRows(rowsEn)}
        ${actionButton("View and download my invoice", invoice.hostedUrl, "#15803d")}
      `,
    }),
    replyTo: SUPPORT_EMAIL,
  }, options?.idempotencyKey);
};

export const sendBookingRequestEmail = async (
  email: string,
  userName: string,
  petName: string,
  bookingDetails?: {
    startDate?: string;
    endDate?: string;
    totalPrice?: number;
    serviceLabel?: string;
    bookingId?: string;
  },
  options?: { idempotencyKey?: string }
) => {
  try {
    const rows = [
      ...(bookingDetails?.bookingId ? [{ label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Animal", value: petName },
      ...(bookingDetails?.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
      { label: "Statut", value: "En attente de validation" },
      ...(bookingDetails?.startDate ? [{ label: "Début", value: bookingDetails.startDate }] : []),
      ...(bookingDetails?.endDate ? [{ label: "Fin", value: bookingDetails.endDate }] : []),
      ...(typeof bookingDetails?.totalPrice === "number"
        ? [{ label: "Paiement", value: `${formatCurrency(bookingDetails.totalPrice)} € en attente de validation` }]
        : []),
    ];
    const rowsEn = [
      ...(bookingDetails?.bookingId ? [{ label: "Booking", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Pet", value: petName },
      ...(bookingDetails?.serviceLabel ? [{ label: "Service", value: bookingDetails.serviceLabel }] : []),
      { label: "Status", value: "Awaiting confirmation" },
      ...(bookingDetails?.startDate ? [{ label: "Start", value: bookingDetails.startDate }] : []),
      ...(bookingDetails?.endDate ? [{ label: "End", value: bookingDetails.endDate }] : []),
      ...(typeof bookingDetails?.totalPrice === "number"
        ? [{ label: "Payment", value: `€${formatCurrency(bookingDetails.totalPrice)} awaiting confirmation` }]
        : []),
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Demande reçue / Booking request received - La Patte Dorée',
      text: bilingualPlainTextEmail({
        fr: {
          title: "Demande de réservation reçue",
          greeting: `Bonjour ${userName},`,
          body: [
            `Nous avons bien reçu votre demande pour ${petName}.`,
            "Elle est en attente de validation par l'équipe La Patte Dorée.",
            "Votre carte n'est pas débitée tant que la réservation n'est pas validée.",
            "Vous recevrez un second email dès que la réservation sera acceptée.",
          ],
          rows,
          url: `${APP_URL}/dashboard`,
        },
        en: {
          title: "Booking request received",
          greeting: `Hello ${userName},`,
          body: [
            `We have received your request for ${petName}.`,
            "It is awaiting confirmation by the La Patte Dorée team.",
            "Your card is not charged until the booking is confirmed.",
            "You will receive another email as soon as the booking is accepted.",
          ],
          rows: rowsEn,
          url: `${APP_URL}/dashboard`,
        },
      }),
      html: bilingualEmailLayout({
        previewFr: `Votre demande pour ${petName} est en attente de validation.`,
        previewEn: `Your request for ${petName} is awaiting confirmation.`,
        titleFr: "Demande reçue",
        titleEn: "Request received",
        subtitleFr: `Bonjour ${userName}, nous avons bien reçu votre demande de réservation.`,
        subtitleEn: `Hello ${userName}, we have received your booking request.`,
        childrenFr: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Votre demande pour <strong>${escapeHtml(petName)}</strong> est en attente de validation par l'équipe.
          </p>
          ${rows.length > 0 ? detailRows(rows) : ""}
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Votre carte n'est pas débitée tant que la réservation n'est pas validée.
          </p>
          <p style="margin:22px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Vous recevrez un second email dès que la réservation sera acceptée.
          </p>
          ${actionButton("Voir mes demandes", `${APP_URL}/dashboard`)}
        `,
        childrenEn: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Your request for <strong>${escapeHtml(petName)}</strong> is awaiting confirmation by our team.
          </p>
          ${rowsEn.length > 0 ? detailRows(rowsEn) : ""}
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Your card is not charged until the booking is confirmed.
          </p>
          <p style="margin:22px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            You will receive another email as soon as the booking is accepted.
          </p>
          ${actionButton("View my requests", `${APP_URL}/dashboard`)}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de demande:", error);
    throw error;
  }
};

export const sendBookingTeamCancellationEmail = async (
  email: string,
  userName: string,
  reason: string,
  bookingDetails: {
    petName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    serviceLabel?: string;
    bookingId?: string;
  },
  options?: {
    idempotencyKey?: string;
    paymentAction?: "NO_PAYMENT" | "AUTHORIZATION_RELEASED" | "REFUND_SUCCEEDED" | "REFUND_PENDING";
    amountRefunded?: number;
  }
) => {
  try {
    const paymentAction = options?.paymentAction || "NO_PAYMENT";
    const refundAmount = options?.amountRefunded || 0;
    const paymentMessage = paymentAction === "AUTHORIZATION_RELEASED"
      ? "L'autorisation bancaire a été libérée : aucun montant ne sera encaissé."
      : paymentAction === "REFUND_SUCCEEDED"
        ? `Le remboursement intégral de ${formatCurrency(refundAmount)} € a été confirmé par Stripe. Selon votre banque, son affichage peut prendre quelques jours.`
        : paymentAction === "REFUND_PENDING"
          ? `Le remboursement intégral de ${formatCurrency(refundAmount)} € a été lancé via Stripe. Selon votre banque, son traitement peut prendre quelques jours.`
          : "Aucun paiement n'a été encaissé pour cette réservation.";
    const paymentMessageEn = paymentAction === "AUTHORIZATION_RELEASED"
      ? "The card authorisation has been released: no payment will be collected."
      : paymentAction === "REFUND_SUCCEEDED"
        ? `Stripe has confirmed the full refund of €${formatCurrency(refundAmount)}. Depending on your bank, it may take a few days to appear.`
        : paymentAction === "REFUND_PENDING"
          ? `The full refund of €${formatCurrency(refundAmount)} has been initiated through Stripe. Depending on your bank, processing may take a few days.`
          : "No payment was collected for this booking.";
    const rows = [
      ...(bookingDetails.bookingId ? [{ label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Animal", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
      { label: "Statut", value: "Annulée par La Patte Dorée" },
      ...(paymentAction === "REFUND_PENDING" || paymentAction === "REFUND_SUCCEEDED"
        ? [{ label: "Statut du remboursement", value: "En cours de traitement par Stripe" }]
        : []),
      { label: "Début", value: bookingDetails.startDate },
      { label: "Fin", value: bookingDetails.endDate },
      { label: "Montant", value: `${formatCurrency(bookingDetails.totalPrice)} €` },
    ];
    const rowsEn = [
      ...(bookingDetails.bookingId ? [{ label: "Booking", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Pet", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Service", value: bookingDetails.serviceLabel }] : []),
      { label: "Status", value: "Cancelled by La Patte Dorée" },
      ...(paymentAction === "REFUND_PENDING" || paymentAction === "REFUND_SUCCEEDED"
        ? [{ label: "Refund status", value: paymentAction === "REFUND_SUCCEEDED" ? "Completed by Stripe" : "Being processed by Stripe" }]
        : []),
      { label: "Start", value: bookingDetails.startDate },
      { label: "End", value: bookingDetails.endDate },
      { label: "Amount", value: `€${formatCurrency(bookingDetails.totalPrice)}` },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: "Réservation annulée / Booking cancelled - La Patte Dorée",
      text: bilingualPlainTextEmail({
        fr: {
          title: "Réservation annulée par La Patte Dorée",
          greeting: `Bonjour ${userName},`,
          body: [
            `Nous devons malheureusement annuler la prestation prévue pour ${bookingDetails.petName}.`,
            `Motif : ${reason}`,
            paymentMessage,
            `Vous pouvez répondre directement à cet email ou nous écrire à ${SUPPORT_EMAIL} si vous souhaitez échanger avec nous ou préparer une autre réservation.`,
          ],
          rows,
          url: `${APP_URL}/dashboard`,
        },
        en: {
          title: "Booking cancelled by La Patte Dorée",
          greeting: `Hello ${userName},`,
          body: [
            `Unfortunately, we have to cancel the service planned for ${bookingDetails.petName}.`,
            `Reason: ${reason}`,
            paymentMessageEn,
            `You can reply to this email or write to ${SUPPORT_EMAIL} if you would like to discuss this with us or arrange another booking.`,
          ],
          rows: rowsEn,
          url: `${APP_URL}/dashboard`,
        },
      }),
      html: bilingualEmailLayout({
        previewFr: `La réservation de ${bookingDetails.petName} a été annulée par notre équipe.`,
        previewEn: `The booking for ${bookingDetails.petName} has been cancelled by our team.`,
        titleFr: "Réservation annulée",
        titleEn: "Booking cancelled",
        subtitleFr: `Bonjour ${userName}, nous devons malheureusement annuler cette prestation.`,
        subtitleEn: `Hello ${userName}, unfortunately we have to cancel this service.`,
        accent: "#b91c1c",
        childrenFr: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Nous devons malheureusement annuler la prestation prévue pour <strong>${escapeHtml(bookingDetails.petName)}</strong>.
          </p>
          ${detailRows(rows)}
          <div style="margin:20px 0 0; padding:16px 18px; border:1px solid #fecaca; border-radius:10px; background:#fef2f2;">
            <p style="margin:0 0 8px; color:#991b1b; font-size:15px; line-height:1.5;"><strong>Motif de l'annulation :</strong></p>
            <p style="margin:0; color:#451a1a; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(reason)}</p>
          </div>
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            ${escapeHtml(paymentMessage)}
          </p>
          <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Vous pouvez répondre directement à cet email ou nous écrire à <strong>${escapeHtml(SUPPORT_EMAIL)}</strong> si vous souhaitez échanger avec nous ou préparer une autre réservation.
          </p>
          ${actionButton("Voir mes réservations", `${APP_URL}/dashboard`, "#b91c1c")}
        `,
        childrenEn: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Unfortunately, we have to cancel the service planned for <strong>${escapeHtml(bookingDetails.petName)}</strong>.
          </p>
          ${detailRows(rowsEn)}
          <div style="margin:20px 0 0; padding:16px 18px; border:1px solid #fecaca; border-radius:10px; background:#fef2f2;">
            <p style="margin:0 0 8px; color:#991b1b; font-size:15px; line-height:1.5;"><strong>Reason for cancellation:</strong></p>
            <p style="margin:0; color:#451a1a; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(reason)}</p>
          </div>
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">${escapeHtml(paymentMessageEn)}</p>
          <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            You can reply to this email or write to <strong>${escapeHtml(SUPPORT_EMAIL)}</strong> if you would like to discuss this with us or arrange another booking.
          </p>
          ${actionButton("View my bookings", `${APP_URL}/dashboard`, "#b91c1c")}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email d'annulation par l'équipe:", error);
    throw error;
  }
};

export const sendBookingRefundCompletedEmail = async (
  email: string,
  userName: string,
  bookingDetails: {
    petName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    serviceLabel?: string;
    bookingId?: string;
  },
  refundDetails: {
    amount: number;
    refundId: string;
  },
  options?: { idempotencyKey?: string }
) => {
  const rows = [
    ...(bookingDetails.bookingId ? [{ label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
    { label: "Animal", value: bookingDetails.petName },
    ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
    { label: "Statut du remboursement", value: "Finalisé par Stripe" },
    { label: "Montant remboursé", value: `${formatCurrency(refundDetails.amount)} €` },
    { label: "Référence Stripe", value: refundDetails.refundId },
  ];
  const rowsEn = [
    ...(bookingDetails.bookingId ? [{ label: "Booking", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
    { label: "Pet", value: bookingDetails.petName },
    ...(bookingDetails.serviceLabel ? [{ label: "Service", value: bookingDetails.serviceLabel }] : []),
    { label: "Refund status", value: "Completed by Stripe" },
    { label: "Amount refunded", value: `€${formatCurrency(refundDetails.amount)}` },
    { label: "Stripe reference", value: refundDetails.refundId },
  ];

  await sendTransactionalEmail({
    from: EMAIL_FROM,
    to: email,
    subject: "Remboursement finalisé / Refund completed - La Patte Dorée",
    text: bilingualPlainTextEmail({
      fr: {
        title: "Remboursement finalisé",
        greeting: `Bonjour ${userName},`,
        body: [
          `Stripe a confirmé le remboursement de ${formatCurrency(refundDetails.amount)} € pour la réservation de ${bookingDetails.petName}.`,
          "Le remboursement a été renvoyé sur le moyen de paiement utilisé lors de la réservation. Son affichage sur votre relevé peut encore prendre quelques jours selon votre banque.",
        ],
        rows,
        url: `${APP_URL}/dashboard`,
      },
      en: {
        title: "Refund completed",
        greeting: `Hello ${userName},`,
        body: [
          `Stripe has confirmed the refund of €${formatCurrency(refundDetails.amount)} for the booking for ${bookingDetails.petName}.`,
          "The refund was returned to the payment method used for the booking. Depending on your bank, it may still take a few days to appear on your statement.",
        ],
        rows: rowsEn,
        url: `${APP_URL}/dashboard`,
      },
    }),
    html: bilingualEmailLayout({
      previewFr: `Votre remboursement de ${formatCurrency(refundDetails.amount)} € est finalisé.`,
      previewEn: `Your €${formatCurrency(refundDetails.amount)} refund is complete.`,
      titleFr: "Remboursement finalisé",
      titleEn: "Refund completed",
      subtitleFr: `Bonjour ${userName}, Stripe a confirmé le remboursement sur votre moyen de paiement d'origine.`,
      subtitleEn: `Hello ${userName}, Stripe has confirmed the refund to your original payment method.`,
      accent: "#15803d",
      childrenFr: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Stripe a confirmé le remboursement de <strong>${escapeHtml(formatCurrency(refundDetails.amount))} €</strong> pour la réservation de <strong>${escapeHtml(bookingDetails.petName)}</strong>.
        </p>
        ${detailRows(rows)}
        <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Le remboursement a été renvoyé sur le moyen de paiement utilisé lors de la réservation. Son affichage sur votre relevé peut encore prendre quelques jours selon votre banque.
        </p>
        <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Une question ? Répondez à cet email ou écrivez-nous à <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.
        </p>
        ${actionButton("Voir mes réservations", `${APP_URL}/dashboard`, "#15803d")}
      `,
      childrenEn: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Stripe has confirmed the refund of <strong>€${escapeHtml(formatCurrency(refundDetails.amount))}</strong> for the booking for <strong>${escapeHtml(bookingDetails.petName)}</strong>.
        </p>
        ${detailRows(rowsEn)}
        <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          The refund was returned to the payment method used for the booking. Depending on your bank, it may still take a few days to appear on your statement.
        </p>
        ${actionButton("View my bookings", `${APP_URL}/dashboard`, "#15803d")}
      `,
    }),
    replyTo: SUPPORT_EMAIL,
  }, options?.idempotencyKey);
};

export const sendSubscriptionRefundCompletedEmail = async (
  email: string,
  userName: string,
  refundDetails: {
    amount: number;
    refundId: string;
  },
  options?: { idempotencyKey?: string }
) => {
  const rows = [
    { label: "Statut du remboursement", value: "Finalisé par Stripe" },
    { label: "Montant remboursé", value: `${formatCurrency(refundDetails.amount)} €` },
    { label: "Abonnement", value: "Premium La Patte Dorée résilié" },
    { label: "Référence Stripe", value: refundDetails.refundId },
  ];
  const rowsEn = [
    { label: "Refund status", value: "Completed by Stripe" },
    { label: "Amount refunded", value: `€${formatCurrency(refundDetails.amount)}` },
    { label: "Subscription", value: "La Patte Dorée Premium cancelled" },
    { label: "Stripe reference", value: refundDetails.refundId },
  ];

  await sendTransactionalEmail({
    from: EMAIL_FROM,
    to: email,
    subject: "Abonnement Premium remboursé / Premium subscription refunded - La Patte Dorée",
    text: bilingualPlainTextEmail({
      fr: {
        title: "Votre abonnement Premium a été remboursé",
        greeting: `Bonjour ${userName},`,
        body: [
          `Stripe a confirmé le remboursement de ${formatCurrency(refundDetails.amount)} € pour votre abonnement Premium La Patte Dorée.`,
          "Le remboursement a été renvoyé sur le moyen de paiement utilisé lors de la souscription. Son affichage sur votre relevé peut encore prendre quelques jours selon votre banque.",
          "Votre abonnement Premium est résilié et aucun nouveau renouvellement ne sera prélevé.",
        ],
        rows,
        url: `${APP_URL}/profile#subscription`,
      },
      en: {
        title: "Your Premium subscription has been refunded",
        greeting: `Hello ${userName},`,
        body: [
          `Stripe has confirmed the €${formatCurrency(refundDetails.amount)} refund for your La Patte Dorée Premium subscription.`,
          "The refund was returned to the payment method used for the subscription. Depending on your bank, it may still take a few days to appear on your statement.",
          "Your Premium subscription has been cancelled and no further renewal will be charged.",
        ],
        rows: rowsEn,
        url: `${APP_URL}/profile#subscription`,
      },
    }),
    html: bilingualEmailLayout({
      previewFr: `Votre abonnement Premium a été remboursé de ${formatCurrency(refundDetails.amount)} €.`,
      previewEn: `Your Premium subscription has been refunded by €${formatCurrency(refundDetails.amount)}.`,
      titleFr: "Abonnement Premium remboursé",
      titleEn: "Premium subscription refunded",
      subtitleFr: `Bonjour ${userName}, Stripe a confirmé le remboursement sur votre moyen de paiement d'origine.`,
      subtitleEn: `Hello ${userName}, Stripe has confirmed the refund to your original payment method.`,
      accent: "#15803d",
      childrenFr: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Stripe a confirmé le remboursement de <strong>${escapeHtml(formatCurrency(refundDetails.amount))} €</strong> pour votre abonnement <strong>Premium La Patte Dorée</strong>.
        </p>
        ${detailRows(rows)}
        <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Le remboursement a été renvoyé sur le moyen de paiement utilisé lors de la souscription. Son affichage sur votre relevé peut encore prendre quelques jours selon votre banque.
        </p>
        <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Votre abonnement Premium est résilié et aucun nouveau renouvellement ne sera prélevé.
        </p>
        <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Une question ? Répondez à cet email ou écrivez-nous à <strong>${escapeHtml(SUPPORT_EMAIL)}</strong>.
        </p>
        ${actionButton("Voir mon profil", `${APP_URL}/profile#subscription`, "#15803d")}
      `,
      childrenEn: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Stripe has confirmed the <strong>€${escapeHtml(formatCurrency(refundDetails.amount))}</strong> refund for your <strong>La Patte Dorée Premium</strong> subscription.
        </p>
        ${detailRows(rowsEn)}
        <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          The refund was returned to the payment method used for the subscription. Depending on your bank, it may still take a few days to appear on your statement.
        </p>
        <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Your Premium subscription has been cancelled and no further renewal will be charged.
        </p>
        ${actionButton("View my profile", `${APP_URL}/profile#subscription`, "#15803d")}
      `,
    }),
    replyTo: SUPPORT_EMAIL,
  }, options?.idempotencyKey);
};

export const sendNewBookingAdminEmail = async (
  bookingDetails: {
    bookingId: string;
    petName: string;
    userName: string;
    userEmail: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    serviceLabel?: string;
  },
  options?: { idempotencyKey?: string }
) => {
  try {
    const rows = [
      { label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` },
      { label: "Client", value: bookingDetails.userName },
      { label: "Email", value: bookingDetails.userEmail },
      { label: "Animal", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
      { label: "Statut", value: "En attente de validation" },
      { label: "Début", value: bookingDetails.startDate },
      { label: "Fin", value: bookingDetails.endDate },
      { label: "Montant", value: `${formatCurrency(bookingDetails.totalPrice)} €` },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `Nouvelle réservation de ${bookingDetails.userName} - ${bookingDetails.petName}`,
      text: plainTextEmail({
        title: "Nouvelle demande de réservation",
        greeting: "Bonjour,",
        body: [
          `${bookingDetails.userName} vient de finaliser une demande pour ${bookingDetails.petName}.`,
          "La réservation est en attente de votre acceptation ou de votre refus.",
        ],
        rows,
        url: `${APP_URL}/admin/bookings`,
      }),
      html: emailLayout({
        preview: `${bookingDetails.userName} attend la validation d'une nouvelle réservation.`,
        title: "Nouvelle réservation à traiter",
        subtitle: `${bookingDetails.userName} vient de finaliser une demande pour ${bookingDetails.petName}.`,
        children: `
          ${detailRows(rows)}
          ${actionButton("Traiter la réservation", `${APP_URL}/admin/bookings`)}
        `,
      }),
      replyTo: bookingDetails.userEmail,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur notification de nouvelle réservation:", error);
    throw error;
  }
};

export const sendSubscriptionPaymentFailedAdminEmail = async (
  userName: string,
  subscriptionId: string,
  price: number
) => {
  try {
    const rows = [
      { label: "Client", value: userName },
      { label: "Abonnement Stripe", value: subscriptionId },
      { label: "Statut", value: "Paiement échoué" },
      { label: "Montant", value: `${formatCurrency(price)} €` },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `Échec de paiement d'abonnement - ${userName}`,
      text: plainTextEmail({
        title: "Échec de paiement d'abonnement",
        greeting: "Bonjour,",
        body: [`Le renouvellement de l'abonnement de ${userName} a échoué.`],
        rows,
        url: `${APP_URL}/admin/clients`,
      }),
      html: emailLayout({
        preview: `Le paiement de l'abonnement de ${userName} a échoué.`,
        title: "Paiement d'abonnement échoué",
        subtitle: `Le renouvellement de l'abonnement de ${userName} nécessite votre attention.`,
        accent: "#b91c1c",
        children: `
          ${detailRows(rows)}
          ${actionButton("Voir les clients", `${APP_URL}/admin/clients`, "#b91c1c")}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    });
  } catch (error) {
    console.error("Erreur notification admin d'échec d'abonnement:", error);
    throw error;
  }
};

export const sendBookingRefundFailedAdminEmail = async (
  details: {
    bookingId: string;
    clientName: string;
    clientEmail: string;
    refundId: string;
    amount: number;
    failureReason: string;
  },
  options?: { idempotencyKey?: string }
) => {
  const rows = [
    { label: "Réservation", value: `#${details.bookingId.slice(-8).toUpperCase()}` },
    { label: "Client", value: details.clientName },
    { label: "Email", value: details.clientEmail },
    { label: "Remboursement Stripe", value: details.refundId },
    { label: "Montant", value: `${formatCurrency(details.amount)} €` },
    { label: "Erreur", value: details.failureReason },
  ];

  await sendTransactionalEmail({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    subject: `Remboursement échoué - ${details.clientName}`,
    text: plainTextEmail({
      title: "Remboursement Stripe échoué",
      greeting: "Bonjour,",
      body: [
        "Stripe n'a pas pu finaliser le remboursement d'une réservation annulée.",
        "Le client doit être recrédité manuellement ou le remboursement doit être relancé depuis Stripe.",
      ],
      rows,
      url: `${APP_URL}/admin/bookings?filter=cancelled`,
    }),
    html: emailLayout({
      preview: `Le remboursement de ${details.clientName} a échoué.`,
      title: "Remboursement à reprendre",
      subtitle: "Stripe n'a pas pu finaliser le remboursement d'une réservation annulée.",
      accent: "#b91c1c",
      children: `
        ${detailRows(rows)}
        <p style="margin:20px 0 0; color:#7f1d1d; font-size:15px; line-height:1.7;">
          Vérifiez le remboursement dans Stripe puis relancez-le ou recréditez le client manuellement.
        </p>
        ${actionButton("Voir les réservations annulées", `${APP_URL}/admin/bookings?filter=cancelled`, "#b91c1c")}
      `,
    }),
    replyTo: details.clientEmail,
  }, options?.idempotencyKey);
};

export const sendBugReport = async (
  userEmail: string | undefined,
  description: string,
  path: string
) => {
  try {
    await sendTransactionalEmail({
      from: BUG_EMAIL_FROM,
      to: DEV_EMAIL,
      subject: 'Rapport de bug - La Patte Dorée',
      text: [
        "Rapport de bug La Patte Dorée",
        "",
        `Utilisateur : ${userEmail || "Anonyme"}`,
        `Page concernée : ${path}`,
        "",
        description,
      ].join("\n"),
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Nouveau signalement de bug</h1>
          <p><strong>Utilisateur :</strong> ${escapeHtml(userEmail || "Anonyme")}</p>
          <p><strong>Page concernée :</strong> ${escapeHtml(path)}</p>

          <div style="background: #fff0f0; padding: 15px; border-radius: 8px; border: 1px solid #ffcccc; margin: 20px 0;">
            <h3>Description :</h3>
            <p style="white-space: pre-wrap;">${escapeHtml(description)}</p>
          </div>
          
          <p><em>Envoyé automatiquement depuis l'application.</em></p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Erreur envoi rapport bug:", error);
    throw error;
  }
};

export const sendPaymentFailedEmail = async (
  email: string,
  userName: string
) => {
  try {
    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Paiement échoué / Payment failed - La Patte Dorée',
      text: bilingualPlainTextEmail({
        fr: {
          title: "Échec de paiement",
          greeting: `Bonjour ${userName},`,
          body: [
            "Le renouvellement de votre abonnement Premium La Patte Dorée a échoué.",
            "Veuillez vérifier votre moyen de paiement pour continuer à bénéficier de vos avantages Premium.",
            "Stripe retentera automatiquement le paiement dans les prochains jours.",
          ],
          url: `${APP_URL}/profile`,
        },
        en: {
          title: "Payment failed",
          greeting: `Hello ${userName},`,
          body: [
            "The renewal payment for your La Patte Dorée Premium subscription failed.",
            "Please check your payment method to keep your Premium benefits.",
            "Stripe will automatically retry the payment over the next few days.",
          ],
          url: `${APP_URL}/profile`,
        },
      }),
      html: bilingualEmailLayout({
        previewFr: "Le paiement de votre abonnement Premium a échoué.",
        previewEn: "Your Premium subscription payment failed.",
        titleFr: "Échec de paiement",
        titleEn: "Payment failed",
        subtitleFr: `Bonjour ${userName}, votre abonnement Premium nécessite votre attention.`,
        subtitleEn: `Hello ${userName}, your Premium subscription needs your attention.`,
        accent: "#b45309",
        childrenFr: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">Le renouvellement de votre abonnement <strong>Premium La Patte Dorée</strong> a échoué.</p>
          <div style="background:#fffbeb; padding:16px 18px; border-radius:10px; border:1px solid #fcd34d; margin:20px 0;">
            <p style="margin:0; color:#92400e; font-size:15px; line-height:1.7;">Stripe retentera automatiquement le paiement dans les prochains jours. Si le problème persiste, vos avantages Premium seront suspendus.</p>
          </div>
          ${actionButton("Mettre à jour mon paiement", `${APP_URL}/profile`, "#b45309")}
        `,
        childrenEn: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">The renewal payment for your <strong>La Patte Dorée Premium</strong> subscription failed.</p>
          <div style="background:#fffbeb; padding:16px 18px; border-radius:10px; border:1px solid #fcd34d; margin:20px 0;">
            <p style="margin:0; color:#92400e; font-size:15px; line-height:1.7;">Stripe will automatically retry the payment over the next few days. If the issue continues, your Premium benefits will be paused.</p>
          </div>
          ${actionButton("Update my payment", `${APP_URL}/profile`, "#b45309")}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    });
  } catch (error) {
    console.error("Erreur envoi email paiement échoué:", error);
    throw error;
  }
};

export const sendWelcomeEmail = async (
  email: string,
  userName: string,
  options?: { idempotencyKey?: string }
) => {
  try {
    const { fr: ratesFr, en: ratesEn } = getWelcomeRates();

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: "Bienvenue chez La Patte Dorée / Welcome to La Patte Dorée",
      text: bilingualPlainTextEmail({
        fr: {
          title: "Bienvenue chez La Patte Dorée",
          greeting: `Bonjour ${userName},`,
          body: [
            "Merci de nous avoir rejoints. La Patte Dorée propose des gardes pour chiens et chats près de Disneyland Paris : garderie de jour, hébergement familial sans box, visites à domicile, garde chez vous et promenades.",
            `Zone / adresse de prise en charge : ${SERVICE_LOCATION}. Pour la garderie et l'hébergement, les détails d'arrivée sont confirmés avec la réservation.`,
            "Comment réserver : 1) ajoutez votre animal et complétez son profil ; 2) choisissez le service et les dates ; 3) vérifiez le tarif puis enregistrez votre carte ; 4) nous validons la demande sous 48 h. Votre carte n'est débitée qu'après acceptation.",
            "À préparer : identification par puce ou tatouage, vaccins à jour, informations de santé et de comportement, habitudes de repas et contact d'urgence.",
            "À savoir pour la garderie et l'hébergement : deux chats vivent à la maison. Si la cohabitation avec votre animal n'est pas sereine, ils restent dans un espace séparé.",
            `Fidélité : chaque euro dépensé rapporte 1 Patte. L'offre ${WELCOME_OFFER_CODE} donne ${WELCOME_OFFER_DISCOUNT_PERCENT} % de réduction sur la première réservation aux ${WELCOME_OFFER_MAX_CLIENTS} premiers nouveaux clients, sous réserve de disponibilité.`,
            "Tarifs de base (le total exact est toujours affiché avant la demande) :",
          ],
          rows: ratesFr,
          url: `${APP_URL}/dashboard`,
        },
        en: {
          title: "Welcome to La Patte Dorée",
          greeting: `Hello ${userName},`,
          body: [
            "Thank you for joining us. La Patte Dorée offers dog and cat care: day care, cage-free family boarding, home visits, pet sitting in your home and dog walking.",
            `Service area / drop-off location: ${SERVICE_LOCATION_EN}. For day care and boarding, arrival details are confirmed with your booking.`,
            "How to book: 1) add your pet and complete their profile; 2) choose the service and dates; 3) review the price and register your card; 4) we confirm your request within 48 hours. Your card is charged only after acceptance.",
            "Please prepare: microchip or tattoo identification, up-to-date vaccinations, health and behaviour information, feeding routine and an emergency contact.",
            "For day care and boarding: two cats live in the house. If they are not comfortable sharing the space with your pet, they are kept in a separate area.",
            `Loyalty: every euro spent earns 1 Paw point. The ${WELCOME_OFFER_CODE} offer gives ${WELCOME_OFFER_DISCOUNT_PERCENT}% off the first booking to the first ${WELCOME_OFFER_MAX_CLIENTS} new clients, subject to availability.`,
            "Base rates (the exact total is always shown before you submit your request):",
          ],
          rows: ratesEn,
          url: `${APP_URL}/dashboard`,
        },
      }),
      html: bilingualEmailLayout({
        previewFr: "Votre espace La Patte Dorée est prêt.",
        previewEn: "Your La Patte Dorée account is ready.",
        titleFr: "Bienvenue chez La Patte Dorée",
        titleEn: "Welcome to La Patte Dorée",
        subtitleFr: `Bonjour ${userName}, merci de nous avoir rejoints.`,
        subtitleEn: `Hello ${userName}, thank you for joining us.`,
        childrenFr: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            La Patte Dorée accueille chiens et chats pour de la garderie de jour, de l'hébergement familial sans box, des visites, de la garde à votre domicile et des promenades.
          </p>
          <div style="margin:20px 0; padding:16px 18px; border-radius:10px; background:#fff7ed; border:1px solid #fed7aa;">
            <p style="margin:0; color:#9a3412; font-size:15px; line-height:1.6;"><strong>Où sommes-nous ?</strong></p>
            <p style="margin:6px 0 0; color:#344054; font-size:15px; line-height:1.7;">${escapeHtml(SERVICE_LOCATION)}. Pour la garderie et l'hébergement, les détails d'arrivée sont confirmés avec la réservation.</p>
          </div>
          <h3 style="margin:24px 0 10px; color:#171717; font-size:18px;">Comment ça marche ?</h3>
          <ol style="margin:0; padding-left:22px; color:#344054; font-size:15px; line-height:1.8;">
            <li>Ajoutez votre animal et complétez son profil.</li>
            <li>Choisissez le service, les dates et vérifiez le tarif.</li>
            <li>Enregistrez votre carte : elle n'est pas débitée à ce stade.</li>
            <li>Nous répondons sous 48 h. Le paiement est validé uniquement si la garde est acceptée.</li>
          </ol>
          ${detailRows(ratesFr)}
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            <strong>Avant la garde :</strong> renseignez l'identification, les vaccins à jour, la santé, le comportement, les repas et un contact d'urgence.
          </p>
          <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#f0f9ff; border:1px solid #bae6fd;">
            <p style="margin:0; color:#0c4a6e; font-size:15px; line-height:1.7;">
              <strong>Deux chats vivent à la maison.</strong> Pour la garderie et l'hébergement, si la cohabitation avec votre animal n'est pas sereine, ils restent dans un espace séparé.
            </p>
          </div>
          <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#ecfdf3; border:1px solid #a7f3d0;">
            <p style="margin:0; color:#166534; font-size:15px; line-height:1.7;">
              <strong>Votre fidélité est récompensée :</strong> 1 € dépensé = 1 Patte. Offre en cours : -${WELCOME_OFFER_DISCOUNT_PERCENT} % sur la première réservation avec <strong>${WELCOME_OFFER_CODE}</strong>, réservée aux ${WELCOME_OFFER_MAX_CLIENTS} premiers nouveaux clients.
            </p>
          </div>
          ${actionButton("Ajouter mon animal", `${APP_URL}/pets/new`, "#c66a2d")}
          ${actionButton("Faire une réservation", `${APP_URL}/booking`)}
        `,
        childrenEn: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            La Patte Dorée cares for dogs and cats through day care, cage-free family boarding, home visits, pet sitting in your home and dog walking.
          </p>
          <div style="margin:20px 0; padding:16px 18px; border-radius:10px; background:#fff7ed; border:1px solid #fed7aa;">
            <p style="margin:0; color:#9a3412; font-size:15px; line-height:1.6;"><strong>Where are we?</strong></p>
            <p style="margin:6px 0 0; color:#344054; font-size:15px; line-height:1.7;">${escapeHtml(SERVICE_LOCATION_EN)}. For day care and boarding, arrival details are confirmed with your booking.</p>
          </div>
          <h3 style="margin:24px 0 10px; color:#171717; font-size:18px;">How does it work?</h3>
          <ol style="margin:0; padding-left:22px; color:#344054; font-size:15px; line-height:1.8;">
            <li>Add your pet and complete their profile.</li>
            <li>Choose a service and dates, then review the price.</li>
            <li>Register your card: it is not charged at this stage.</li>
            <li>We reply within 48 hours. Payment is confirmed only if the booking is accepted.</li>
          </ol>
          ${detailRows(ratesEn)}
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            <strong>Before the booking:</strong> add identification, up-to-date vaccinations, health and behaviour details, feeding instructions and an emergency contact.
          </p>
          <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#f0f9ff; border:1px solid #bae6fd;">
            <p style="margin:0; color:#0c4a6e; font-size:15px; line-height:1.7;">
              <strong>Two cats live in the house.</strong> For day care and boarding, if they are not comfortable sharing the space with your pet, they are kept in a separate area.
            </p>
          </div>
          <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#ecfdf3; border:1px solid #a7f3d0;">
            <p style="margin:0; color:#166534; font-size:15px; line-height:1.7;">
              <strong>Your loyalty is rewarded:</strong> €1 spent = 1 Paw point. Current offer: ${WELCOME_OFFER_DISCOUNT_PERCENT}% off your first booking with <strong>${WELCOME_OFFER_CODE}</strong>, for the first ${WELCOME_OFFER_MAX_CLIENTS} new clients.
            </p>
          </div>
          ${actionButton("Add my pet", `${APP_URL}/pets/new`, "#c66a2d")}
          ${actionButton("Make a booking", `${APP_URL}/booking`)}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de bienvenue:", error);
    throw error;
  }
};

export const sendPetBirthDateProofSubmittedAdminEmail = async ({
  petId,
  petName,
  species,
  birthDate,
  proofUrl,
  userName,
  userEmail,
}: {
  petId: string;
  petName: string;
  species: "DOG" | "CAT";
  birthDate: Date;
  proofUrl: string;
  userName: string;
  userEmail: string;
}) => {
  const proofFingerprint = createHash("sha256")
    .update(`${birthDate.toISOString()}|${proofUrl}`)
    .digest("hex")
    .slice(0, 16);
  const birthDateLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(birthDate);
  const rows = [
    { label: "Client", value: userName },
    { label: "Email", value: userEmail },
    { label: "Animal", value: petName },
    { label: "Espèce", value: species === "DOG" ? "Chien" : "Chat" },
    { label: "Date de naissance déclarée", value: birthDateLabel },
    { label: "Statut", value: "Justificatif en attente de validation" },
  ];

  try {
    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `Justificatif d'âge à valider - ${petName} (${userName})`,
      text: plainTextEmail({
        title: "Nouveau justificatif d'âge à traiter",
        greeting: "Bonjour,",
        body: [
          `${userName} vient d'envoyer un justificatif pour faire valider la date de naissance de ${petName}.`,
          `Ouvrir le justificatif : ${proofUrl}`,
          "Validez le profil depuis l'espace d'administration afin que le client puisse réserver.",
        ],
        rows,
        url: `${APP_URL}/admin/clients`,
      }),
      html: emailLayout({
        preview: `${userName} attend la validation de l'âge de ${petName}.`,
        title: "Justificatif d'âge à traiter",
        subtitle: `${userName} vient d'envoyer un document pour ${petName}.`,
        accent: "#b45309",
        children: `
          ${detailRows(rows)}
          ${actionButton("Ouvrir le justificatif", proofUrl, "#b45309")}
          ${actionButton("Valider dans l'administration", `${APP_URL}/admin/clients`)}
        `,
      }),
      replyTo: userEmail,
    }, `pet-age-proof-submitted-${petId}-${proofFingerprint}`);
  } catch (error) {
    console.error("Erreur notification admin de justificatif d'âge:", error);
    throw error;
  }
};

export const sendPetBirthDateVerifiedEmail = async (
  email: string,
  userName: string,
  petName: string,
  options?: { idempotencyKey?: string }
) => {
  await sendTransactionalEmail({
    from: EMAIL_FROM,
    to: email,
    subject: "Profil validé : vous pouvez réserver / Profile approved: you can book",
    text: bilingualPlainTextEmail({
      fr: {
        title: "Vous pouvez maintenant réserver",
        greeting: `Bonjour ${userName},`,
        body: [
          `La date de naissance de ${petName} a été vérifiée par l'équipe La Patte Dorée. Son profil est désormais validé pour la réservation.`,
          "Vous pouvez dès à présent choisir une prestation et vos dates depuis votre espace.",
        ],
        rows: [{ label: "Animal validé", value: petName }],
        url: `${APP_URL}/booking`,
      },
      en: {
        title: "You can now make a booking",
        greeting: `Hello ${userName},`,
        body: [
          `${petName}'s date of birth has been verified by the La Patte Dorée team. Their profile is now approved for booking.`,
          "You can now choose a service and your preferred dates from your account.",
        ],
        rows: [{ label: "Approved pet", value: petName }],
        url: `${APP_URL}/booking`,
      },
    }),
    html: bilingualEmailLayout({
      previewFr: `Le profil de ${petName} est validé : la réservation est ouverte.`,
      previewEn: `${petName}'s profile is approved: booking is now available.`,
      titleFr: "Vous pouvez maintenant réserver",
      titleEn: "You can now make a booking",
      subtitleFr: `Bonjour ${userName}, le profil de ${petName} est validé.`,
      subtitleEn: `Hello ${userName}, ${petName}'s profile has been approved.`,
      accent: "#15803d",
      childrenFr: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          La date de naissance de <strong>${escapeHtml(petName)}</strong> a été vérifiée par l'équipe La Patte Dorée.
        </p>
        <div style="margin:20px 0; padding:16px 18px; border-radius:10px; background:#ecfdf3; border:1px solid #a7f3d0;">
          <p style="margin:0; color:#166534; font-size:15px; line-height:1.7;">
            <strong>La réservation est désormais ouverte pour ${escapeHtml(petName)}.</strong> Vous pouvez choisir une prestation et vos dates dès maintenant.
          </p>
        </div>
        ${actionButton("Faire une réservation", `${APP_URL}/booking`, "#15803d")}
      `,
      childrenEn: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          <strong>${escapeHtml(petName)}</strong>'s date of birth has been verified by the La Patte Dorée team.
        </p>
        <div style="margin:20px 0; padding:16px 18px; border-radius:10px; background:#ecfdf3; border:1px solid #a7f3d0;">
          <p style="margin:0; color:#166534; font-size:15px; line-height:1.7;">
            <strong>Booking is now available for ${escapeHtml(petName)}.</strong> You can choose a service and your preferred dates now.
          </p>
        </div>
        ${actionButton("Make a booking", `${APP_URL}/booking`, "#15803d")}
      `,
    }),
    replyTo: SUPPORT_EMAIL,
  }, options?.idempotencyKey);
};

export const sendEmailVerificationEmail = async (
  email: string,
  userName: string,
  verificationUrl: string,
  options?: { idempotencyKey?: string }
) => {
  const { fr: ratesFr, en: ratesEn } = getWelcomeRates();

  await sendTransactionalEmail({
    from: EMAIL_FROM,
    to: email,
    subject: "Bienvenue : activez votre compte / Welcome: activate your account",
    text: bilingualPlainTextEmail({
      fr: {
        title: "Bienvenue chez La Patte Dorée",
        greeting: `Bonjour ${userName},`,
          body: [
            "Merci d'avoir créé votre compte. Pour commencer, confirmez votre adresse email.",
            `Lien d'activation : ${verificationUrl}`,
            `La Patte Dorée propose de l'hébergement familial, de la garde à votre domicile, de la garderie de jour, des visites et des promenades dans le ${SERVICE_LOCATION}.`,
            "Comment ça marche : complétez le profil de votre animal, choisissez un service et vos dates, vérifiez le prix puis envoyez votre demande. Nous répondons sous 48 h et votre carte n'est débitée qu'après acceptation.",
            "Votre animal doit être identifié, à jour de ses vaccins et son profil doit préciser ses besoins de santé, de comportement et d'alimentation.",
            "À savoir pour la garderie et l'hébergement : deux chats vivent à la maison. Si la cohabitation avec votre animal n'est pas sereine, ils restent dans un espace séparé.",
            `Fidélité : chaque euro dépensé rapporte 1 Patte. L'offre ${WELCOME_OFFER_CODE} donne ${WELCOME_OFFER_DISCOUNT_PERCENT} % de réduction sur la première réservation aux ${WELCOME_OFFER_MAX_CLIENTS} premiers nouveaux clients, sous réserve de disponibilité.`,
            "Tarifs de base (le total exact est toujours affiché avant la demande) :",
            "Ce lien est personnel, utilisable une seule fois et expire dans 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.",
          ],
          rows: ratesFr,
        },
        en: {
        title: "Welcome to La Patte Dorée",
        greeting: `Hello ${userName},`,
          body: [
            "Thank you for creating your account. To get started, please confirm your email address.",
            `Activation link: ${verificationUrl}`,
            `La Patte Dorée offers family boarding, pet sitting in your home, day care, home visits and dog walking in the ${SERVICE_LOCATION_EN}.`,
            "How it works: complete your pet's profile, choose a service and dates, review the price and submit your request. We reply within 48 hours, and your card is charged only after acceptance.",
            "Your pet must be identified, have up-to-date vaccinations, and their profile must include health, behaviour and feeding information.",
            "For day care and boarding: two cats live in the house. If they are not comfortable sharing the space with your pet, they are kept in a separate area.",
            `Loyalty: every euro spent earns 1 Paw point. The ${WELCOME_OFFER_CODE} offer gives ${WELCOME_OFFER_DISCOUNT_PERCENT}% off the first booking to the first ${WELCOME_OFFER_MAX_CLIENTS} new clients, subject to availability.`,
            "Base rates (the exact total is always shown before you submit your request):",
            "This personal, single-use link expires in 24 hours. If you did not create this account, you can ignore this email.",
          ],
          rows: ratesEn,
        },
    }),
    html: bilingualEmailLayout({
      previewFr: "Bienvenue : confirmez votre adresse pour activer votre compte.",
      previewEn: "Welcome: confirm your email to activate your account.",
      titleFr: "Bienvenue — une dernière étape",
      titleEn: "Welcome — one last step",
      subtitleFr: `Bonjour ${userName}, merci d'avoir créé votre compte.`,
      subtitleEn: `Hello ${userName}, thank you for creating your account.`,
      childrenFr: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Confirmez votre adresse pour accéder à votre espace et préparer votre première garde.
        </p>
        ${actionButton("Confirmer mon adresse email", verificationUrl, "#c66a2d")}
        <div style="margin:24px 0 0; padding:16px 18px; border-radius:10px; background:#fff7ed; border:1px solid #fed7aa;">
          <p style="margin:0; color:#9a3412; font-size:15px; line-height:1.6;"><strong>Zone d'intervention et lieu de prise en charge</strong></p>
          <p style="margin:6px 0 0; color:#344054; font-size:15px; line-height:1.7;">Zone / adresse de prise en charge : ${escapeHtml(SERVICE_LOCATION)}. Les détails d'arrivée sont confirmés avec la réservation.</p>
        </div>
        <h3 style="margin:24px 0 10px; color:#171717; font-size:18px;">Réserver en 4 étapes</h3>
        <ol style="margin:0; padding-left:22px; color:#344054; font-size:15px; line-height:1.8;">
          <li>Ajoutez votre animal et complétez son profil.</li>
          <li>Choisissez la prestation et les dates.</li>
          <li>Vérifiez le tarif et enregistrez votre carte sans débit immédiat.</li>
          <li>Nous répondons sous 48 h ; le paiement est validé seulement si la garde est acceptée.</li>
        </ol>
        <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Prévoyez son identification, ses vaccins à jour, ses informations de santé et de comportement, ses habitudes de repas et un contact d'urgence.
        </p>
        <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#f0f9ff; border:1px solid #bae6fd;">
          <p style="margin:0; color:#0c4a6e; font-size:15px; line-height:1.7;">
            <strong>Deux chats vivent à la maison.</strong> Pour la garderie et l'hébergement, si la cohabitation avec votre animal n'est pas sereine, ils restent dans un espace séparé.
          </p>
        </div>
        <h3 style="margin:24px 0 10px; color:#171717; font-size:18px;">Services et tarifs de base</h3>
        ${detailRows(ratesFr)}
        <p style="margin:0; color:#667085; font-size:13px; line-height:1.7;">Le total exact, avec les éventuels suppléments, est toujours affiché avant l'envoi de votre demande.</p>
        <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#ecfdf3; border:1px solid #a7f3d0;">
          <p style="margin:0; color:#166534; font-size:15px; line-height:1.7;">
            <strong>Fidélité :</strong> 1 € dépensé = 1 Patte. Offre en cours : -${WELCOME_OFFER_DISCOUNT_PERCENT} % sur la première réservation avec <strong>${WELCOME_OFFER_CODE}</strong>, réservée aux ${WELCOME_OFFER_MAX_CLIENTS} premiers nouveaux clients.
          </p>
        </div>
        <p style="margin:20px 0 0; color:#667085; font-size:14px; line-height:1.7;">
          Ce lien est personnel, utilisable une seule fois et expire dans 24 heures. Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.
        </p>
      `,
      childrenEn: `
        <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
          Confirm your address to open your account and prepare your first booking.
        </p>
        ${actionButton("Confirm my email address", verificationUrl, "#c66a2d")}
        <div style="margin:24px 0 0; padding:16px 18px; border-radius:10px; background:#fff7ed; border:1px solid #fed7aa;">
          <p style="margin:0; color:#9a3412; font-size:15px; line-height:1.6;"><strong>Service area and drop-off location</strong></p>
          <p style="margin:6px 0 0; color:#344054; font-size:15px; line-height:1.7;">Service area / drop-off location: ${escapeHtml(SERVICE_LOCATION_EN)}. Arrival details are confirmed with your booking.</p>
        </div>
        <h3 style="margin:24px 0 10px; color:#171717; font-size:18px;">Book in 4 steps</h3>
        <ol style="margin:0; padding-left:22px; color:#344054; font-size:15px; line-height:1.8;">
          <li>Add your pet and complete their profile.</li>
          <li>Choose the service and dates.</li>
          <li>Review the price and register your card with no immediate charge.</li>
          <li>We reply within 48 hours; payment is confirmed only if the booking is accepted.</li>
        </ol>
        <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
          Please provide identification, up-to-date vaccinations, health and behaviour details, feeding instructions and an emergency contact.
        </p>
        <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#f0f9ff; border:1px solid #bae6fd;">
          <p style="margin:0; color:#0c4a6e; font-size:15px; line-height:1.7;">
            <strong>Two cats live in the house.</strong> For day care and boarding, if they are not comfortable sharing the space with your pet, they are kept in a separate area.
          </p>
        </div>
        <h3 style="margin:24px 0 10px; color:#171717; font-size:18px;">Services and base rates</h3>
        ${detailRows(ratesEn)}
        <p style="margin:0; color:#667085; font-size:13px; line-height:1.7;">The exact total, including any applicable extras, is always shown before you submit your request.</p>
        <div style="margin:20px 0 0; padding:16px 18px; border-radius:10px; background:#ecfdf3; border:1px solid #a7f3d0;">
          <p style="margin:0; color:#166534; font-size:15px; line-height:1.7;">
            <strong>Loyalty:</strong> €1 spent = 1 Paw point. Current offer: ${WELCOME_OFFER_DISCOUNT_PERCENT}% off your first booking with <strong>${WELCOME_OFFER_CODE}</strong>, for the first ${WELCOME_OFFER_MAX_CLIENTS} new clients.
          </p>
        </div>
        <p style="margin:20px 0 0; color:#667085; font-size:14px; line-height:1.7;">
          This personal, single-use link expires in 24 hours. If you did not create this account, you can ignore this email.
        </p>
      `,
    }),
    replyTo: SUPPORT_EMAIL,
  }, options?.idempotencyKey);
};

export const sendPasswordResetEmail = async (
  email: string,
  userName: string,
  resetUrl: string
) => {
  try {
    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: "Réinitialiser votre mot de passe / Reset your password",
      text: bilingualPlainTextEmail({
        fr: {
          title: "Réinitialisation de mot de passe",
          greeting: `Bonjour ${userName},`,
          body: [
            "Vous avez demandé un nouveau mot de passe.",
            `Lien de réinitialisation : ${resetUrl}`,
            "Ce lien expire dans une heure. Ignorez cet email si vous n'êtes pas à l'origine de la demande.",
          ],
        },
        en: {
          title: "Password reset",
          greeting: `Hello ${userName},`,
          body: [
            "You requested a new password.",
            `Reset link: ${resetUrl}`,
            "This link expires in one hour. If you did not request it, you can ignore this email.",
          ],
        },
      }),
      html: bilingualEmailLayout({
        previewFr: "Choisissez un nouveau mot de passe.",
        previewEn: "Choose a new password.",
        titleFr: "Réinitialiser votre mot de passe",
        titleEn: "Reset your password",
        subtitleFr: `Bonjour ${userName}, vous avez demandé un nouveau mot de passe.`,
        subtitleEn: `Hello ${userName}, you requested a new password.`,
        childrenFr: `
          ${actionButton("Choisir un nouveau mot de passe", resetUrl)}
          <p style="margin:20px 0 0; color:#667085; font-size:14px; line-height:1.7;">Ce lien expire dans une heure. Ignorez cet email si vous n'êtes pas à l'origine de la demande.</p>
        `,
        childrenEn: `
          ${actionButton("Choose a new password", resetUrl)}
          <p style="margin:20px 0 0; color:#667085; font-size:14px; line-height:1.7;">This link expires in one hour. If you did not request it, you can ignore this email.</p>
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    });
  } catch (error) {
    console.error("Email de réinitialisation non envoyé:", error);
    throw error;
  }
};


export async function sendBookingNoticeEmail(notice: { id: string; to: string; subject: string; text: string }) {
  return sendTransactionalEmail({
    from: EMAIL_FROM, to: notice.to, replyTo: SUPPORT_EMAIL,
    subject: notice.subject, text: notice.text,
    html: emailLayout({ preview: notice.subject, title: notice.subject, subtitle: "MM Services — La Patte Dorée",
      children: `<div style="font-size:15px;line-height:1.7;white-space:pre-wrap">${escapeHtml(notice.text)}</div>` }),
  }, notice.id);
}


export function buildGoogleReviewEmail(userName: string, petName: string) {
  const titleFr = "Merci pour votre confiance 🐾";
  const titleEn = "Thank you for trusting me 🐾";
  const fr = [
    `J’espère que vous avez apprécié votre expérience avec La Patte Dorée et que la garde de ${petName || "votre compagnon"} s’est bien passée.`,
    "Merci de m’avoir confié votre compagnon ! Si vous avez quelques minutes, votre retour sur Google me ferait très plaisir. Il m’aide à améliorer mes services et permet à d’autres propriétaires de découvrir La Patte Dorée.",
  ];
  const en = [
    `I hope you enjoyed your experience with La Patte Dorée and that ${petName || "your pet"} had a lovely time in my care.`,
    "Thank you for trusting me with your pet! If you have a few minutes, I would really appreciate hearing about your experience on Google. Your feedback helps me improve my services and helps other pet owners discover La Patte Dorée.",
  ];
  const signFr = "Au plaisir de vous retrouver, vous et votre compagnon !";
  const signEn = "I look forward to seeing you and your pet again!";
  const paragraphs = (lines: string[]) => lines.map(line => `<p style="margin:16px 0;color:#344054;font-size:16px;line-height:1.7;">${escapeHtml(line)}</p>`).join("");
  return {
    subject: "Merci pour votre confiance / Thank you for trusting me 🐾 — La Patte Dorée",
    text: bilingualPlainTextEmail({
      fr: { title: titleFr, greeting: `Bonjour ${userName},`, body: [...fr, `Partager mon expérience sur Google : ${GOOGLE_REVIEW_URL}`, signFr, "Mégane · La Patte Dorée 🐾"] },
      en: { title: titleEn, greeting: `Hello ${userName},`, body: [...en, `Share my experience on Google: ${GOOGLE_REVIEW_URL}`, signEn, "Mégane · La Patte Dorée 🐾"] },
    }),
    html: bilingualEmailLayout({
      previewFr: "Votre retour compte beaucoup pour moi.", previewEn: "Your feedback means a lot to me.",
      titleFr, titleEn, subtitleFr: `Bonjour ${userName},`, subtitleEn: `Hello ${userName},`, accent: "#b7791f",
      childrenFr: paragraphs(fr) + actionButton("Partager mon expérience sur Google", GOOGLE_REVIEW_URL, "#b7791f") + paragraphs([signFr, "Mégane · La Patte Dorée 🐾"]),
      childrenEn: paragraphs(en) + actionButton("Share my experience on Google", GOOGLE_REVIEW_URL, "#b7791f") + paragraphs([signEn, "Mégane · La Patte Dorée 🐾"]),
    }),
  };
}

export async function sendGoogleReviewEmail(email: string, userName: string, petName: string, idempotencyKey: string) {
  return sendTransactionalEmail({ from: EMAIL_FROM, to: email, replyTo: SUPPORT_EMAIL, ...buildGoogleReviewEmail(userName, petName) }, idempotencyKey);
}
