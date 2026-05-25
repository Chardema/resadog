import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'meganemelique36@gmail.com';
const DEV_EMAIL = process.env.DEV_EMAIL || 'christo59@pm.me';
const APP_URL = process.env.NEXTAUTH_URL || 'https://resadog.vercel.app';
const EMAIL_FROM = process.env.RESEND_FROM || 'La Patte Dorée <onboarding@resend.dev>';
const BUG_EMAIL_FROM = process.env.RESEND_BUG_FROM || EMAIL_FROM;

// Protection XSS : échapper les caractères HTML dans les données utilisateur
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const sendBookingConfirmationEmail = async (
  email: string,
  userName: string,
  bookingDetails: {
    petName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
  }
) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY manquante. Email non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: '✅ Votre réservation est confirmée !',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${escapeHtml(userName)} ! 👋</h1>
          <p>Bonne nouvelle : la garde de <strong>${escapeHtml(bookingDetails.petName)}</strong> est officiellement confirmée.</p>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Détails du séjour :</h3>
            <p>📅 <strong>Du :</strong> ${escapeHtml(bookingDetails.startDate)}</p>
            <p>📅 <strong>Au :</strong> ${escapeHtml(bookingDetails.endDate)}</p>
            <p>💰 <strong>Total :</strong> ${bookingDetails.totalPrice}€ (Réglé)</p>
          </div>

          <p>📞 <strong>Prochaine étape :</strong></p>
          <p>Je vous contacterai très rapidement par téléphone pour faire le point sur les habitudes de ${escapeHtml(bookingDetails.petName)} et organiser l'arrivée.</p>

          <p>À très vite !<br>L'équipe La Patte Dorée 🐾</p>
        </div>
      `,
      replyTo: ADMIN_EMAIL,
    });
  } catch (error) {
    console.error("Erreur envoi email:", error);
  }
};

export const sendBookingRequestEmail = async (
  email: string,
  userName: string,
  petName: string
) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY manquante. Email non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: '⏳ Demande de réservation reçue',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${escapeHtml(userName)},</h1>
          <p>Nous avons bien reçu votre demande pour la garde de <strong>${escapeHtml(petName)}</strong>.</p>
          <p>Votre paiement est <strong>en attente de validation</strong> (une empreinte bancaire a été réalisée, vous n'êtes pas encore débité).</p>
          <p>Nous allons examiner votre demande et vous recevrez une confirmation très prochainement.</p>
          <p>Merci de votre confiance ! 🐾</p>
        </div>
      `,
      replyTo: ADMIN_EMAIL,
    });
  } catch (error) {
    console.error("Erreur envoi email:", error);
  }
};

export const sendAdminNotification = async (
  petName: string,
  userName: string,
  startDate: string,
  endDate: string,
  totalPrice: number
) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY manquante. Email non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: '🐾 Nouvelle demande de réservation !',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Nouvelle demande reçue !</h1>
          <p><strong>${escapeHtml(userName)}</strong> souhaite faire garder <strong>${escapeHtml(petName)}</strong>.</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p>📅 Du : ${escapeHtml(startDate)}</p>
            <p>📅 Au : ${escapeHtml(endDate)}</p>
            <p>💰 Montant : ${totalPrice}€</p>
          </div>
          <p><a href="${APP_URL}/admin/bookings">Accéder au Dashboard pour valider</a></p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Erreur email admin:", error);
  }
};

export const sendBugReport = async (
  userEmail: string | undefined,
  description: string,
  path: string
) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY manquante. Email bug non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: BUG_EMAIL_FROM,
      to: DEV_EMAIL,
      subject: '🐛 Rapport de Bug - La Patte Dorée',
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
  }
};

export const sendPaymentFailedEmail = async (
  email: string,
  userName: string
) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY manquante. Email non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: '⚠️ Échec de paiement de votre abonnement',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${escapeHtml(userName)},</h1>
          <p>Le renouvellement de votre abonnement <strong>Club La Meute</strong> a échoué.</p>
          <p>Veuillez vérifier votre moyen de paiement pour continuer à bénéficier de vos crédits mensuels.</p>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0;"><strong>Que se passe-t-il ?</strong></p>
            <p style="margin: 8px 0 0;">Stripe retentera automatiquement le paiement dans les prochains jours. Si le problème persiste, vos crédits ne seront pas renouvelés.</p>
          </div>

          <p><a href="${APP_URL}/profile" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">Mettre à jour mon paiement</a></p>

          <p>Merci de votre confiance,<br>L'équipe La Patte Dorée 🐾</p>
        </div>
      `,
      replyTo: ADMIN_EMAIL,
    });
  } catch (error) {
    console.error("Erreur envoi email paiement échoué:", error);
  }
};
