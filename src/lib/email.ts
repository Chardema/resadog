import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
      from: 'La Patte Dorée <onboarding@resend.dev>', // Ou ton domaine personnalisé si configuré
      to: email,
      subject: '✅ Votre réservation est confirmée !',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${userName} ! 👋</h1>
          <p>Bonne nouvelle : la garde de <strong>${bookingDetails.petName}</strong> est officiellement confirmée.</p>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Détails du séjour :</h3>
            <p>📅 <strong>Du :</strong> ${bookingDetails.startDate}</p>
            <p>📅 <strong>Au :</strong> ${bookingDetails.endDate}</p>
            <p>💰 <strong>Total :</strong> ${bookingDetails.totalPrice}€ (Réglé)</p>
          </div>

          <p>📞 <strong>Prochaine étape :</strong></p>
          <p>Je vous contacterai très rapidement par téléphone pour faire le point sur les habitudes de ${bookingDetails.petName} et organiser l'arrivée.</p>

          <p>À très vite !<br>L'équipe La Patte Dorée 🐾</p>
        </div>
      `,
      replyTo: 'meganemelique36@gmail.com',
    });
    console.log(`📧 Email de confirmation envoyé à ${email}`);
  } catch (error) {
    console.error("Erreur envoi email:", error);
  }
};

export const sendBookingRequestEmail = async (
  email: string,
  userName: string,
  petName: string
) => {
  console.log("📧 Tentative envoi email demande à:", email);
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY manquante !");
    return;
  }

  try {
    await resend.emails.send({
      from: 'La Patte Dorée <onboarding@resend.dev>',
      to: email,
      subject: '⏳ Demande de réservation reçue',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour ${userName},</h1>
          <p>Nous avons bien reçu votre demande pour la garde de <strong>${petName}</strong>.</p>
          <p>Votre paiement est <strong>en attente de validation</strong> (une empreinte bancaire a été réalisée, vous n'êtes pas encore débité).</p>
          <p>Nous allons examiner votre demande et vous recevrez une confirmation très prochainement.</p>
          <p>Merci de votre confiance ! 🐾</p>
        </div>
      `,
      replyTo: 'meganemelique36@gmail.com',
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
  console.log("📧 Tentative envoi email admin");
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY manquante !");
    return;
  }

  try {
    await resend.emails.send({
      from: 'La Patte Dorée <onboarding@resend.dev>',
      to: 'meganemelique36@gmail.com',
      subject: '🐶 Nouvelle demande de réservation !',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Nouvelle demande reçue !</h1>
          <p><strong>${userName}</strong> souhaite faire garder <strong>${petName}</strong>.</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p>📅 Du : ${startDate}</p>
            <p>📅 Au : ${endDate}</p>
            <p>💰 Montant : ${totalPrice}€</p>
          </div>
          <p><a href="https://resadog.vercel.app/admin/bookings">Accéder au Dashboard pour valider</a></p>
        </div>
      `,
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
      from: 'La Patte Dorée Bug <onboarding@resend.dev>',
      to: 'christo59@pm.me',
      subject: '🐛 Rapport de Bug - La Patte Dorée',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Nouveau signalement de bug</h1>
          <p><strong>Utilisateur :</strong> ${userEmail || "Anonyme"}</p>
          <p><strong>Page concernée :</strong> ${path}</p>
          
          <div style="background: #fff0f0; padding: 15px; border-radius: 8px; border: 1px solid #ffcccc; margin: 20px 0;">
            <h3>Description :</h3>
            <p style="white-space: pre-wrap;">${description}</p>
          </div>
          
          <p><em>Envoyé automatiquement depuis l'application.</em></p>
        </div>
      `,
    });
    console.log(`📧 Rapport de bug envoyé.`);
  } catch (error) {
    console.error("Erreur envoi rapport bug:", error);
  }
};
