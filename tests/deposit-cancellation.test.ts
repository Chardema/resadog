import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Lot 6 (spec 07) : barème d'annulation §5.6 du plan acompte, remboursements
// sur le bon PaymentIntent (acompte vs solde), idempotence, non-régression FULL.
// Stripe, Prisma et Resend sont simulés ; la base est un magasin en mémoire
// pour que les verrous (updateMany conditionnels) soient réels.

type Row = Record<string, unknown> & { id: string };
type Intent = { id: string; status: string; amount: number; amount_capturable: number; amount_received: number; currency: string };
type Refund = { id: string; payment_intent: string; amount: number; status: string; metadata: Record<string, string> };

const { store, prismaMock, stripeMock, teamEmailMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  const store = {
    bookings: new Map<string, Row>(),
    payments: new Map<string, Row>(),
    installments: new Map<string, Row>(),
    intents: new Map<string, Intent>(),
    refunds: [] as Refund[],
    refundStatus: "succeeded",
  };

  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, expected]) => {
      const actual = row[key];
      if (expected && typeof expected === "object" && !(expected instanceof Date) && "in" in expected) {
        return (expected as { in: unknown[] }).in.includes(actual);
      }
      if (expected && typeof expected === "object" && !(expected instanceof Date)) return true;
      if (expected instanceof Date || actual instanceof Date) {
        return (actual as Date | null)?.getTime?.() === (expected as Date | null)?.getTime?.();
      }
      return actual === expected || (actual == null && expected == null);
    });

  const updateMany = (rows: Map<string, Row>) => vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    let count = 0;
    for (const row of rows.values()) {
      if (matches(row, where)) {
        Object.assign(row, data);
        count += 1;
      }
    }
    return { count };
  });

  const paymentOf = (bookingId: string) => [...store.payments.values()].find((row) => row.bookingId === bookingId) ?? null;

  const prismaMock = {
    booking: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; clientId: string } }) => {
        const row = store.bookings.get(where.id);
        if (!row || row.clientId !== where.clientId) return null;
        return { ...row, payment: paymentOf(row.id), client: { subscription: null } };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = store.bookings.get(where.id);
        return row ? { ...row, payment: paymentOf(row.id), client: { email: "client@example.test", name: "Client" }, pets: [{ name: "Rex" }], pet: null, noShow: null } : null;
      }),
      updateMany: updateMany(store.bookings),
    },
    payment: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.payments.get(where.id)!;
        Object.assign(row, data);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { bookingId: string } }) => paymentOf(where.bookingId)),
    },
    bookingInstallment: {
      // Copies, comme Prisma : un objet lu n'est jamais modifié par une écriture ultérieure.
      findFirst: vi.fn(async ({ where }: { where: { bookingId: string } }) => {
        const row = [...store.installments.values()].find((candidate) => candidate.bookingId === where.bookingId);
        return row ? { ...row } : null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { stripePaymentIntentId: string } }) => {
        const row = [...store.installments.values()].find((candidate) => candidate.stripePaymentIntentId === where.stripePaymentIntentId);
        return row ? { ...row } : null;
      }),
      updateMany: updateMany(store.installments),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.installments.get(where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    bookingNoShow: { create: vi.fn() },
    bookingNotice: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prismaMock)),
  };

  let refundSeq = 0;
  const stripeMock = {
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => {
        const intent = store.intents.get(id);
        if (!intent) throw new Error(`PI inconnu ${id}`);
        return { ...intent };
      }),
      capture: vi.fn(async (id: string, params: { amount_to_capture?: number }) => {
        const intent = store.intents.get(id)!;
        Object.assign(intent, { status: "succeeded", amount_received: params.amount_to_capture ?? intent.amount, amount_capturable: 0 });
        return { ...intent };
      }),
      cancel: vi.fn(async (id: string) => {
        const intent = store.intents.get(id)!;
        Object.assign(intent, { status: "canceled", amount_capturable: 0 });
        return { ...intent };
      }),
    },
    refunds: {
      list: vi.fn(async ({ payment_intent }: { payment_intent: string }) => ({
        data: store.refunds.filter((refund) => refund.payment_intent === payment_intent),
      })),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      create: vi.fn(async (params: { payment_intent: string; amount: number; metadata: Record<string, string> }, _options?: { idempotencyKey: string }) => {
        const refund = { id: `re_${++refundSeq}`, payment_intent: params.payment_intent, amount: params.amount, status: store.refundStatus, metadata: params.metadata };
        store.refunds.push(refund);
        return refund;
      }),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(async (id: string) => ({ id, status: "expired", metadata: {} })),
        expire: vi.fn(async (id: string) => ({ id, status: "expired" })),
      },
    },
  };

  return {
    store,
    prismaMock,
    stripeMock,
    teamEmailMock: {
      sendBookingTeamCancellationEmail: vi.fn(),
      sendBookingRefundCompletedEmail: vi.fn(),
      sendBookingRefundFailedAdminEmail: vi.fn(),
      sendBookingBalanceAlertAdminEmail: vi.fn(),
      sendBookingBalanceEmail: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1", role: "CLIENT" } })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/email", () => teamEmailMock);
vi.mock("@/lib/loyalty-ledger", () => ({ awardBookingLoyalty: vi.fn(), reverseBookingLoyalty: vi.fn() }));
vi.mock("@/lib/direct-booking", () => ({ isDirectPayment: () => false }));

import { POST as cancelRoute } from "@/app/api/bookings/[bookingId]/cancel/route";
import { processTeamCancellationPayment } from "@/lib/team-booking-cancellation";
import {
  claimBalanceForCancellation,
  getDepositCancellationKey,
  getDepositPlanTeamRefundState,
  getNoShowBalance,
  syncBalanceRefund,
} from "@/lib/deposit-cancellation";

// Garde de 300 € le 26/04/2027 à 10:00 (Paris) : acompte 90 €, solde 210 €.
const START = new Date("2027-04-26T00:00:00.000Z");
const parisNow = (iso: string) => vi.setSystemTime(new Date(iso));
const J10 = "2027-04-16T08:00:00.000Z";
const J5 = "2027-04-21T08:00:00.000Z";
const H24 = "2027-04-25T08:00:00.000Z";

function seed({
  plan = "DEPOSIT_BALANCE",
  bookingStatus = "CONFIRMED",
  deposit = "succeeded",
  balance = "SCHEDULED",
  balanceReceived = 21000,
}: {
  plan?: "FULL" | "DEPOSIT_BALANCE";
  bookingStatus?: string;
  deposit?: "succeeded" | "requires_capture";
  balance?: string | null;
  balanceReceived?: number;
} = {}) {
  const depositCents = plan === "FULL" ? 30000 : 9000;
  store.bookings.set("booking_1", {
    id: "booking_1",
    clientId: "user_1",
    status: bookingStatus,
    paymentPlan: plan,
    totalPrice: 300,
    startDate: START,
    endDate: new Date("2027-05-01T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "18:00",
    cancellationOrigin: null,
  });
  store.payments.set("payment_1", {
    id: "payment_1",
    bookingId: "booking_1",
    amount: depositCents / 100,
    capturedAmount: deposit === "succeeded" ? depositCents / 100 : 0,
    status: deposit === "succeeded" ? "SUCCEEDED" : "PROCESSING",
    stripePaymentId: "pi_deposit",
    paymentMethod: null,
    paidAt: deposit === "succeeded" ? new Date("2026-11-27T10:00:00.000Z") : null,
    refundedAt: null,
  });
  store.intents.set("pi_deposit", {
    id: "pi_deposit",
    status: deposit,
    amount: depositCents,
    amount_capturable: deposit === "requires_capture" ? depositCents : 0,
    amount_received: deposit === "succeeded" ? depositCents : 0,
    currency: "eur",
  });
  if (plan === "DEPOSIT_BALANCE" && balance) {
    const collected = balance === "SUCCEEDED";
    store.installments.set("inst_1", {
      id: "inst_1",
      bookingId: "booking_1",
      kind: "BALANCE",
      amount: 210,
      status: balance,
      stripePaymentIntentId: collected || balance === "PROCESSING" ? "pi_balance" : balance === "FAILED" ? "pi_balance_failed" : null,
      stripeCheckoutSessionId: null,
      refundedAmount: null,
      nextAttemptAt: balance === "FAILED" ? new Date("2027-04-22T00:00:00.000Z") : null,
    });
    if (collected) {
      store.intents.set("pi_balance", { id: "pi_balance", status: "succeeded", amount: balanceReceived, amount_capturable: 0, amount_received: balanceReceived, currency: "eur" });
    }
  }
}

const cancel = () =>
  cancelRoute(
    new NextRequest("http://localhost/api/bookings/booking_1/cancel", { method: "POST", body: JSON.stringify({ confirmed: true }) }),
    { params: Promise.resolve({ bookingId: "booking_1" }) }
  );

const refundsOn = (paymentIntent: string) => store.refunds.filter((refund) => refund.payment_intent === paymentIntent);
const installment = () => store.installments.get("inst_1")!;
const booking = () => store.bookings.get("booking_1")!;
const payment = () => store.payments.get("payment_1")!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  store.bookings.clear();
  store.payments.clear();
  store.installments.clear();
  store.intents.clear();
  store.refunds.length = 0;
  store.refundStatus = "succeeded";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe("annulation client d'un plan acompte (barème §5.6)", () => {
  it("≥ J-7, acompte capturé : acompte remboursé à 100 % sur son PaymentIntent, solde jamais prélevé", async () => {
    seed();
    parisNow(J10);
    const response = await cancel();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ tier: "FREE", policy: "FREE", amountRefunded: 90, amountRetained: 0, freeCancellationWindowHours: 168 });
    expect(refundsOn("pi_deposit")).toEqual([expect.objectContaining({ amount: 9000 })]);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_deposit", amount: 9000 }),
      { idempotencyKey: "booking:booking_1:client-cancellation:deposit-refund" }
    );
    expect(installment()).toMatchObject({ status: "CANCELED", nextAttemptAt: null });
    expect(booking()).toMatchObject({ status: "CANCELLED", cancellationOrigin: "CLIENT" });
    expect(payment()).toMatchObject({ status: "REFUNDED", refundAmount: 90, refundStatus: "SUCCEEDED" });
  });

  it("≥ J-7, demande non encore acceptée : l'autorisation de l'acompte est libérée sans capture", async () => {
    seed({ bookingStatus: "PENDING", deposit: "requires_capture", balance: null });
    parisNow(J10);
    const body = await (await cancel()).json();

    expect(body).toMatchObject({ tier: "FREE", amountRefunded: 0, amountReleased: 90, amountRetained: 0 });
    expect(stripeMock.paymentIntents.cancel).toHaveBeenCalledWith("pi_deposit", {}, { idempotencyKey: "booking:booking_1:client-cancellation:deposit-release" });
    expect(stripeMock.paymentIntents.capture).not.toHaveBeenCalled();
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
    expect(payment()).toMatchObject({ status: "REFUNDED", capturedAmount: 0 });
  });

  it("J-7 → 48 h, solde prélevé : acompte conservé, solde remboursé sur le PaymentIntent du solde", async () => {
    seed({ balance: "SUCCEEDED" });
    parisNow(J5);
    const body = await (await cancel()).json();

    expect(body).toMatchObject({ tier: "DEPOSIT_RETAINED", policy: "LATE", amountRefunded: 210, amountRetained: 90 });
    expect(refundsOn("pi_deposit")).toHaveLength(0);
    expect(refundsOn("pi_balance")).toEqual([expect.objectContaining({ amount: 21000 })]);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_balance", metadata: expect.objectContaining({ type: "booking_balance_refund", installmentId: "inst_1" }) }),
      { idempotencyKey: "booking:booking_1:client-cancellation:balance-refund" }
    );
    expect(installment()).toMatchObject({ status: "REFUNDED", refundedAmount: 210 });
    expect(payment()).toMatchObject({ status: "SUCCEEDED", capturedAmount: 90, refundAmount: 0 });
  });

  it("J-7 → 48 h, solde en échec : acompte conservé, aucune somme rendue, échéance fermée", async () => {
    seed({ balance: "FAILED" });
    parisNow(J5);
    const body = await (await cancel()).json();

    expect(body).toMatchObject({ tier: "DEPOSIT_RETAINED", amountRefunded: 0, amountRetained: 90 });
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
    expect(installment()).toMatchObject({ status: "CANCELED" });
  });

  it("< 48 h, solde prélevé : 50 % du total retenu (acompte + 60 € du solde)", async () => {
    seed({ balance: "SUCCEEDED" });
    parisNow(H24);
    const body = await (await cancel()).json();

    expect(body).toMatchObject({ tier: "HALF_RETAINED", amountRefunded: 150, amountRetained: 150 });
    expect(refundsOn("pi_deposit")).toHaveLength(0);
    expect(refundsOn("pi_balance")).toEqual([expect.objectContaining({ amount: 15000 })]);
    expect(installment()).toMatchObject({ status: "SUCCEEDED", refundedAmount: 150 });
  });

  it("< 48 h, solde non prélevé : retenue bornée à l'acompte encaissé, aucun nouveau prélèvement", async () => {
    seed({ balance: "FAILED" });
    parisNow(H24);
    const body = await (await cancel()).json();

    expect(body).toMatchObject({ tier: "HALF_RETAINED", amountRefunded: 0, amountRetained: 90 });
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
    expect(stripeMock.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("solde intérêts L214-2 déduits (205 € encaissés) : la retenue < 48 h reste ≤ montants encaissés", async () => {
    seed({ balance: "SUCCEEDED", balanceReceived: 20500 });
    parisNow(H24);
    const body = await (await cancel()).json();
    expect(body).toMatchObject({ amountRetained: 150, amountRefunded: 145 });
    expect(refundsOn("pi_balance")[0].amount).toBe(14500);
  });

  it("prélèvement du solde en cours : 409, réservation et échéance intactes, aucun appel Stripe d'écriture", async () => {
    seed({ balance: "PROCESSING" });
    parisNow(J5);
    const response = await cancel();

    expect(response.status).toBe(409);
    expect(booking()).toMatchObject({ status: "CONFIRMED", cancellationOrigin: null });
    expect(installment().status).toBe("PROCESSING");
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
  });

  it("échec Stripe pendant le remboursement : réservation et échéance restaurées", async () => {
    seed({ balance: "FAILED" });
    parisNow(J10);
    stripeMock.refunds.create.mockRejectedValueOnce(new Error("réseau"));
    const response = await cancel();

    expect(response.status).toBe(500);
    expect(booking()).toMatchObject({ status: "CONFIRMED", cancellationOrigin: null });
    expect(installment()).toMatchObject({ status: "FAILED", nextAttemptAt: new Date("2027-04-22T00:00:00.000Z") });
  });

  it("session de reprise ouverte : elle est expirée avant la fermeture de l'échéance", async () => {
    seed({ balance: "FAILED" });
    installment().stripeCheckoutSessionId = "cs_balance";
    stripeMock.checkout.sessions.retrieve.mockResolvedValueOnce({ id: "cs_balance", status: "open", metadata: {} });
    parisNow(J10);
    const response = await cancel();

    expect(response.status).toBe(200);
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith("cs_balance");
    expect(installment()).toMatchObject({ status: "CANCELED", stripeCheckoutSessionId: null });
  });

  it("session de reprise déjà payée (webhook en attente) : 409, rien n'est annulé", async () => {
    seed({ balance: "FAILED" });
    installment().stripeCheckoutSessionId = "cs_balance";
    stripeMock.checkout.sessions.retrieve.mockResolvedValueOnce({ id: "cs_balance", status: "complete", metadata: {} });
    parisNow(J10);
    const response = await cancel();

    expect(response.status).toBe(409);
    expect(installment().status).toBe("FAILED");
    expect(booking().status).toBe("CONFIRMED");
  });
});

describe("non-régression FULL : barème 48 h / 50 % inchangé", () => {
  it("≥ 48 h : remboursement intégral avec la clé historique, aucune échéance lue", async () => {
    seed({ plan: "FULL" });
    parisNow(J5);
    const body = await (await cancel()).json();

    expect(body).toEqual({ success: true, policy: "FREE", freeCancellationWindowHours: 48, amountRefunded: 300, amountRetained: 0 });
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      { payment_intent: "pi_deposit", amount: 30000, metadata: { bookingId: "booking_1", cancellationOrigin: "CLIENT" } },
      { idempotencyKey: "booking:booking_1:client-cancellation-refund" }
    );
    expect(prismaMock.bookingInstallment.findFirst).not.toHaveBeenCalled();
  });

  it("< 48 h : 50 % du PaymentIntent remboursé", async () => {
    seed({ plan: "FULL" });
    parisNow(H24);
    const body = await (await cancel()).json();
    expect(body).toEqual({ success: true, policy: "LATE", freeCancellationWindowHours: 48, amountRefunded: 150, amountRetained: 150 });
    expect(payment()).toMatchObject({ status: "PARTIALLY_REFUNDED" });
  });

  it("< 48 h sur autorisation : capture partielle de 50 % avec la clé historique", async () => {
    seed({ plan: "FULL", bookingStatus: "PENDING", deposit: "requires_capture" });
    parisNow(H24);
    const body = await (await cancel()).json();
    expect(body).toMatchObject({ policy: "LATE", amountRetained: 150 });
    expect(stripeMock.paymentIntents.capture).toHaveBeenCalledWith(
      "pi_deposit",
      { amount_to_capture: 15000 },
      { idempotencyKey: "booking:booking_1:late-cancellation-capture" }
    );
  });
});

