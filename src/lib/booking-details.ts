export type VisitSlot = {
  date: string;
  startTime: string;
  duration: number;
};

export type BookingServiceDetails = {
  visitSlots?: VisitSlot[];
  serviceAddress?: string;
};

const DETAILS_START = "[RESADOG_SERVICE_DETAILS]";
const DETAILS_END = "[/RESADOG_SERVICE_DETAILS]";

export function buildSpecialRequests(
  notes?: string | null,
  serviceDetails?: BookingServiceDetails
) {
  const cleanedNotes = notes?.trim() || "";
  const visitSlots = serviceDetails?.visitSlots?.filter((slot) => slot.date) || [];
  const serviceAddress = serviceDetails?.serviceAddress?.trim() || undefined;

  if (visitSlots.length === 0 && !serviceAddress) return cleanedNotes || null;

  const detailsBlock = `${DETAILS_START}${JSON.stringify({ visitSlots, serviceAddress })}${DETAILS_END}`;
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
    const serviceAddress = typeof parsed.serviceAddress === "string"
      ? parsed.serviceAddress.trim()
      : undefined;
    return visitSlots?.length || serviceAddress ? { visitSlots, serviceAddress } : null;
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
