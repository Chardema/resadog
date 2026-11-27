import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Stripe, Prisma et Resend sont simulés : aucun appel réseau.
const { flags, prismaMock, txMock, stripeMock, emailMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.CRON_SECRET = "cron_test_secret";
  const txMock = {
    booking: { updateMany: vi.fn() },
    payment: { updateMany: vi.fn(), deleteMany: vi.fn() },
  };
  return {
    flags: { enabled: true },
    txMock,
    prismaMock: {
      booking: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      payment: { findFirst: vi.fn(), deleteMany: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(txMock)),
    },
    stripeMock: { paymentIntents: { retrieve: vi.fn() } },
    emailMock: {
      sendBookingAuthorizationExpiredEmail: vi.fn(),
      sendBookingAuthorizationAlertAdminEmail: vi.fn(),
    },
  };
});

vi.mock("@/lib/payment-plan", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/payment-plan")>();
  return {
    ...original,
    isPaymentPlanEnabled: () => flags.enabled,
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }));
vi.mock("@/lib/email", () => emailMock);
vi.mock("@/lib/google-review-requests", () => ({
  getBookingCompletionDate: vi.fn(() => new Date()),
  sendGoogleReviewForBookings: vi.fn(),
}));

import {
  assertExpiryNotified,
  expireAuthorizationFromCharge,
  expireBookingAuthorization,
  getAuthorizationCaptureBefore,
  isBookingAuthorizationIntent,
  scanBookingAuthorizations,
  shouldNotifyClientOfExpiry,
} from "@/lib/authorization-expiry";
import { GET as cleanupBookings } from "@/app/api/cron/cleanup-bookings/route";
import type Stripe from "stripe";

const NOW = new Date("2026-12-03T04:00:00.000Z");
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking_1",
  status: "PENDING",
  serviceType: "BOARDING",
  totalPrice: 300,
  startDate: new Date("2027-04-26T00:00:00.000Z"),
  endDate: new Date("2027-05-01T00:00:00.000Z"),
  startTime: "10:00",
  endTime: "18:00",
  specialRequests: null,
  createdAt: new Date("2026-11-26T10:00:00.000Z"),
  client: { email: "client@example.test", name: "Client" },
  pets: [{ name: "Rex" }],
  pet: null,
  ...overrides,
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: "payment_1",
  amount: 90,
  status: "PROCESSING",
  stripePaymentId: "pi_auth",
  ...overrides,
});

const canceledIntent = (overrides: Partial<Stripe.PaymentIntent> = {}) => ({
  id: "pi_auth",
  object: "payment_intent",
  status: "canceled",
  cancellation_reason: "automatic",
  canceled_at: seconds(new Date("2026-12-03T02:00:00.000Z")),
  metadata: { bookingIds: "booking_1", paymentPlan: "DEPOSIT_BALANCE" },
  ...overrides,
}) as unknown as Stripe.PaymentIntent;

beforeEach(() => {
  vi.clearAllMocks();
  flags.enabled = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  txMock.booking.updateMany.mockResolvedValue({ count: 1 });
  txMock.payment.updateMany.mockResolvedValue({ count: 1 });
  txMock.payment.deleteMany.mockResolvedValue({ count: 0 });
  emailMock.sendBookingAuthorizationExpiredEmail.mockResolvedValue({ id: "email_1" });
  emailMock.sendBookingAuthorizationAlertAdminEmail.mockResolvedValue({ id: "email_2" });
});

