export const REVIEW_NEARBY_DAYS = 7;
export const REVIEW_NEARBY_MS = REVIEW_NEARBY_DAYS * 86400000;

export type CompletionCandidate = {
  id: string; clientId: string; status: string; startDate: Date | string; endDate: Date | string;
};
export function validateCompletionSelection(anchorId: string, ids: string[], bookings: CompletionCandidate[]) {
  const unique = [...new Set(ids)].sort();
  const anchor = bookings.find(booking => booking.id === anchorId);
  if (!unique.length || unique.length > 50 || !unique.includes(anchorId) || !anchor || bookings.length !== unique.length) throw new Error("Sélection de réservations invalide.");
  if (bookings.some(booking => !unique.includes(booking.id) || booking.clientId !== anchor.clientId)) throw new Error("Toutes les réservations doivent appartenir au même client.");
  if (bookings.some(booking => !["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status))) throw new Error("Une réservation sélectionnée ne peut plus être terminée. Rechargez la page.");
  return unique;
}
export function bookingDateGap(a: Pick<CompletionCandidate, "startDate" | "endDate">, b: Pick<CompletionCandidate, "startDate" | "endDate">) {
  return Math.max(0, new Date(a.startDate).getTime() - new Date(b.endDate).getTime(), new Date(b.startDate).getTime() - new Date(a.endDate).getTime());
}
export function groupNearbyBookings<T extends CompletionCandidate>(bookings: T[]): T[][] {
  const groups: T[][] = [];
  for (const booking of [...bookings].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())) {
    const group = groups.find(items => items[0].clientId === booking.clientId && items.some(item => bookingDateGap(item,booking) <= REVIEW_NEARBY_MS));
    if (group) group.push(booking); else groups.push([booking]);
  }
  return groups;
}
