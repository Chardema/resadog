import { LEGAL_INFORMATION } from "@/lib/legal";
import { extractServiceDetails } from "@/lib/booking-details";
import { getServiceLabel } from "@/lib/services";
import { addCalendarDays, getTodayDateKey } from "@/lib/booking-dates";

export const ATTENDANCE_POLICY_VERSION = "2026-09-12";
export const DROP_OFF_GRACE_MINUTES = 30;
export const PICK_UP_GRACE_MINUTES = 15;
export const ATTENDANCE_SUMMARY = "Prévenez-nous dès qu’un retard est prévisible. Au dépôt, après 30 minutes sans présentation ni nouvelles et après une relance écrite restée sans réponse, la réservation peut être annulée manuellement. Une indemnité proportionnée au préjudice peut être retenue, dans la limite du prix réservé ; aucun remboursement si la retenue justifiée couvre ce prix, sous réserve des droits légaux. À la récupération : 15 minutes de tolérance, puis une prolongation à convenir et à chiffrer avant accord, sans prélèvement automatique.";

export { parisAppointment } from "@/lib/booking-dates";
import { parisAppointment } from "@/lib/booking-dates";

export type AttendanceBooking = {
  id: string; startDate: Date; endDate: Date; startTime?: string | null; endTime?: string | null;
  serviceType: string; totalPrice: number; specialRequests?: string | null;
  pets?: { name: string }[]; pet?: { name: string | null } | null;
  client: { name: string | null; email: string; phone?: string | null };
};
export const isDropOffService = (service: string) => ["BOARDING", "DAY_CARE"].includes(service);
export const dateLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "long", year: "numeric" });
export function attendanceDetails(b: AttendanceBooking) {
  const details = extractServiceDetails(b.specialRequests);
  const address = isDropOffService(b.serviceType) ? LEGAL_INFORMATION.address : details?.serviceAddress || "Adresse à confirmer avec notre équipe avant la prestation";
  return [
    `Réservation : #${b.id.slice(-8).toUpperCase()}`,
    `Prestation : ${getServiceLabel(b.serviceType)}`,
    `Animaux : ${b.pets?.map(p => p.name).join(", ") || b.pet?.name || "Votre compagnon"}`,
    `Début : ${dateLabel(b.startDate.toISOString().slice(0, 10))} à ${b.startTime || "heure à convenir"}`,
    `Fin : ${dateLabel(b.endDate.toISOString().slice(0, 10))} à ${b.endTime || "heure à convenir"}`,
    ...(b.serviceType === "DAY_CARE" || b.serviceType === "HOUSE_SITTING" ? ["Ces horaires s’appliquent chaque jour de la période réservée."] : []),
    "Tous les horaires sont ceux de Paris.",
    `Lieu de la prestation : ${address}`,
    ...(address.startsWith("Adresse à confirmer") ? [] : [`Itinéraire : https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`]),
    `Téléphone de notre équipe : ${LEGAL_INFORMATION.phone}`,
    `Email : ${LEGAL_INFORMATION.contactEmail}`,
    `Votre téléphone : ${b.client.phone || "non renseigné — merci de nous communiquer un numéro joignable"}`,
    `Montant réservé : ${b.totalPrice.toFixed(2)} €`,
  ].join("\n");
}
export function reminderEvents(b: AttendanceBooking, now = new Date()) {
  const tomorrow = addCalendarDays(getTodayDateKey(now), 1);
  const first = b.startDate.toISOString().slice(0,10), last = b.endDate.toISOString().slice(0,10);
  if (tomorrow < first || tomorrow > last) return [];
  const slots = extractServiceDetails(b.specialRequests)?.visitSlots?.filter(s => s.date === tomorrow) || [];
  if (["DROP_IN", "DOG_WALKING"].includes(b.serviceType) && !slots.length) return [];
  const daily = ["DAY_CARE", "HOUSE_SITTING", "DROP_IN", "DOG_WALKING"].includes(b.serviceType);
  if (!daily && tomorrow !== first && tomorrow !== last) return [];
  const kind = !daily && tomorrow === last && tomorrow !== first ? "PICKUP" : "REMINDER";
  const schedule = slots.length ? slots.map(s => `${s.startTime} (${s.duration} min)`).join(", ") : kind === "PICKUP" ? b.endTime : b.startTime;
  return [{ key: `booking-${b.id}-${kind.toLowerCase()}-${tomorrow}`, kind, date: tomorrow, schedule: schedule || "heure à convenir" }];
}
export function reminderMessage(b: AttendanceBooking, event: ReturnType<typeof reminderEvents>[number]) {
  return { subject: `${event.kind === "PICKUP" ? "Rappel de récupération" : "Votre réservation demain"} — La Patte Dorée`, text: [
    `Bonjour ${b.client.name || ""},`,
    `Rappel pour demain, le ${dateLabel(event.date)} : ${event.kind === "PICKUP" ? "récupération de votre animal" : getServiceLabel(b.serviceType)} à ${event.schedule} (heure de Paris).`,
    attendanceDetails(b),
    isDropOffService(b.serviceType) ? "À prévoir : nourriture et consignes, laisse, panier ou couverture, carnet de santé et tout traitement convenu avec nous." : "Merci de confirmer les modalités d’accès, les clés et les consignes utiles. Votre animal et son matériel doivent être accessibles à l’horaire convenu.",
    "Prévenez-nous immédiatement de tout retard au numéro indiqué. Un horaire modifié doit être accepté par notre équipe. Les conditions acceptées lors de votre réservation restent applicables.",
    `Retrouvez votre réservation : https://www.lapatte-doree.fr/dashboard`,
    "À bientôt,\nMM Services — La Patte Dorée",
    "—— English ——",
    `Hello ${b.client.name || ""}, this is a reminder for tomorrow (${event.date}) at ${event.schedule}, Paris time${event.kind === "PICKUP" ? ", to pick up your pet" : ""}.`,
    attendanceDetailsEnglish(b),
    isDropOffService(b.serviceType) ? "Please bring food and feeding instructions, a leash, a bed or blanket, health records and any treatment agreed with us." : "Please confirm access arrangements, keys and care instructions. Your pet and their supplies must be accessible at the agreed time.",
    "If you expect a delay, contact us immediately on +33 7 71 59 30 16. Any change of time requires our agreement. The terms accepted when you booked remain applicable.",
  ].join("\n\n") };
}
export function noShowMessage(b: AttendanceBooking, retainedAmount: number, recordedAt: Date) {
  return { subject: "Annulation pour non-présentation — La Patte Dorée", text: [
    `Bonjour ${b.client.name || ""},`,
    `Vous étiez attendu(e) le ${dateLabel(b.startDate.toISOString().slice(0,10))} à ${b.startTime}. À ${recordedAt.toLocaleTimeString("fr-FR", {timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit"})}, nous n’avons constaté ni votre arrivée ni de réponse à notre relance écrite dans le délai indiqué. Aucun nouvel horaire n’ayant été convenu, votre réservation est annulée pour non-présentation.`,
    attendanceDetails(b),
    `Le montant déjà encaissé de ${retainedAmount.toFixed(2)} € est retenu au titre de l’indemnité de non-présentation prévue par les conditions acceptées et du préjudice lié au créneau réservé. Aucun remboursement n’est déclenché et aucun nouveau prélèvement n’est effectué.`,
    "Si vous aviez prévenu notre équipe, si un cas de force majeure ou un droit légal s’applique, ou si vous contestez cette décision ou son montant, répondez à ce mail avec les éléments utiles afin que nous réexaminions votre situation. Vos droits légaux restent applicables.",
    `MM Services — La Patte Dorée\n${LEGAL_INFORMATION.phone}\n${LEGAL_INFORMATION.contactEmail}`,
    "—— English ——",
    `Hello ${b.client.name || ""}, you were expected on ${b.startDate.toISOString().slice(0,10)} at ${b.startTime} (Paris time). You did not arrive or respond to our written reminder within the stated deadline. No alternative time was agreed, so your booking has been cancelled for non-attendance.`,
    attendanceDetailsEnglish(b),
    `The ${retainedAmount.toFixed(2)} EUR already collected is retained as compensation for non-attendance under the accepted terms and the loss associated with the reserved slot. No refund is being initiated and no additional payment is being collected.`,
    "If you had notified our team, if force majeure or a statutory right applies, or if you dispute this decision or amount, please reply with the relevant information so we can review your situation. Your statutory rights remain unaffected. Contact: +33 7 71 59 30 16 — contact@lapatte-doree.fr.",
  ].join("\n\n") };
}


