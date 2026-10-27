import { z } from "zod";
import { calculateBookingPrice, calculateSameDayDurationMinutes, isValidDayCareSchedule } from "@/lib/pricing";
import { getTodayDateKey, parisAppointment } from "@/lib/booking-dates";
import { isHourlyServiceType, SERVICE_TYPES } from "@/lib/services";

export const DIRECT_METHODS = { DIRECT_CASH: "Espèces", DIRECT_BANK_TRANSFER: "Virement" } as const;
export const isDirectPayment = (method?: string | null) => !!method && Object.hasOwn(DIRECT_METHODS, method);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date invalide");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const directBookingSchema = z.object({
  requestId: z.uuid(),
  clientId: z.string().max(100).optional(),
  client: z.object({ name: z.string().trim().min(2).max(150), email: z.email().toLowerCase(), phone: z.string().trim().min(6).max(30) }).optional(),
  petIds: z.array(z.string().min(1).max(100)).min(1).max(10).optional(),
  pet: z.object({ name: z.string().trim().min(1).max(100), species: z.enum(["DOG", "CAT"]), birthDate: dateKey, notes: z.string().trim().max(2000).default("") }).optional(),
  serviceType: z.enum(SERVICE_TYPES), startDate: dateKey, endDate: dateKey, startTime: time, endTime: time,
  serviceAddress: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(2000).default(""),
  agreementEvidence: z.string().trim().min(10, "Précisez la date et le support de l’accord du client.").max(1000),
  paymentMethod: z.enum(["DIRECT_CASH", "DIRECT_BANK_TRANSFER"]),
  paid: z.boolean(), paidOn: dateKey.optional(), paymentReference: z.string().trim().max(200).default(""),
  expectedTotal: z.number().positive().max(100000),
}).superRefine((data, ctx) => {
  const issue = (message: string, path: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (!!data.clientId === !!data.client) issue("Choisissez un client existant ou renseignez un nouveau client.", "client");
  if (!!data.petIds === !!data.pet) issue("Choisissez des animaux existants ou renseignez un nouvel animal.", "pet");
  if (!data.clientId && data.petIds) issue("Un nouveau client doit avoir un nouvel animal.", "petIds");
  if (data.startDate < getTodayDateKey()) issue("La garde doit commencer aujourd’hui ou plus tard.", "startDate");
  const start = parisAppointment(data.startDate, data.startTime), end = parisAppointment(data.endDate, data.endTime);
  if (!start || !end || end <= start || end.getTime() - start.getTime() > 90 * 86400000) issue("Vérifiez les dates et horaires (90 jours maximum).", "endDate");
  if (data.serviceType === "DAY_CARE" && !isValidDayCareSchedule(data)) issue("La garderie est limitée à 10 h par jour. Au-delà, choisissez Hébergement.", "endTime");
  if (data.serviceType === "HOUSE_SITTING" && calculateSameDayDurationMinutes(data) <= 0) issue("Le départ doit suivre l’arrivée chaque jour.", "endTime");
  if (isHourlyServiceType(data.serviceType)) {
    const duration = calculateSameDayDurationMinutes(data);
    if (data.startDate !== data.endDate || duration < 30 || duration > 120) issue("Une visite ou promenade doit durer de 30 à 120 minutes, le même jour.", "endTime");
  }
  if (["HOUSE_SITTING", "DROP_IN", "DOG_WALKING"].includes(data.serviceType) && data.serviceAddress.length < 5) issue("Renseignez l’adresse de la prestation.", "serviceAddress");
  if (data.pet && data.pet.birthDate > getTodayDateKey()) issue("La naissance ne peut pas être dans le futur.", "pet");
  if (data.paid && (!data.paidOn || data.paidOn > getTodayDateKey() || !data.paymentReference)) issue("Indiquez la date réelle et la référence du paiement reçu.", "paidOn");
});
export type DirectBookingInput = z.infer<typeof directBookingSchema>;
export function directVisitSlots(input: Pick<DirectBookingInput, "serviceType" | "startDate" | "startTime" | "endTime">) {
  return isHourlyServiceType(input.serviceType) ? [{ date: input.startDate, startTime: input.startTime, duration: calculateSameDayDurationMinutes(input) }] : undefined;
}
export function calculateDirectPrice(input: Pick<DirectBookingInput, "serviceType" | "startDate" | "endDate" | "startTime" | "endTime">, pets: Parameters<typeof calculateBookingPrice>[0]["pets"], requestedAt = new Date()) {
  if (input.serviceType === "DOG_WALKING" && pets.some(pet => pet.species === "CAT")) throw new Error("La promenade de chat nécessite un devis spécifique.");
  return calculateBookingPrice({ ...input, pets, visitSlots: directVisitSlots(input), requestedAt });
}
