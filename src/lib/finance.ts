import { isDirectPayment } from "@/lib/direct-booking";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date invalide");
const rate = z.number().int().min(0).max(10000);
export const financeSettingsSchema = z.object({
  standardRateBps: rate,
  acreEnabled: z.boolean(),
  acreRateBps: rate.nullable(),
  acreStartsOn: day.nullable(),
  acreEndsOn: day.nullable(),
}).strict().superRefine((settings, ctx) => {
  if (settings.acreEnabled && (settings.acreRateBps === null || !settings.acreStartsOn || !settings.acreEndsOn)) {
    ctx.addIssue({ code: "custom", message: "Renseignez le taux et les dates de l’ACRE accordée." });
  }
  if (settings.acreStartsOn && settings.acreEndsOn && settings.acreStartsOn > settings.acreEndsOn) {
    ctx.addIssue({ code: "custom", message: "La fin de l’ACRE doit suivre son début." });
  }
});
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;
export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  // Marge de provision proposée, pas un taux fiscal personnel confirmé.
  standardRateBps: 2200,
  acreEnabled: false,
  acreRateBps: null,
  acreStartsOn: null,
  acreEndsOn: null,
};

export const cents = (amount: number) => Math.round(amount * 100);
export const financeDay = (value: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));
export const financeMonth = (value: string | Date) => financeDay(value).slice(0, 7);
export function contributionRate(settings: FinanceSettings, date: string | Date) {
  const dateKey = financeDay(date);
  return settings.acreEnabled && settings.acreRateBps !== null && settings.acreStartsOn && settings.acreEndsOn
    && dateKey >= settings.acreStartsOn && dateKey <= settings.acreEndsOn
    ? settings.acreRateBps : settings.standardRateBps;
}

/** Répartit les centimes sans jamais dupliquer un paiement partagé. */
export function allocateCents(amount: number, weights: number[]) {
  const sign = amount < 0 ? -1 : 1;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return weights.map(() => 0);
  const exact = weights.map((weight) => Math.abs(amount) * weight / total);
  const values = exact.map(Math.floor);
  let remaining = Math.abs(amount) - values.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - values[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) if (remaining-- > 0) values[index]++;
  return values.map((value) => value * sign);
}

export type StripeFinanceSnapshot = {
  status: string;
  currency: string;
  grossCents: number;
  paidAt: string | null;
  feeCents: number | null;
  disputed: boolean;
  refunds: { id: string; bookingId?: string; amountCents: number; occurredAt: string; feeCents: number | null }[];
};

export type FinanceSource = {
  id: string;
  bookingId: string;
  kind: "BOOKING" | "CHARGE";
  clientName: string;
  pets: string[];
  serviceType: string;
  amountCents: number;
  capturedCents: number;
  refundCents: number;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  bookingStatus: string;
  startsAt: string;
  endsAt: string;
  paymentMethod?: string | null;
  paymentIntentId: string | null;
};

