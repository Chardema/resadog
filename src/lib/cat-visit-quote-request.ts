import { z } from "zod";
import { addCalendarDays, getTodayDateKey } from "@/lib/booking-dates";
import { calculateCatVisitQuote, isValidVisitDate, type CatVisitQuote, type CatVisitQuoteDetails } from "@/lib/cat-visit-quote";

const dateSchema = z.string().refine(isValidVisitDate, "Date invalide.");
const quoteRequestSchema = z.object({
  input: z.object({
    catCount: z.number().int().min(1).max(20),
    dates: z.array(dateSchema).min(1).max(366),
    visitsPerDay: z.number().int().min(1).max(4),
    durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
    travelFeePerVisit: z.number().min(0).max(1000),
  }).strict(),
  details: z.object({
    clientName: z.string().trim().max(160), address: z.string().trim().max(300),
    notes: z.string().trim().max(2000), petNames: z.string().trim().max(200),
    issuedOn: dateSchema, validUntil: dateSchema,
    reference: z.string().regex(/^DEV-\d{8}-[A-F0-9]{8}$/, "Référence de devis invalide."),
  }).strict(),
}).strict();

export const quoteMailSchema = z.object({
  to: z.string().trim().email("Indiquez une adresse e-mail valide.").max(254).transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(1, "L’objet est obligatoire.").max(200).regex(/^[^\r\n]+$/, "L’objet doit tenir sur une ligne."),
  message: z.string().trim().min(1, "Le message est obligatoire.").max(6000),
}).strict();

export function makeCatVisitQuoteRequest(quote: CatVisitQuote, details: CatVisitQuoteDetails) {
  return {
    input: { catCount: quote.catCount, dates: quote.dates, visitsPerDay: quote.visitsPerDay, durationMinutes: quote.durationMinutes, travelFeePerVisit: quote.travelFeePerVisit },
    details,
  };
}

export function parseCatVisitQuoteRequest(value: unknown, today = getTodayDateKey()) {
  const parsed = quoteRequestSchema.safeParse(value);
  if (!parsed.success) throw new Error("Les informations du devis sont invalides. Générez-le à nouveau.");
  const { input, details } = parsed.data;
  const quote = calculateCatVisitQuote(input);
  if (!quote || quote.dates[0] < today || details.issuedOn > today
    || details.validUntil < today || details.validUntil < details.issuedOn
    || details.validUntil > quote.dates[0] || details.validUntil > addCalendarDays(details.issuedOn, 90)
    || !details.reference.startsWith(`DEV-${details.issuedOn.replaceAll("-", "")}-`)) {
    throw new Error("Ce devis est expiré ou ses dates sont incohérentes. Générez-le à nouveau.");
  }
  return { quote, details };
}