describe("annulation par l'équipe d'un plan acompte", () => {
  const team = async () => {
    const claim = await claimBalanceForCancellation("booking_1");
    const row = (await prismaMock.booking.findUnique({ where: { id: "booking_1" } }))!;
    return processTeamCancellationPayment("booking_1", row.payment as never, { booking: row as never, balance: claim });
  };

  it("remboursement intégral : acompte et solde, chacun sur son PaymentIntent avec sa clé", async () => {
    seed({ balance: "SUCCEEDED" });
    parisNow(H24);
    const result = await team();

    expect(result).toMatchObject({ action: "REFUND_SUCCEEDED", amountRefunded: 300, refundStatus: "SUCCEEDED" });
    expect(refundsOn("pi_deposit")[0]).toMatchObject({ amount: 9000 });
    expect(refundsOn("pi_balance")[0]).toMatchObject({ amount: 21000 });
    const keys = stripeMock.refunds.create.mock.calls.map((call) => call[1]?.idempotencyKey);
    expect(keys).toEqual([
      getDepositCancellationKey("booking_1", "TEAM", "deposit-refund"),
      getDepositCancellationKey("booking_1", "TEAM", "balance-refund"),
    ]);
    expect(result.installmentUpdate).toEqual({ id: "inst_1", data: { refundedAmount: 210, status: "REFUNDED" } });
  });

  it("rejeu après coupure : aucun double remboursement (cumul Stripe déjà actif)", async () => {
    seed({ balance: "SUCCEEDED" });
    store.refunds.push(
      { id: "re_old_dep", payment_intent: "pi_deposit", amount: 9000, status: "succeeded", metadata: {} },
      { id: "re_old_bal", payment_intent: "pi_balance", amount: 21000, status: "pending", metadata: {} },
    );
    parisNow(J10);
    const result = await team();

    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ action: "REFUND_PENDING", amountRefunded: 300, refundStatus: "PENDING" });
  });

  it("solde à venir : échéance fermée, acompte remboursé, refus de la demande = libération", async () => {
    seed({ balance: "SCHEDULED" });
    parisNow(J10);
    const result = await team();
    expect(result).toMatchObject({ action: "REFUND_SUCCEEDED", amountRefunded: 90 });
    expect(installment().status).toBe("CANCELED");

    store.refunds.length = 0;
    seed({ bookingStatus: "PENDING", deposit: "requires_capture", balance: null });
    vi.clearAllMocks();
    const refusal = await team();
    expect(refusal).toMatchObject({ action: "AUTHORIZATION_RELEASED", amountRefunded: 0 });
    expect(stripeMock.paymentIntents.cancel).toHaveBeenCalledWith(
      "pi_deposit",
      { cancellation_reason: "abandoned" },
      { idempotencyKey: "booking:booking_1:team-cancellation:deposit-release" }
    );
  });

  it("e-mail de fin de remboursement seulement quand acompte ET solde sont remboursés", async () => {
    seed({ balance: "SUCCEEDED" });
    store.refunds.push({ id: "re_dep", payment_intent: "pi_deposit", amount: 9000, status: "succeeded", metadata: {} });
    expect(await getDepositPlanTeamRefundState("booking_1")).toEqual({ complete: false, amount: 0 });
    store.refunds.push({ id: "re_bal", payment_intent: "pi_balance", amount: 21000, status: "succeeded", metadata: {} });
    expect(await getDepositPlanTeamRefundState("booking_1")).toEqual({ complete: true, amount: 300 });
  });
});

