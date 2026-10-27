import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  buildFinanceReport, cents, DEFAULT_FINANCE_SETTINGS, financeSettingsSchema,
  type FinanceSource, type StripeFinanceSnapshot,
} from "@/lib/finance";

export async function getFinanceSettings() {
  const saved = await prisma.financeSettings.findUnique({ where: { id: "default" } });
  const parsed = financeSettingsSchema.safeParse(saved?.settings);
  return parsed.success ? parsed.data : { ...DEFAULT_FINANCE_SETTINGS };
}

async function readStripeSnapshot(client: Stripe, paymentIntentId: string): Promise<StripeFinanceSnapshot> {
  const payment = await client.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
  const charge = typeof payment.latest_charge === "object" ? payment.latest_charge : null;
  const balance = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  const refunds: StripeFinanceSnapshot["refunds"] = [];
  if (charge?.amount_refunded) {
    for await (const refund of client.refunds.list({ payment_intent: paymentIntentId, limit: 100, expand: ["data.balance_transaction"] })) {
      if (refund.status !== "succeeded") continue;
      const refundBalance = typeof refund.balance_transaction === "object" ? refund.balance_transaction : null;
      refunds.push({ id: refund.id, bookingId: refund.metadata?.bookingId, amountCents: refund.amount, occurredAt: new Date(refund.created * 1000).toISOString(), feeCents: refundBalance?.fee ?? null });
    }
  }
  return {
    status: payment.status, currency: payment.currency, grossCents: payment.amount_received,
    paidAt: balance ? new Date(balance.created * 1000).toISOString() : null,
    feeCents: balance?.currency === "eur" ? balance.fee : null,
    disputed: charge?.disputed ?? false, refunds,
  };
}

export async function loadFinanceReport(force = false) {
  const bookingSelect = {
    id: true, status: true, serviceType: true, startDate: true, endDate: true,
    client: { select: { name: true, email: true } },
    pets: { select: { name: true } }, pet: { select: { name: true } },
  } as const;
  // Tout l'historique alimente les totaux ; le filtrage mensuel se fait ensuite.
  const [payments, charges, settings] = await Promise.all([
    prisma.payment.findMany({ include: { booking: { select: bookingSelect } } }),
    prisma.additionalCharge.findMany({ include: { booking: { select: bookingSelect } } }),
    getFinanceSettings(),
  ]);
  const sources: FinanceSource[] = [
    ...payments.map((payment) => ({
      id: payment.id, bookingId: payment.bookingId, kind: "BOOKING" as const,
      clientName: payment.booking.client.name || payment.booking.client.email,
      pets: payment.booking.pets.length ? payment.booking.pets.map((pet) => pet.name) : payment.booking.pet ? [payment.booking.pet.name] : [],
      serviceType: payment.booking.serviceType, amountCents: cents(payment.amount), capturedCents: cents(payment.capturedAmount),
      refundCents: ["REFUNDED", "PARTIALLY_REFUNDED"].includes(payment.status) ? cents(payment.refundAmount || 0) : 0,
      paidAt: payment.paidAt?.toISOString() || null, refundedAt: payment.refundedAt?.toISOString() || null,
      createdAt: payment.createdAt.toISOString(), updatedAt: payment.updatedAt.toISOString(),
      paymentMethod: payment.paymentMethod, status: payment.status, bookingStatus: payment.booking.status, paymentIntentId: payment.stripePaymentId,
      startsAt: payment.booking.startDate.toISOString(), endsAt: payment.booking.endDate.toISOString(),
    })),
    ...charges.map((charge) => ({
      id: charge.id, bookingId: charge.bookingId, kind: "CHARGE" as const,
      clientName: charge.booking.client.name || charge.booking.client.email,
      pets: charge.booking.pets.length ? charge.booking.pets.map((pet) => pet.name) : charge.booking.pet ? [charge.booking.pet.name] : [],
      serviceType: `Supplément : ${charge.reason}`, amountCents: cents(charge.amount),
      capturedCents: charge.status === "SUCCEEDED" ? cents(charge.amount) : 0, refundCents: 0,
      paidAt: charge.chargedAt?.toISOString() || null, refundedAt: null,
      createdAt: charge.createdAt.toISOString(), updatedAt: charge.updatedAt.toISOString(),
      status: charge.status, bookingStatus: charge.booking.status, paymentIntentId: charge.stripePaymentId,
      startsAt: charge.booking.startDate.toISOString(), endsAt: charge.booking.endDate.toISOString(),
    })),
  ];
  const groups = new Map<string, FinanceSource[]>();
  for (const source of sources) if (source.paymentIntentId) groups.set(source.paymentIntentId, [...(groups.get(source.paymentIntentId) || []), source]);
  const stored = await prisma.financeStripeSnapshot.findMany({ where: { paymentIntentId: { in: [...groups.keys()] } } });
  const storedById = new Map(stored.map((item) => [item.paymentIntentId, item]));
  const snapshots = new Map<string, StripeFinanceSnapshot>();
  const failures: string[] = [];
  const client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 0 }) : null;
  const tasks = [...groups.entries()];
  for (let offset = 0; offset < tasks.length; offset += 4) {
    await Promise.all(tasks.slice(offset, offset + 4).map(async ([id, group]) => {
      const fingerprint = group.map((source) => `${source.id}:${source.updatedAt}`).sort().join("|");
      const cached = storedById.get(id);
      const maxAge = group.some((source) => ["PROCESSING", "PENDING"].includes(source.status)) ? 60_000 : 15 * 60_000;
      if (!force && cached?.fingerprint === fingerprint && Date.now() - cached.syncedAt.getTime() < maxAge) {
        snapshots.set(id, cached.snapshot as unknown as StripeFinanceSnapshot);
        return;
      }
      try {
        if (!client) throw new Error("Stripe non configuré");
        const snapshot = await readStripeSnapshot(client, id);
        snapshots.set(id, snapshot);
        await prisma.financeStripeSnapshot.upsert({ where: { paymentIntentId: id },
          create: { paymentIntentId: id, fingerprint, snapshot: snapshot as unknown as Prisma.InputJsonValue },
          update: { fingerprint, snapshot: snapshot as unknown as Prisma.InputJsonValue, syncedAt: new Date() },
        });
      } catch {
        failures.push(id);
        if (cached?.fingerprint === fingerprint) snapshots.set(id, cached.snapshot as unknown as StripeFinanceSnapshot);
      }
    }));
  }
  const report = buildFinanceReport(sources, snapshots, settings);
  if (failures.length) report.warnings.push(`Lecture Stripe incomplète pour ${failures.length} paiement(s). Les dernières données connues ou des estimations sont affichées.`);
  return report;
}