describe("expireBookingAuthorization", () => {
  it("drapeau désactivé : aucun accès base ni e-mail", async () => {
    flags.enabled = false;
    const result = await expireBookingAuthorization(canceledIntent(), { now: NOW });
    expect(result.outcome).toBe("DISABLED");
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(emailMock.sendBookingAuthorizationExpiredEmail).not.toHaveBeenCalled();
  });

  it("passe la demande PENDING et son paiement en EXPIRED, prévient le client et l'équipe", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment(), booking: makeBooking() });

    const result = await expireBookingAuthorization(canceledIntent(), { now: NOW });

    expect(result).toEqual({ outcome: "EXPIRED", bookingId: "booking_1", clientNotified: true, notifyErrors: [] });
    expect(txMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking_1", status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    expect(txMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment_1", stripePaymentId: "pi_auth", status: "PROCESSING" },
      data: { status: "EXPIRED" },
    });
    expect(emailMock.sendBookingAuthorizationExpiredEmail).toHaveBeenCalledWith(
      "client@example.test",
      "Client",
      "Rex",
      { idempotencyKey: "booking-authorization-expired-booking_1" }
    );
    expect(emailMock.sendBookingAuthorizationAlertAdminEmail).toHaveBeenCalledWith(
      "EXPIRED",
      expect.objectContaining({ bookingId: "booking_1", authorizedAmount: 90, clientNotified: true }),
      { idempotencyKey: "booking-authorization-expired-admin-booking_1" }
    );
  });

  it("ignore une autorisation encore valide", async () => {
    const result = await expireBookingAuthorization(canceledIntent({ status: "requires_capture" }), { now: NOW });
    expect(result.outcome).toBe("NOT_CANCELED");
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
  });

  it("ignore les PaymentIntents de supplément ou de solde", async () => {
    for (const type of ["additional_charge", "booking_balance"]) {
      const result = await expireBookingAuthorization(canceledIntent({ metadata: { type, bookingId: "booking_1" } }), { now: NOW });
      expect(result.outcome).toBe("IGNORED");
    }
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
  });

  it("n'altère pas une annulation client ou équipe en cours (CANCELLING) ni une réservation confirmée", async () => {
    for (const status of ["CANCELLING", "CANCELLED", "CONFIRMED"]) {
      prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment(), booking: makeBooking({ status }) });
      const result = await expireBookingAuthorization(canceledIntent({ cancellation_reason: "abandoned" }), { now: NOW });
      expect(result.outcome).toBe("IGNORED");
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(emailMock.sendBookingAuthorizationExpiredEmail).not.toHaveBeenCalled();
  });

  it("rejeu : la demande déjà EXPIRED n'est pas modifiée, les e-mails sont retentés avec les mêmes clés", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      ...makePayment({ status: "EXPIRED" }),
      booking: makeBooking({ status: "EXPIRED" }),
    });

    const result = await expireBookingAuthorization(canceledIntent(), { now: NOW });

    expect(result.outcome).toBe("ALREADY_EXPIRED");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(emailMock.sendBookingAuthorizationExpiredEmail).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      { idempotencyKey: "booking-authorization-expired-booking_1" }
    );
  });

  it("vieille demande zombie : close sans e-mail client, l'équipe est prévenue", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment(), booking: makeBooking() });

    const result = await expireBookingAuthorization(
      canceledIntent({ canceled_at: seconds(new Date("2026-09-01T00:00:00.000Z")) }),
      { now: NOW }
    );

    expect(result.outcome).toBe("EXPIRED");
    expect(result.clientNotified).toBe(false);
    expect(emailMock.sendBookingAuthorizationExpiredEmail).not.toHaveBeenCalled();
    expect(emailMock.sendBookingAuthorizationAlertAdminEmail).toHaveBeenCalledWith(
      "EXPIRED", expect.objectContaining({ clientNotified: false }), expect.anything()
    );
  });

  it("e-mail en échec : l'état reste EXPIRED et l'erreur est remontée pour un rejeu", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment(), booking: makeBooking() });
    emailMock.sendBookingAuthorizationExpiredEmail.mockRejectedValue(new Error("Resend indisponible"));

    const result = await expireBookingAuthorization(canceledIntent(), { now: NOW });

    expect(result.outcome).toBe("EXPIRED");
    expect(result.notifyErrors).toEqual(["client: Resend indisponible"]);
    expect(() => assertExpiryNotified(result)).toThrow(/Resend indisponible/);
  });
});

describe("règles pures", () => {
  it("reconnaît les PaymentIntents de demande", () => {
    expect(isBookingAuthorizationIntent({ metadata: { bookingIds: "b1" } })).toBe(true);
    expect(isBookingAuthorizationIntent({ metadata: { bookingId: "b1" } })).toBe(true);
    expect(isBookingAuthorizationIntent({ metadata: {} })).toBe(false);
    expect(isBookingAuthorizationIntent({ metadata: { type: "booking_balance", bookingId: "b1" } })).toBe(false);
  });

  it("ne prévient le client que pour une expiration récente et une garde à venir", () => {
    const startDate = new Date("2027-04-26T00:00:00.000Z");
    expect(shouldNotifyClientOfExpiry({ canceledAt: NOW, startDate, now: NOW })).toBe(true);
    expect(shouldNotifyClientOfExpiry({ canceledAt: null, startDate, now: NOW })).toBe(true);
    expect(shouldNotifyClientOfExpiry({ canceledAt: new Date("2026-11-20T00:00:00.000Z"), startDate, now: NOW })).toBe(false);
    expect(shouldNotifyClientOfExpiry({ canceledAt: NOW, startDate: new Date("2026-12-01T00:00:00.000Z"), now: NOW })).toBe(false);
  });

  it("lit capture_before sur la dernière charge", () => {
    const captureBefore = new Date("2026-12-03T10:00:00.000Z");
    expect(getAuthorizationCaptureBefore({
      latest_charge: { payment_method_details: { card: { capture_before: seconds(captureBefore) } } },
    } as unknown as Stripe.PaymentIntent)).toEqual(captureBefore);
    expect(getAuthorizationCaptureBefore({ latest_charge: "ch_1" } as unknown as Stripe.PaymentIntent)).toBeNull();
  });
});

