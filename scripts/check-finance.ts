import assert from "node:assert/strict";
import {
  allocateCents, buildFinanceReport, contributionRate, DEFAULT_FINANCE_SETTINGS,
  financeDay, financeMonth, financeSettingsSchema, summarizeFinanceYear,
  type FinanceSource, type StripeFinanceSnapshot,
} from "../src/lib/finance";

const now = new Date("2026-09-10T12:00:00Z");
const source = (overrides: Partial<FinanceSource> = {}): FinanceSource => ({
  id: "payment-a", bookingId: "booking-a", kind: "BOOKING", clientName: "Client test", pets: ["Milo"],
  serviceType: "HOUSE_SITTING", amountCents: 8000, capturedCents: 0, refundCents: 0,
  paidAt: null, refundedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  status: "PENDING", bookingStatus: "PENDING", paymentIntentId: "pi_a",
  startsAt: "2026-09-12T10:00:00Z", endsAt: "2026-09-13T10:00:00Z", ...overrides,
});
const snapshot = (overrides: Partial<StripeFinanceSnapshot> = {}): StripeFinanceSnapshot => ({
  status: "succeeded", currency: "eur", grossCents: 8000, paidAt: now.toISOString(),
  feeCents: 145, refunds: [], disputed: false, ...overrides,
});
const report = (sources: FinanceSource[], snapshots = new Map<string, StripeFinanceSnapshot>(), settings = DEFAULT_FINANCE_SETTINGS) =>
  buildFinanceReport(sources, snapshots, settings, now);
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`); }

check("80 € en attente : seulement une projection, 17,60 € de réserve et 60,95 € disponibles", () => {
  const result = report([source()], new Map([["pi_a", snapshot({ status: "requires_capture", grossCents: 0, paidAt: null, feeCents: null })]]));
  assert.equal(result.events.length, 0);
  assert.equal(result.projections[0].grossCents, 8000);
  assert.equal(result.projections[0].feeCents, 145);
  assert.equal(result.projections[0].provisionCents, 1760);
  assert.equal(result.projections[0].availableCents, 6095);
  assert.equal(summarizeFinanceYear(result, 2026).summary.grossCents, 0);
  assert.equal(result.bookings["booking-a"].projected?.grossCents, 8000);
});
check("capture partielle : montant et frais réellement prélevés prioritaires sur la réservation", () => {
  const result = report([source()], new Map([["pi_a", snapshot({ grossCents: 5000, feeCents: 175 })]]));
  assert.equal(result.projections.length, 0);
  assert.equal(result.events[0].grossCents, 5000);
  assert.equal(result.events[0].provisionCents, 1100);
  assert.equal(result.events[0].availableCents, 3725);
  assert.equal(result.events[0].estimatedFeeCount, 0);
});
check("paiement partagé : aucun double encaissement ni double frais fixes", () => {
  const result = report([source(), source({ id: "payment-b", bookingId: "booking-b", amountCents: 4000 })], new Map([["pi_a", snapshot({ grossCents: 12000, feeCents: 205 })]]));
  const total = summarizeFinanceYear(result, 2026).summary;
  assert.equal(total.grossCents, 12000);
  assert.equal(total.feeCents, 205);
  assert.equal(total.provisionCents, 2640);
  assert.equal(result.bookings["booking-a"].grossCents, 8000);
});
check("remboursement affecté à la bonne réservation d’un paiement partagé", () => {
  const result = report([source(), source({ id: "payment-b", bookingId: "booking-b", amountCents: 4000 })], new Map([["pi_a", snapshot({ grossCents: 12000, feeCents: 205,
    refunds: [{ id: "re_b", bookingId: "booking-b", amountCents: 4000, occurredAt: "2026-10-01T12:00:00Z", feeCents: 0 }],
  })]]));
  assert.equal(result.bookings["booking-a"].refundCents, 0);
  assert.equal(result.bookings["booking-b"].refundCents, 4000);
  assert.equal(result.bookings["booking-b"].provisionCents, 0);
});
check("ACRE seulement sur sa période confirmée, avec bornes incluses et reprise du taux habituel", () => {
  const settings = { ...DEFAULT_FINANCE_SETTINGS, acreEnabled: true, acreRateBps: 1600, acreStartsOn: "2026-09-01", acreEndsOn: "2026-09-30" };
  assert.equal(contributionRate(settings, "2026-08-31T12:00:00Z"), 2200);
  assert.equal(contributionRate(settings, "2026-09-01T12:00:00Z"), 1600);
  assert.equal(contributionRate(settings, "2026-09-30T12:00:00Z"), 1600);
  assert.equal(contributionRate(settings, "2026-10-01T12:00:00Z"), 2200);
  assert.equal(contributionRate({ ...settings, acreEnabled: false }, now), 2200);
});
check("remboursements dans leurs mois réels et annulation de la réserve au taux d’origine", () => {
  const settings = { ...DEFAULT_FINANCE_SETTINGS, acreEnabled: true, acreRateBps: 1600, acreStartsOn: "2026-09-01", acreEndsOn: "2026-09-30" };
  const result = report([source()], new Map([["pi_a", snapshot({ refunds: [
    { id: "re_1", amountCents: 3001, occurredAt: "2026-10-01T12:00:00Z", feeCents: 0 },
    { id: "re_2", amountCents: 4999, occurredAt: "2026-11-01T12:00:00Z", feeCents: 0 },
  ] })]]), settings);
  const { monthly, summary } = summarizeFinanceYear(result, 2026);
  assert.equal(monthly[8].grossCents, 8000);
  assert.equal(monthly[8].provisionCents, 1280);
  assert.equal(monthly[9].refundCents, 3001);
  assert.equal(monthly[9].crossMonthRefund, true);
  assert.equal(monthly[10].refundCents, 4999);
  assert.equal(summary.refundCents, 8000);
  assert.equal(summary.provisionCents, 0);
  assert.equal(summary.availableCents, -145);
});
check("arrondis de remboursements répétés : aucune ligne négative ni centime perdu", () => {
  const weights = [15, 15, 9, 5, 5, 2];
  const gross = weights.reduce((a, b) => a + b, 0);
  const result = report(weights.map((amountCents, i) => source({ id: `p${i}`, bookingId: `b${i}`, amountCents })), new Map([["pi_a", snapshot({ grossCents: gross, feeCents: 3,
    refunds: Array.from({ length: gross }, (_, i) => ({ id: `r${String(i).padStart(2, "0")}`, amountCents: 1, occurredAt: now.toISOString(), feeCents: 0 })),
  })]]));
  for (const event of result.events.filter((e) => e.kind === "REFUND")) assert.ok(event.refundCents >= 0);
  for (const [i, amount] of weights.entries()) {
    assert.equal(result.bookings[`b${i}`].refundCents, amount);
    assert.equal(result.bookings[`b${i}`].provisionCents, 0);
  }
  assert.equal(summarizeFinanceYear(result, 2026).summary.availableCents, -3);
  assert.ok(result.warnings.length > 0);
  assert.deepEqual(allocateCents(-3, [1, 1]), [-2, -1]);
});
check("classement des dates en heure de Paris, y compris au changement d’année", () => {
  assert.equal(financeDay("2026-08-31T22:30:00Z"), "2026-09-01");
  assert.equal(financeMonth("2026-12-31T23:30:00Z"), "2027-01");
  const result = report([source()], new Map([["pi_a", snapshot({ paidAt: "2026-12-31T23:30:00Z" })]]));
  assert.equal(summarizeFinanceYear(result, 2026).summary.grossCents, 0);
  assert.equal(summarizeFinanceYear(result, 2027).monthly[0].grossCents, 8000);
});
check("tout l’historique compte au-delà de 80 paiements", () => {
  const sources = Array.from({ length: 101 }, (_, i) => source({ id: `p${i}`, bookingId: `b${i}`, paymentIntentId: `pi_${i}` }));
  const result = report(sources, new Map(sources.map((s) => [s.paymentIntentId!, snapshot()])));
  assert.equal(summarizeFinanceYear(result, 2026).summary.grossCents, 808000);
  assert.equal(result.events.length, 101);
});
check("refus et autorisations annulées ne créent aucun revenu ni prévision", () => {
  assert.equal(report([source({ bookingStatus: "CANCELLED" })]).projections.length, 0);
  assert.equal(report([source()], new Map([["pi_a", snapshot({ status: "canceled", grossCents: 0, paidAt: null })]])).projections.length, 0);
});
check("frais inconnus explicitement estimés, capture sans date et autre devise exclues", () => {
  const estimated = report([source()], new Map([["pi_a", snapshot({ feeCents: null })]]));
  assert.equal(estimated.events[0].feeCents, 145);
  assert.equal(estimated.events[0].estimatedFeeCount, 1);
  const undated = report([source()], new Map([["pi_a", snapshot({ paidAt: null })]]));
  assert.equal(undated.events.length, 0);
  assert.equal(undated.warnings.length, 1);
  const foreign = report([source()], new Map([["pi_a", snapshot({ currency: "usd" })]]));
  assert.equal(foreign.events.length, 0);
  assert.equal(foreign.warnings.length, 1);
});
check("repli local : montants et frais estimés, avec avertissement visible", () => {
  const result = report([source({ status: "SUCCEEDED", capturedCents: 8000, paidAt: now.toISOString() })]);
  assert.equal(result.events[0].grossCents, 8000);
  assert.equal(result.events[0].estimatedFeeCount, 1);
  assert.ok(result.warnings.length > 0);
});
check("paramètres invalides refusés : taux, dates impossibles, ACRE incomplète", () => {
  assert.equal(financeSettingsSchema.safeParse(DEFAULT_FINANCE_SETTINGS).success, true);
  for (const override of [{ standardRateBps: NaN }, { standardRateBps: -1 }, { standardRateBps: 10001 }, { standardRateBps: 22.5 }, { acreEnabled: true }, { acreStartsOn: "2026-02-30" }, { acreStartsOn: "2026-10-01", acreEndsOn: "2026-09-30" }, { unexpected: true }]) {
    assert.equal(financeSettingsSchema.safeParse({ ...DEFAULT_FINANCE_SETTINGS, ...override }).success, false);
  }
});
check("réservation acceptée déjà payée : prévisionnel au mois de prestation, encaissement conservé à sa date", () => {
  const result = report([source({ bookingStatus: "CONFIRMED", status: "SUCCEEDED" })], new Map([["pi_a", snapshot({ paidAt: "2026-08-20T12:00:00Z" })]]));
  const totals = summarizeFinanceYear(result, 2026);
  assert.equal(result.upcoming.length, 1);
  assert.equal(result.projections.length, 0);
  assert.equal(result.events.length, 1);
  assert.equal(totals.monthly[7].grossCents, 8000);
  assert.equal(totals.monthly[8].grossCents, 0);
  assert.equal(totals.upcomingMonthly[8].grossCents, 8000);
  assert.equal(totals.upcomingSummary.bookingCount, 1);
  assert.equal(totals.upcomingSummary.collectedCents, 8000);
  assert.equal(totals.upcomingSummary.toCollectCents, 0);
  assert.equal(totals.upcomingSummary.provisionCents, 1760);
  assert.equal(totals.upcomingSummary.availableCents, 6095);
  assert.ok(result.bookings["booking-a"].upcoming);
});
check("réservation acceptée non encaissée : projection sans fausse recette", () => {
  const result = report([source({ bookingStatus: "CONFIRMED" })], new Map([["pi_a", snapshot({ status: "requires_capture", grossCents: 0, feeCents: null, paidAt: null })]]));
  assert.equal(result.upcoming[0].collectedCents, 0);
  assert.equal(result.upcoming[0].toCollectCents, 8000);
  assert.equal(result.upcoming[0].estimatedFeeCount, 1);
  assert.equal(summarizeFinanceYear(result, 2026).summary.grossCents, 0);
  assert.equal(result.projections.length, 1);
});
check("prévisionnel accepté : exclusion des demandes en attente, annulations, prestations terminées ou déjà commencées", () => {
  for (const bookingStatus of ["PENDING", "CANCELLED", "COMPLETED", "CANCELLING", "ACCEPTING"]) {
    assert.equal(report([source({ bookingStatus })], new Map([["pi_a", snapshot()]])).upcoming.length, 0);
  }
  const past = source({ bookingStatus: "CONFIRMED", startsAt: "2026-09-09T10:00:00Z", endsAt: "2026-09-12T10:00:00Z" });
  assert.equal(report([past], new Map([["pi_a", snapshot()]])).upcoming.length, 0);
  const today = source({ bookingStatus: "CONFIRMED", startsAt: "2026-09-09T22:30:00Z" });
  assert.equal(report([today], new Map([["pi_a", snapshot()]])).upcoming.length, 1);
});
check("séjour sur plusieurs mois compté une fois et année future disponible dans le rapport", () => {
  const booking = source({ bookingStatus: "CONFIRMED", startsAt: "2026-09-29T10:00:00Z", endsAt: "2026-10-01T10:00:00Z" });
  const result = report([booking], new Map([["pi_a", snapshot()]]));
  assert.equal(summarizeFinanceYear(result, 2026).upcomingMonthly[8].bookingCount, 1);
  assert.equal(summarizeFinanceYear(result, 2026).upcomingMonthly[9].bookingCount, 0);
  const future = report([{ ...booking, startsAt: "2026-12-31T23:30:00Z", endsAt: "2027-01-04T10:00:00Z" }], new Map([["pi_a", snapshot()]]));
  assert.equal(summarizeFinanceYear(future, 2026).upcomingSummary.bookingCount, 0);
  assert.equal(summarizeFinanceYear(future, 2027).upcomingMonthly[0].grossCents, 8000);
});
check("prévisionnel après remboursement, avec taux du paiement même si l’ACRE finit avant la prestation", () => {
  const settings = { ...DEFAULT_FINANCE_SETTINGS, acreEnabled: true, acreRateBps: 1600, acreStartsOn: "2026-09-01", acreEndsOn: "2026-09-30" };
  const booking = source({ bookingStatus: "CONFIRMED", startsAt: "2026-10-12T10:00:00Z", endsAt: "2026-10-13T10:00:00Z" });
  const result = report([booking], new Map([["pi_a", snapshot({ refunds: [{ id: "re_a", amountCents: 2000, occurredAt: now.toISOString(), feeCents: 0 }] })]]), settings);
  assert.equal(result.upcoming[0].collectedCents, 6000);
  assert.equal(result.upcoming[0].provisionCents, 960);
  assert.equal(result.upcoming[0].availableCents, 4895);
  const refunded = report([booking], new Map([["pi_a", snapshot({ refunds: [{ id: "re_a", amountCents: 8000, occurredAt: now.toISOString(), feeCents: 0 }] })]]));
  assert.equal(refunded.upcoming.length, 0);
});
check("paiement partagé et supplément : une seule prévision par réservation, frais sans doublon", () => {
  const result = report([
    source({ bookingStatus: "CONFIRMED" }),
    source({ id: "payment-b", bookingId: "booking-b", amountCents: 4000, bookingStatus: "CONFIRMED" }),
    source({ id: "charge-a", kind: "CHARGE", paymentIntentId: "pi_charge", amountCents: 1000, bookingStatus: "CONFIRMED" }),
  ], new Map([["pi_a", snapshot({ grossCents: 12000, feeCents: 205 })], ["pi_charge", snapshot({ grossCents: 1000, feeCents: 40 })]]));
  const totals = summarizeFinanceYear(result, 2026);
  assert.equal(result.upcoming.length, 2);
  assert.equal(result.upcoming.find(b => b.bookingId === "booking-a")?.grossCents, 9000);
  assert.equal(totals.upcomingSummary.grossCents, 13000);
  assert.equal(totals.upcomingSummary.feeCents, 245);
  assert.equal(totals.summary.grossCents, 13000);
});
console.log(`\n${checks} contrôles financiers réussis.`);