describe("webhook refund.* sur le PaymentIntent du solde", () => {
  it("met à jour le cumul remboursé de l'échéance ; ignore un PaymentIntent inconnu", async () => {
    seed({ balance: "SUCCEEDED" });
    store.refunds.push({ id: "re_bal", payment_intent: "pi_balance", amount: 6000, status: "succeeded", metadata: {} });
    const sync = await syncBalanceRefund({ id: "re_bal", payment_intent: "pi_balance", status: "succeeded" } as never);
    expect(sync).toEqual({ bookingId: "booking_1", refundedAmount: 60, failed: false });
    expect(installment()).toMatchObject({ status: "SUCCEEDED", refundedAmount: 60 });

    expect(await syncBalanceRefund({ id: "re_x", payment_intent: "pi_other", status: "succeeded" } as never)).toBeNull();
  });
});

describe("non-présentation d'un plan acompte : retenue ≤ montants encaissés", () => {
  it("solde encaissé : acompte + solde retenus", async () => {
    seed({ balance: "SUCCEEDED" });
    const result = await getNoShowBalance("booking_1");
    expect(result.collectedCents).toBe(21000);
    expect(installment().status).toBe("SUCCEEDED");
  });

  it("solde non encaissé : échéance fermée (aucun prélèvement ultérieur), rien de plus retenu", async () => {
    seed({ balance: "FAILED" });
    const result = await getNoShowBalance("booking_1");
    expect(result.collectedCents).toBe(0);
    expect(installment().status).toBe("CANCELED");
  });

  it("solde partiellement remboursé ou en cours : refus, échéance intacte", async () => {
    seed({ balance: "SUCCEEDED" });
    installment().refundedAmount = 10;
    await expect(getNoShowBalance("booking_1")).rejects.toThrow(/Solde remboursé/);
    seed({ balance: "PROCESSING" });
    await expect(getNoShowBalance("booking_1")).rejects.toThrow(/en cours/);
    expect(installment().status).toBe("PROCESSING");
  });
});