describe("scanBookingAuthorizations (cron quotidien)", () => {
  it("drapeau désactivé : aucune lecture", async () => {
    flags.enabled = false;
    expect(await scanBookingAuthorizations({ now: NOW })).toBeNull();
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
    expect(stripeMock.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it("expire les autorisations annulées et alerte l'équipe avant une expiration proche", async () => {
    const expiredBooking = { ...makeBooking({ id: "booking_expired" }), payment: makePayment({ stripePaymentId: "pi_expired" }) };
    const expiringBooking = { ...makeBooking({ id: "booking_expiring" }), payment: makePayment({ stripePaymentId: "pi_expiring" }) };
    const healthyBooking = { ...makeBooking({ id: "booking_ok" }), payment: makePayment({ stripePaymentId: "pi_ok" }) };
    prismaMock.booking.findMany.mockResolvedValue([expiredBooking, expiringBooking, healthyBooking]);
    stripeMock.paymentIntents.retrieve.mockImplementation(async (id: string) => {
      if (id === "pi_expired") return canceledIntent({ id: "pi_expired", metadata: { bookingIds: "booking_expired" } });
      const hours = id === "pi_expiring" ? 20 : 72;
      return {
        id,
        status: "requires_capture",
        metadata: { bookingIds: id },
        latest_charge: { payment_method_details: { card: { capture_before: seconds(new Date(NOW.getTime() + hours * 3_600_000)) } } },
      };
    });
    prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment({ stripePaymentId: "pi_expired" }), booking: makeBooking({ id: "booking_expired" }) });

    const result = await scanBookingAuthorizations({ now: NOW });

    expect(result).toEqual({ checked: 3, expired: 1, alerted: 1, errors: [] });
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: "PENDING",
        createdAt: { lte: new Date("2026-12-01T04:00:00.000Z") },
        payment: { is: { status: "PROCESSING", stripePaymentId: { not: null } } },
      },
      take: 20,
    }));
    expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith("pi_expiring", { expand: ["latest_charge"] });
    expect(emailMock.sendBookingAuthorizationAlertAdminEmail).toHaveBeenCalledWith(
      "EXPIRING",
      expect.objectContaining({ bookingId: "booking_expiring" }),
      { idempotencyKey: "booking-authorization-expiring-booking_expiring" }
    );
  });

  it("une erreur Stripe sur une demande n'empêche pas de traiter les suivantes", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      { ...makeBooking({ id: "booking_a" }), payment: makePayment({ stripePaymentId: "pi_a" }) },
      { ...makeBooking({ id: "booking_b" }), payment: makePayment({ stripePaymentId: "pi_b" }) },
    ]);
    stripeMock.paymentIntents.retrieve
      .mockRejectedValueOnce(new Error("Stripe indisponible"))
      .mockResolvedValueOnce(canceledIntent({ id: "pi_b", metadata: { bookingIds: "booking_b" } }));
    prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment({ stripePaymentId: "pi_b" }), booking: makeBooking({ id: "booking_b" }) });

    const result = await scanBookingAuthorizations({ now: NOW });

    expect(result?.expired).toBe(1);
    expect(result?.errors).toEqual(["booking_a: Stripe indisponible"]);
  });
});

describe("webhook charge.expired", () => {
  const expiredCharge = { id: "ch_1", payment_intent: "pi_auth" } as unknown as Stripe.Charge;

  it("relit le PaymentIntent de la charge", async () => {
    stripeMock.paymentIntents.retrieve.mockResolvedValue(canceledIntent());
    prismaMock.payment.findFirst.mockResolvedValue({ ...makePayment(), booking: makeBooking() });
    const result = await expireAuthorizationFromCharge(expiredCharge);
    expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith("pi_auth");
    expect(result.outcome).toBe("EXPIRED");
  });

  it("drapeau désactivé : aucun appel Stripe", async () => {
    flags.enabled = false;
    const result = await expireAuthorizationFromCharge(expiredCharge);
    expect(result.outcome).toBe("DISABLED");
    expect(stripeMock.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
});

describe("cron cleanup-bookings", () => {
  const runCron = () =>
    cleanupBookings(new NextRequest("http://localhost/api/cron/cleanup-bookings", {
      headers: { authorization: "Bearer cron_test_secret" },
    }));

  beforeEach(() => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ ...txMock, booking: { ...txMock.booking, findMany: vi.fn().mockResolvedValue([]) } })
    );
  });

  it("drapeau désactivé : réponse identique à main (pas de champ authorizationExpiry)", async () => {
    flags.enabled = false;
    const body = await (await runCron()).json();
    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty("authorizationExpiry");
  });

  it("drapeau activé : rapporte le traitement des autorisations", async () => {
    const body = await (await runCron()).json();
    expect(body.authorizationExpiry).toEqual({ checked: 0, expired: 0, alerted: 0, errors: [] });
  });
});