export type FinanceAmounts = {
  grossCents: number;
  refundCents: number;
  feeCents: number;
  provisionCents: number;
  availableCents: number;
  estimatedFeeCount: number;
};
export const emptyFinanceAmounts = (): FinanceAmounts => ({
  grossCents: 0, refundCents: 0, feeCents: 0, provisionCents: 0, availableCents: 0, estimatedFeeCount: 0,
});
export function addFinanceAmounts(target: FinanceAmounts, value: FinanceAmounts) {
  for (const key of Object.keys(emptyFinanceAmounts()) as (keyof FinanceAmounts)[]) target[key] += value[key];
}
export type BookingFinance = FinanceAmounts & {
  projected: FinanceAmounts | null; rateBps: number;
  upcoming: { startsAt: string; endsAt: string } | null;
};
export type FinanceEvent = FinanceAmounts & {
  id: string; bookingId: string; clientName: string; pets: string[]; serviceType: string;
  kind: "CAPTURE" | "REFUND"; sourceKind: "BOOKING" | "CHARGE";
  occurredAt: string; rateBps: number; crossMonthRefund: boolean;
};
export type FinanceProjection = FinanceAmounts & {
  id: string; bookingId: string; clientName: string; pets: string[]; serviceType: string; rateBps: number;
};
export type FinanceUpcoming = FinanceAmounts & {
  bookingId: string; clientName: string; pets: string[]; serviceType: string;
  startsAt: string; endsAt: string; collectedCents: number; toCollectCents: number;
};
export type FinanceUpcomingSummary = FinanceAmounts & {
  bookingCount: number; collectedCents: number; toCollectCents: number;
};
export type FinanceUpcomingMonth = FinanceUpcomingSummary & { key: string; label: string };
export type FinanceReport = {
  settings: FinanceSettings;
  events: FinanceEvent[];
  projections: FinanceProjection[];
  upcoming: FinanceUpcoming[];
  bookings: Record<string, BookingFinance>;
  warnings: string[];
};

// Hypothèse affichée : carte standard EEE. Les frais observés remplacent cette estimation.
const estimatedFee = (grossCents: number) => grossCents > 0 ? Math.round(grossCents * 0.015) + 25 : 0;