export function noShowTimingError(booking: { status: string; serviceType: string; startDate: Date; endDate: Date; startTime?: string | null; endTime?: string | null }, input: { reminderSentAt: string; responseDeadline: string }, now: Date) {
  const start = parisAppointment(booking.startDate, booking.startTime);
  const end = parisAppointment(booking.endDate, booking.endTime);
  if (booking.status !== "CONFIRMED" || !isDropOffService(booking.serviceType) || !start || !end || now.getTime() < start.getTime() + DROP_OFF_GRACE_MINUTES * 60_000) {
    return "Action réservée à un dépôt confirmé, non commencé, après au moins 30 minutes de retard (heure de Paris).";
  }
  if (end.getTime() - start.getTime() > 24 * 3600_000 || end <= now) return "Séjour de plusieurs jours ou déjà terminé : examiner séparément les prestations restantes et le montant à rembourser.";
  const sent = parisAppointment(input.reminderSentAt, input.reminderSentAt.slice(11,16));
  const deadline = parisAppointment(input.responseDeadline, input.responseDeadline.slice(11,16));
  if (!sent || !deadline || sent < start || deadline.getTime() - sent.getTime() < 15 * 60_000 || deadline > now) {
    return "La relance doit être postérieure au rendez-vous, laisser au moins 15 minutes pour répondre et son délai doit être écoulé. Adaptez ce délai aux circonstances.";
  }
  return null;
}


function attendanceDetailsEnglish(b: AttendanceBooking) {
  const service = { BOARDING: "Boarding", DAY_CARE: "Day care", HOUSE_SITTING: "Care at your home", DROP_IN: "Home visit", DOG_WALKING: "Dog walking" }[b.serviceType] || b.serviceType;
  const address = isDropOffService(b.serviceType) ? LEGAL_INFORMATION.address : extractServiceDetails(b.specialRequests)?.serviceAddress || "Please confirm the service address with our team";
  return [
    `Booking: #${b.id.slice(-8).toUpperCase()} — ${service}`,
    `Pets: ${b.pets?.map(p => p.name).join(", ") || b.pet?.name || "Your pet"}`,
    `Start: ${b.startDate.toISOString().slice(0,10)} at ${b.startTime || "time to be agreed"}`,
    `End: ${b.endDate.toISOString().slice(0,10)} at ${b.endTime || "time to be agreed"}`,
    "All times are Paris local time. For day care and care at your home, these hours apply each day.",
    `Service address: ${address}`,
    `Our phone: +33 7 71 59 30 16 — ${LEGAL_INFORMATION.contactEmail}`,
    `Your phone: ${b.client.phone || "not provided — please send us a number where we can reach you"}`,
    `Booking amount: ${b.totalPrice.toFixed(2)} EUR`,
  ].join("\n");
}
