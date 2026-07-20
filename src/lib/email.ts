import { Resend, type CreateEmailOptions } from 'resend';
import { prisma } from "@/lib/db/prisma";
import { GOOGLE_REVIEW_URL } from "@/lib/google-reviews";

let resend: Resend | null | undefined;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'christo59@pm.me';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || ADMIN_EMAIL;
const DEV_EMAIL = process.env.DEV_EMAIL || 'christo59@pm.me';
const APP_URL = process.env.NEXTAUTH_URL || 'https://resadog.vercel.app';
const EMAIL_FROM = process.env.RESEND_FROM || 'La Patte Dorée <onboarding@resend.dev>';
const BUG_EMAIL_FROM = process.env.RESEND_BUG_FROM || EMAIL_FROM;

type EmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
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
}: {
  preview: string;
  title: string;
  subtitle: string;
  children: string;
  accent?: string;
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
}: {
  title: string;
  greeting: string;
  body: string[];
  rows?: { label: string; value: string }[];
  url?: string;
}) {
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
    ...(url ? ["", `Accéder à mon espace : ${url}`] : []),
    "",
    `Pour toute question, répondez à cet email ou écrivez à ${SUPPORT_EMAIL}.`,
  ].join("\n");
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
      { label: "Paiement", value: `${formatCurrency(bookingDetails.totalPrice)} € validés` },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Votre réservation est validée - La Patte Dorée',
      text: plainTextEmail({
        title: "Réservation validée",
        greeting: `Bonjour ${userName},`,
        body: [
          `La garde de ${bookingDetails.petName} est acceptée par l'équipe La Patte Dorée.`,
          "Le paiement associé à cette réservation est maintenant validé.",
          `Nous vous recontactons si nécessaire avant l'arrivée de ${bookingDetails.petName}.`,
        ],
        rows,
        url: `${APP_URL}/dashboard`,
      }),
      html: emailLayout({
        preview: `La réservation de ${bookingDetails.petName} est validée.`,
        title: "Réservation validée",
        subtitle: `Bonjour ${userName}, votre demande est confirmée. Le paiement est maintenant validé.`,
        accent: "#15803d",
        children: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Bonne nouvelle : la garde de <strong>${escapeHtml(bookingDetails.petName)}</strong> est officiellement acceptée par l'équipe.
          </p>
          ${detailRows(rows)}
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Nous vous recontactons si nécessaire pour caler les derniers détails pratiques avant l'arrivée de ${escapeHtml(bookingDetails.petName)}.
          </p>
          ${actionButton("Voir ma réservation", `${APP_URL}/dashboard`, "#15803d")}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de confirmation:", error);
    throw error;
  }
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

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Votre demande de réservation La Patte Dorée',
      text: plainTextEmail({
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
      }),
      html: emailLayout({
        preview: `Votre demande pour ${petName} est en attente de validation.`,
        title: "Demande reçue",
        subtitle: `Bonjour ${userName}, nous avons bien reçu votre demande de réservation.`,
        children: `
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
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de demande:", error);
    throw error;
  }
};

export const sendBookingRejectionEmail = async (
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
  options?: { idempotencyKey?: string }
) => {
  try {
    const rows = [
      ...(bookingDetails.bookingId ? [{ label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Animal", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
      { label: "Statut", value: "Demande refusée" },
      { label: "Début", value: bookingDetails.startDate },
      { label: "Fin", value: bookingDetails.endDate },
      { label: "Montant", value: `${formatCurrency(bookingDetails.totalPrice)} €` },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: "Votre demande de réservation n'a pas pu être acceptée - La Patte Dorée",
      text: plainTextEmail({
        title: "Demande de réservation refusée",
        greeting: `Bonjour ${userName},`,
        body: [
          `Nous ne pouvons malheureusement pas accepter votre demande pour ${bookingDetails.petName}.`,
          `Motif : ${reason}`,
          "Aucun paiement ne sera conservé pour cette demande. Selon votre banque, la libération d'une empreinte ou l'affichage d'un remboursement peut prendre quelques jours.",
          "Vous pouvez répondre directement à cet email si vous souhaitez échanger avec nous ou préparer une autre réservation.",
        ],
        rows,
        url: `${APP_URL}/dashboard`,
      }),
      html: emailLayout({
        preview: `Votre demande pour ${bookingDetails.petName} n'a pas pu être acceptée.`,
        title: "Demande non acceptée",
        subtitle: `Bonjour ${userName}, nous ne pouvons malheureusement pas valider cette réservation.`,
        accent: "#b91c1c",
        children: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Nous ne pouvons malheureusement pas accepter votre demande pour <strong>${escapeHtml(bookingDetails.petName)}</strong>.
          </p>
          ${detailRows(rows)}
          <div style="margin:20px 0 0; padding:16px 18px; border:1px solid #fecaca; border-radius:10px; background:#fef2f2;">
            <p style="margin:0 0 8px; color:#991b1b; font-size:15px; line-height:1.5;"><strong>Motif du refus :</strong></p>
            <p style="margin:0; color:#451a1a; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(reason)}</p>
          </div>
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Aucun paiement ne sera conservé pour cette demande. Selon votre banque, la libération d'une empreinte ou l'affichage d'un remboursement peut prendre quelques jours.
          </p>
          <p style="margin:16px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Vous pouvez répondre directement à cet email si vous souhaitez échanger avec nous ou préparer une autre réservation.
          </p>
          ${actionButton("Voir mes réservations", `${APP_URL}/dashboard`, "#b91c1c")}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de refus:", error);
    throw error;
  }
};

export const sendReviewRequestEmail = async (
  email: string,
  userName: string,
  bookingDetails: {
    petName: string;
    startDate: string;
    endDate: string;
    serviceLabel?: string;
    bookingId?: string;
  },
  reviewUrl: string,
  options?: { idempotencyKey?: string; subjectPrefix?: string }
) => {
  try {
    const rows = [
      ...(bookingDetails.bookingId ? [{ label: "Réservation", value: `#${bookingDetails.bookingId.slice(-8).toUpperCase()}` }] : []),
      { label: "Animal", value: bookingDetails.petName },
      ...(bookingDetails.serviceLabel ? [{ label: "Prestation", value: bookingDetails.serviceLabel }] : []),
      { label: "Début", value: bookingDetails.startDate },
      { label: "Fin", value: bookingDetails.endDate },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: `${options?.subjectPrefix || ""}Votre avis compte pour La Patte Dorée`,
      text: plainTextEmail({
        title: "Votre avis nous aide beaucoup",
        greeting: `Bonjour ${userName},`,
        body: [
          `La prestation pour ${bookingDetails.petName} est terminée.`,
          "Pouvez-vous prendre une minute pour donner votre avis sur la prestation ? Il pourra être affiché sur le site La Patte Dorée.",
          "Vous pourrez aussi nous laisser un retour séparé sur le site internet afin de nous aider à l'améliorer.",
          "Après l'envoi, vous pourrez également partager votre expérience sur Google.",
          `Lien d'avis : ${reviewUrl}`,
          `Avis Google : ${GOOGLE_REVIEW_URL}`,
        ],
        rows,
      }),
      html: emailLayout({
        preview: `Donnez votre avis sur la prestation de ${bookingDetails.petName}.`,
        title: "Comment s'est passée la prestation ?",
        subtitle: `Bonjour ${userName}, votre retour aide les prochains clients à nous faire confiance.`,
        accent: "#ea580c",
        children: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            La prestation pour <strong>${escapeHtml(bookingDetails.petName)}</strong> est terminée. Votre avis sur la garde pourra être affiché sur le site La Patte Dorée.
          </p>
          ${detailRows(rows)}
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Le formulaire permet aussi de laisser un retour séparé sur le site internet. Celui-ci reste interne et nous sert à améliorer l'expérience. Après l'envoi, vous pourrez également partager votre expérience sur Google.
          </p>
          ${actionButton("Donner mon avis", reviewUrl, "#ea580c")}
          <p style="margin:16px 0 0; text-align:center; color:#667085; font-size:13px; line-height:1.6;">
            Vous préférez Google ? <a href="${GOOGLE_REVIEW_URL}" target="_blank" rel="noopener noreferrer" style="color:#9a3412; font-weight:700;">Laisser directement un avis Google</a>
          </p>
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de demande d'avis:", error);
    throw error;
  }
};

export const sendWebsiteFeedbackNotification = async ({
  clientName,
  clientEmail,
  bookingId,
  serviceRating,
  serviceComment,
  websiteRating,
  websiteComment,
}: {
  clientName: string;
  clientEmail: string;
  bookingId: string;
  serviceRating: number;
  serviceComment: string;
  websiteRating?: number | null;
  websiteComment?: string | null;
}) => {
  try {
    const rows = [
      { label: "Client", value: clientName },
      { label: "Email", value: clientEmail },
      { label: "Réservation", value: `#${bookingId.slice(-8).toUpperCase()}` },
      { label: "Note prestation", value: `${serviceRating}/5` },
      { label: "Note site", value: websiteRating ? `${websiteRating}/5` : "Non renseignée" },
    ];

    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: "Nouveau retour sur le site internet",
      text: plainTextEmail({
        title: "Nouveau retour client",
        greeting: "Bonjour,",
        body: [
          "Un client vient de répondre au formulaire d'avis.",
          "",
          "Avis sur la prestation :",
          serviceComment,
          "",
          "Retour sur le site internet :",
          websiteComment || "Aucun commentaire renseigné.",
        ],
        rows,
        url: `${APP_URL}/admin/reviews`,
      }),
      html: emailLayout({
        preview: "Un client a laissé un retour sur le site internet.",
        title: "Nouveau retour client",
        subtitle: `${clientName} vient de répondre au formulaire d'avis.`,
        accent: "#2563eb",
        children: `
          ${detailRows(rows)}
          <div style="margin:20px 0 0; padding:16px 18px; border:1px solid #eadfce; border-radius:10px; background:#fffdf9;">
            <p style="margin:0 0 8px; color:#202124; font-size:15px; line-height:1.5;"><strong>Avis sur la prestation :</strong></p>
            <p style="margin:0; color:#344054; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(serviceComment)}</p>
          </div>
          <div style="margin:14px 0 0; padding:16px 18px; border:1px solid #bfdbfe; border-radius:10px; background:#eff6ff;">
            <p style="margin:0 0 8px; color:#1e3a8a; font-size:15px; line-height:1.5;"><strong>Retour sur le site internet :</strong></p>
            <p style="margin:0; color:#1f2937; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(websiteComment || "Aucun commentaire renseigné.")}</p>
          </div>
          ${actionButton("Voir les avis", `${APP_URL}/admin/reviews`, "#2563eb")}
        `,
      }),
      replyTo: clientEmail,
    }, `website-feedback-${bookingId}-${Date.now()}`);
  } catch (error) {
    console.error("Erreur notification retour site:", error);
    throw error;
  }
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
      subject: 'Échec de paiement de votre abonnement',
      text: plainTextEmail({
        title: "Échec de paiement",
        greeting: `Bonjour ${userName},`,
        body: [
          "Le renouvellement de votre abonnement Premium La Patte Dorée a échoué.",
          "Veuillez vérifier votre moyen de paiement pour continuer à bénéficier de vos avantages Premium.",
          "Stripe retentera automatiquement le paiement dans les prochains jours.",
        ],
        url: `${APP_URL}/profile`,
      }),
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${escapeHtml(userName)},</h1>
          <p>Le renouvellement de votre abonnement <strong>Premium La Patte Dorée</strong> a échoué.</p>
          <p>Veuillez vérifier votre moyen de paiement pour continuer à bénéficier de vos avantages Premium.</p>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0;"><strong>Que se passe-t-il ?</strong></p>
            <p style="margin: 8px 0 0;">Stripe retentera automatiquement le paiement dans les prochains jours. Si le problème persiste, vos avantages Premium seront suspendus.</p>
          </div>

          <p><a href="${APP_URL}/profile" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">Mettre à jour mon paiement</a></p>

          <p>Merci de votre confiance,<br>L'équipe La Patte Dorée 🐾</p>
        </div>
      `,
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
    await sendTransactionalEmail({
      from: EMAIL_FROM,
      to: email,
      subject: "Bienvenue chez La Patte Dorée",
      text: plainTextEmail({
        title: "Bienvenue",
        greeting: `Bonjour ${userName},`,
        body: [
          "Votre compte La Patte Dorée est créé.",
          "Vous pouvez maintenant ajouter vos animaux, préparer leurs informations et suivre vos demandes de réservation depuis votre espace.",
          "Plus votre profil animal est complet, plus la validation de votre future réservation sera simple.",
        ],
        url: `${APP_URL}/dashboard`,
      }),
      html: emailLayout({
        preview: "Votre espace La Patte Dorée est prêt.",
        title: "Bienvenue",
        subtitle: `Bonjour ${userName}, votre espace client est maintenant prêt.`,
        children: `
          <p style="margin:0; color:#344054; font-size:16px; line-height:1.7;">
            Votre compte La Patte Dorée est créé. Vous pouvez maintenant ajouter vos animaux, préparer leurs informations et suivre vos demandes de réservation depuis votre espace.
          </p>
          <p style="margin:20px 0 0; color:#344054; font-size:15px; line-height:1.7;">
            Plus votre profil animal est complet, plus la validation de votre future réservation sera simple.
          </p>
          ${actionButton("Accéder à mon espace", `${APP_URL}/dashboard`)}
        `,
      }),
      replyTo: SUPPORT_EMAIL,
    }, options?.idempotencyKey);
  } catch (error) {
    console.error("Erreur envoi email de bienvenue:", error);
    throw error;
  }
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
      subject: "Réinitialiser votre mot de passe La Patte Dorée",
      text: plainTextEmail({
        title: "Réinitialisation de mot de passe",
        greeting: `Bonjour ${userName},`,
        body: [
          "Vous avez demandé un nouveau mot de passe.",
          `Lien de réinitialisation : ${resetUrl}`,
          "Ce lien expire dans une heure. Ignorez cet email si vous n'êtes pas à l'origine de la demande.",
        ],
      }),
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${escapeHtml(userName)},</h1>
          <p>Vous avez demandé un nouveau mot de passe.</p>
          <p><a href="${escapeHtml(resetUrl)}">Choisir un nouveau mot de passe</a></p>
          <p>Ce lien expire dans une heure. Ignorez cet email si vous n'êtes pas à l'origine de la demande.</p>
        </div>
      `,
      replyTo: SUPPORT_EMAIL,
    });
  } catch (error) {
    console.error("Email de réinitialisation non envoyé:", error);
    throw error;
  }
};