export function buildFinanceReport(
  sources: FinanceSource[], snapshots: Map<string, StripeFinanceSnapshot>,
  settings: FinanceSettings, now = new Date(),
): FinanceReport {
  const events: FinanceEvent[] = [];
  const projections: FinanceProjection[] = [];
  const bookings: Record<string, BookingFinance> = {};
  const warnings = new Set<string>();
  const groups = new Map<string, FinanceSource[]>();
  for (const source of [...sources].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = source.paymentIntentId || source.id;
    groups.set(key, [...(groups.get(key) || []), source]);
    bookings[source.bookingId] ||= { ...emptyFinanceAmounts(), projected: null, rateBps: contributionRate(settings, now), upcoming: null };
  }
  for (const [key, group] of groups) {
    const snapshot = snapshots.get(key);
    if (snapshot && snapshot.currency !== "eur") {
      warnings.add("Un paiement dans une autre devise est exclu : son montant en euros reste à vérifier.");
      continue;
    }
    if (snapshot?.disputed) warnings.add("Un paiement est contesté. Les retenues et frais de litige ne sont pas inclus dans ce récapitulatif.");
    const direct = group.every(source => !source.paymentIntentId && isDirectPayment(source.paymentMethod));
    const weights = group.map((source) => source.amountCents);
    const capturedLocally = group.filter((source) => ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(source.status));
    const gross = snapshot?.grossCents ?? Math.min(
      weights.reduce((sum, value) => sum + value, 0), capturedLocally.reduce((sum, source) => sum + source.capturedCents, 0),
    );
    const paidAt = snapshot?.paidAt || capturedLocally.find((source) => source.paidAt)?.paidAt;
    if (gross > 0 && !paidAt) {
      warnings.add("Un ancien encaissement sans date fiable est exclu des totaux. Vérifiez sa date dans Stripe.");
      continue;
    }
    if (gross > 0 && paidAt) {
      if (!snapshot && !direct) warnings.add("Certains paiements reposent sur les données enregistrées du site : la lecture Stripe est indisponible.");
      const allocations = allocateCents(gross, weights);
      const fee = snapshot?.feeCents ?? (direct ? 0 : estimatedFee(gross));
      const fees = allocateCents(fee, allocations);
      const rateBps = contributionRate(settings, paidAt);
      const provisions = allocations.map((amount) => Math.round(amount * rateBps / 10000));
      const refundList = snapshot?.refunds ?? capturedLocally.filter((source) => source.refundCents > 0 && source.refundedAt).map((source) => ({
        id: `local-${source.id}`, bookingId: source.bookingId, amountCents: source.refundCents, occurredAt: source.refundedAt!, feeCents: direct ? 0 : null,
      }));
      if (!snapshot && capturedLocally.some((source) => source.refundCents > 0 && !source.refundedAt)) {
        warnings.add("Un remboursement sans date fiable ne peut pas être réparti par mois. Vérifiez-le dans Stripe.");
      }
      group.forEach((source, index) => {
        if (!allocations[index]) return;
        const amounts: FinanceAmounts = {
          grossCents: allocations[index], refundCents: 0, feeCents: fees[index], provisionCents: provisions[index],
          availableCents: allocations[index] - fees[index] - provisions[index],
          estimatedFeeCount: !direct && snapshot?.feeCents == null ? 1 : 0,
        };
        events.push({ ...amounts, id: `${source.id}:capture`, bookingId: source.bookingId, clientName: source.clientName,
          pets: source.pets, serviceType: source.serviceType, sourceKind: source.kind, kind: "CAPTURE", occurredAt: paidAt, rateBps, crossMonthRefund: false });
        addFinanceAmounts(bookings[source.bookingId], amounts);
        bookings[source.bookingId].rateBps = rateBps;
      });
      let previousRefunds = allocations.map(() => 0);
      let previousProvisions = allocations.map(() => 0);
      for (const refund of [...refundList].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))) {
        const remaining = allocations.map((amount, index) => amount - previousRefunds[index]);
        const available = remaining.reduce((sum, amount) => sum + amount, 0);
        const refundAmount = Math.min(available, refund.amountCents);
        const targeted = remaining.map((amount, index) => group[index].bookingId === refund.bookingId ? amount : 0);
        const canTarget = Boolean(refund.bookingId) && targeted.reduce((sum, amount) => sum + amount, 0) >= refundAmount;
        if (group.length > 1 && !canTarget) warnings.add("Un remboursement de paiement partagé est réparti proportionnellement entre les réservations, faute d’affectation précise.");
        const delta = allocateCents(refundAmount, canTarget ? targeted : remaining);
        const refunded = previousRefunds.map((amount, index) => amount + delta[index]);
        const released = refunded.map((amount, index) => allocations[index] ? Math.round(provisions[index] * amount / allocations[index]) : 0);
        const refundFees = allocateCents(refund.feeCents ?? 0, delta.some(Boolean) ? delta : allocations);
        group.forEach((source, index) => {
          const amount = refunded[index] - previousRefunds[index];
          if (!amount && !refundFees[index]) return;
          const provisionReleased = released[index] - previousProvisions[index];
          const amounts: FinanceAmounts = {
            grossCents: 0, refundCents: amount, feeCents: refundFees[index], provisionCents: -provisionReleased,
            availableCents: -amount - refundFees[index] + provisionReleased, estimatedFeeCount: refund.feeCents === null ? 1 : 0,
          };
          events.push({ ...amounts, id: `${source.id}:${refund.id}`, bookingId: source.bookingId, clientName: source.clientName,
            pets: source.pets, serviceType: source.serviceType, sourceKind: source.kind, kind: "REFUND", occurredAt: refund.occurredAt,
            rateBps, crossMonthRefund: financeMonth(refund.occurredAt) !== financeMonth(paidAt) });
          addFinanceAmounts(bookings[source.bookingId], amounts);
        });
        previousRefunds = refunded;
        previousProvisions = released;
      }
    } else {
      const awaiting = group.filter((source) => source.bookingStatus !== "CANCELLED"
        && ["PENDING", "PROCESSING"].includes(source.status)
        && (!snapshot || snapshot.status === "requires_capture"));
      const projectionFees = allocateCents(direct ? 0 : estimatedFee(awaiting.reduce((sum, source) => sum + source.amountCents, 0)), awaiting.map((source) => source.amountCents));
      awaiting.forEach((source, index) => {
        const rateBps = contributionRate(settings, now);
        const provisionCents = Math.round(source.amountCents * rateBps / 10000);
        const amounts: FinanceAmounts = {
          grossCents: source.amountCents, refundCents: 0, feeCents: projectionFees[index], provisionCents,
          availableCents: source.amountCents - projectionFees[index] - provisionCents, estimatedFeeCount: direct ? 0 : 1,
        };
        projections.push({ ...amounts, id: source.id, bookingId: source.bookingId, clientName: source.clientName, pets: source.pets, serviceType: source.serviceType, rateBps });
        bookings[source.bookingId].projected ||= emptyFinanceAmounts();
        addFinanceAmounts(bookings[source.bookingId].projected!, amounts);
      });
    }
  }
  // Vue des prestations futures : réutilise les montants financiers, sans créer d'encaissement.
  const upcoming: FinanceUpcoming[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (source.kind !== "BOOKING" || source.bookingStatus !== "CONFIRMED"
      || financeDay(source.startsAt) < financeDay(now) || seen.has(source.bookingId)) continue;
    seen.add(source.bookingId);
    const finance = bookings[source.bookingId];
    const amounts = emptyFinanceAmounts();
    addFinanceAmounts(amounts, finance);
    if (finance.projected) addFinanceAmounts(amounts, finance.projected);
    if (amounts.grossCents - amounts.refundCents <= 0) continue;
    finance.upcoming = { startsAt: source.startsAt, endsAt: source.endsAt };
    upcoming.push({ ...amounts, bookingId: source.bookingId, clientName: source.clientName,
      pets: source.pets, serviceType: source.serviceType, startsAt: source.startsAt, endsAt: source.endsAt,
      collectedCents: finance.grossCents - finance.refundCents, toCollectCents: finance.projected?.grossCents || 0 });
  }
  upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.bookingId.localeCompare(b.bookingId));
  return { settings, events: events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), projections, upcoming, bookings, warnings: [...warnings] };
}

