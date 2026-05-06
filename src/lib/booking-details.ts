export type VisitSlot = {
  date: string;
  startTime: string;
  duration: number;
};

export type BookingServiceDetails = {
  visitSlots?: VisitSlot[];
};

const DETAILS_START = "[RESADOG_SERVICE_DETAILS]";
const DETAILS_END = "[/RESADOG_SERVICE_DETAILS]";

export function buildSpecialRequests(
  notes?: string | null,
  serviceDetails?: BookingServiceDetails
) {
  const cleanedNotes = notes?.trim() || "";
  const visitSlots = serviceDetails?.visitSlots?.filter((slot) => slot.date) || [];

  if (visitSlots.length === 0) return cleanedNotes || null;

  const detailsBlock = `${DETAILS_START}${JSON.stringify({ visitSlots })}${DETAILS_END}`;
  return [cleanedNotes, detailsBlock].filter(Boolean).join("\n\n");
}

export function extractServiceDetails(
  specialRequests?: string | null
): BookingServiceDetails | null {
  if (!specialRequests) return null;

  const match = specialRequests.match(/\[RESADOG_SERVICE_DETAILS\]([\s\S]*?)\[\/RESADOG_SERVICE_DETAILS\]/);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]) as BookingServiceDetails;
    const visitSlots = parsed.visitSlots?.filter((slot) =>
      typeof slot.date === "string" &&
      typeof slot.startTime === "string" &&
      typeof slot.duration === "number"
    );
    return visitSlots?.length ? { visitSlots } : null;
  } catch {
    return null;
  }
}

export function stripServiceDetails(specialRequests?: string | null) {
  if (!specialRequests) return null;
  const stripped = specialRequests
    .replace(/\n?\[RESADOG_SERVICE_DETAILS\][\s\S]*?\[\/RESADOG_SERVICE_DETAILS\]\n?/g, "")
    .trim();
  return stripped || null;
}