describe("rejeu de l'annulation client : idempotence", () => {
  it("une annulation déjà faite est sans effet (aucun nouveau remboursement)", async () => {
    seed({ balance: "SUCCEEDED" });
    parisNow(J5);
    await cancel();
    const calls = stripeMock.refunds.create.mock.calls.length;
    const again = await (await cancel()).json();
    expect(again).toEqual({ success: true, unchanged: true });
    expect(stripeMock.refunds.create.mock.calls.length).toBe(calls);
  });
});

// Le PaymentIntent capturé sur une partie seulement de l'autorisation ne
// doit jamais conserver plus que la tranche prévue.
describe("capture partielle de l'acompte (demande non acceptée, < 48 h)", () => {
  it("capture au plus l'acompte autorisé", async () => {
    seed({ bookingStatus: "PENDING", deposit: "requires_capture", balance: null });
    parisNow(H24);
    const body = await (await cancel()).json();
    expect(body).toMatchObject({ tier: "HALF_RETAINED", amountRetained: 90, amountReleased: 0 });
    expect(stripeMock.paymentIntents.capture).toHaveBeenCalledWith(
      "pi_deposit",
      { amount_to_capture: 9000 },
      { idempotencyKey: "booking:booking_1:client-cancellation:deposit-capture" }
    );
  });
});

describe("garde sk_test_ de la retenue du barème acompte", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("clé live : aucune capture, demande restaurée", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    seed({ bookingStatus: "PENDING", deposit: "requires_capture", balance: null });
    parisNow(H24);

    const response = await cancel();

    expect(response.ok).toBe(false);
    expect(stripeMock.paymentIntents.capture).not.toHaveBeenCalled();
    expect(stripeMock.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(booking()).toMatchObject({ status: "PENDING", cancellationOrigin: null });
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("sk_live_factice");
  });

  it("FULL avec une clé live : capture partielle historique inchangée", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_factice_0000");
    seed({ plan: "FULL", bookingStatus: "PENDING", deposit: "requires_capture" });
    parisNow(H24);
    const body = await (await cancel()).json();
    expect(body).toMatchObject({ policy: "LATE", amountRetained: 150 });
    expect(stripeMock.paymentIntents.capture).toHaveBeenCalledTimes(1);
  });
});