export function summarizeFinanceYear(report: FinanceReport, year: number) {
  const monthly = Array.from({ length: 12 }, (_, index) => ({
    ...emptyFinanceAmounts(), key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: new Date(Date.UTC(year, index, 15)).toLocaleDateString("fr-FR", { month: "long", timeZone: "Europe/Paris" }),
    captureCount: 0, crossMonthRefund: false,
  }));
  for (const event of report.events) {
    const month = monthly.find((item) => item.key === financeMonth(event.occurredAt));
    if (!month) continue;
    addFinanceAmounts(month, event);
    if (event.kind === "CAPTURE") month.captureCount++;
    month.crossMonthRefund ||= event.crossMonthRefund;
  }
  const summary = emptyFinanceAmounts();
  monthly.forEach((month) => addFinanceAmounts(summary, month));
  const upcomingMonthly: FinanceUpcomingMonth[] = monthly.map(({ key, label }) => ({
    ...emptyFinanceAmounts(), key, label, bookingCount: 0, collectedCents: 0, toCollectCents: 0,
  }));
  for (const booking of report.upcoming) {
    const month = upcomingMonthly.find((item) => item.key === financeMonth(booking.startsAt));
    if (!month) continue;
    addFinanceAmounts(month, booking);
    month.bookingCount++;
    month.collectedCents += booking.collectedCents;
    month.toCollectCents += booking.toCollectCents;
  }
  const upcomingSummary: FinanceUpcomingSummary = { ...emptyFinanceAmounts(), bookingCount: 0, collectedCents: 0, toCollectCents: 0 };
  for (const month of upcomingMonthly) {
    addFinanceAmounts(upcomingSummary, month);
    upcomingSummary.bookingCount += month.bookingCount;
    upcomingSummary.collectedCents += month.collectedCents;
    upcomingSummary.toCollectCents += month.toCollectCents;
  }
  return { monthly, summary, upcomingMonthly, upcomingSummary };
}
