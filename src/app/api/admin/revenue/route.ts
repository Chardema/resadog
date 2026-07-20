import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getNetPaymentAmount } from "@/lib/payment-amounts";

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

type SummaryRow = {
  revenue: number;
  monthRevenue: number;
  pendingAmount: number;
  succeededCount: bigint;
};

type MonthlyRow = { key: string; amount: number };

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const rollingStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [payments, additionalCharges, paymentSummaryRows, chargeSummaryRows, monthlyRows] =
      await Promise.all([
        // Les listes restent volontairement bornées pour l'interface.
        prisma.payment.findMany({
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            booking: {
              select: {
                id: true,
                serviceType: true,
                startDate: true,
                endDate: true,
                client: { select: { name: true, email: true } },
                pets: { select: { name: true } },
              },
            },
          },
        }),
        prisma.additionalCharge.findMany({
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            booking: {
              select: {
                id: true,
                client: { select: { name: true, email: true } },
                pets: { select: { name: true } },
              },
            },
          },
        }),
        // Les agrégats, eux, portent sur tout l'historique et non sur les 80 lignes affichées.
        prisma.$queryRaw<SummaryRow[]>`
          SELECT
            COALESCE(SUM(
              CASE
                WHEN "status" = 'SUCCEEDED' THEN "capturedAmount"
                WHEN "status" = 'PARTIALLY_REFUNDED' THEN GREATEST(0, "capturedAmount" - COALESCE("refundAmount", 0))
                ELSE 0
              END
            ), 0)::double precision AS "revenue",
            COALESCE(SUM(
              CASE
                WHEN COALESCE("paidAt", "createdAt") >= ${monthStart} THEN
                  CASE
                    WHEN "status" = 'SUCCEEDED' THEN "capturedAmount"
                    WHEN "status" = 'PARTIALLY_REFUNDED' THEN GREATEST(0, "capturedAmount" - COALESCE("refundAmount", 0))
                    ELSE 0
                  END
                ELSE 0
              END
            ), 0)::double precision AS "monthRevenue",
            COALESCE(SUM(
              CASE WHEN "status" IN ('PENDING', 'PROCESSING') THEN "amount" ELSE 0 END
            ), 0)::double precision AS "pendingAmount",
            COUNT(*) FILTER (
              WHERE ("status" = 'SUCCEEDED' AND "capturedAmount" > 0)
                 OR ("status" = 'PARTIALLY_REFUNDED' AND "capturedAmount" - COALESCE("refundAmount", 0) > 0)
            ) AS "succeededCount"
          FROM "Payment"
        `,
        prisma.$queryRaw<SummaryRow[]>`
          SELECT
            COALESCE(SUM(CASE WHEN "status" = 'SUCCEEDED' THEN "amount" ELSE 0 END), 0)::double precision AS "revenue",
            COALESCE(SUM(
              CASE WHEN "status" = 'SUCCEEDED' AND COALESCE("chargedAt", "createdAt") >= ${monthStart}
                THEN "amount" ELSE 0 END
            ), 0)::double precision AS "monthRevenue",
            COALESCE(SUM(
              CASE WHEN "status" IN ('PENDING', 'PROCESSING') THEN "amount" ELSE 0 END
            ), 0)::double precision AS "pendingAmount",
            COUNT(*) FILTER (WHERE "status" = 'SUCCEEDED') AS "succeededCount"
          FROM "AdditionalCharge"
        `,
        prisma.$queryRaw<MonthlyRow[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "occurredAt"), 'YYYY-MM') AS "key",
            SUM("netAmount")::double precision AS "amount"
          FROM (
            SELECT
              COALESCE("paidAt", "createdAt") AS "occurredAt",
              CASE
                WHEN "status" = 'SUCCEEDED' THEN "capturedAmount"
                WHEN "status" = 'PARTIALLY_REFUNDED' THEN GREATEST(0, "capturedAmount" - COALESCE("refundAmount", 0))
                ELSE 0
              END AS "netAmount"
            FROM "Payment"
            UNION ALL
            SELECT
              COALESCE("chargedAt", "createdAt") AS "occurredAt",
              CASE WHEN "status" = 'SUCCEEDED' THEN "amount" ELSE 0 END AS "netAmount"
            FROM "AdditionalCharge"
          ) AS "revenueByMonth"
          WHERE "occurredAt" >= ${rollingStart} AND "netAmount" > 0
          GROUP BY DATE_TRUNC('month', "occurredAt")
          ORDER BY DATE_TRUNC('month', "occurredAt")
        `,
      ]);

    const paymentSummary = paymentSummaryRows[0];
    const chargeSummary = chargeSummaryRows[0];
    const totalRevenue = paymentSummary.revenue + chargeSummary.revenue;
    const monthRevenue = paymentSummary.monthRevenue + chargeSummary.monthRevenue;
    const pendingAmount = paymentSummary.pendingAmount + chargeSummary.pendingAmount;
    const succeededCount = Number(paymentSummary.succeededCount + chargeSummary.succeededCount);
    const monthlyAmounts = new Map(monthlyRows.map((row) => [row.key, row.amount]));
    const monthly = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: monthKey(date),
        label: monthLabel(date),
        amount: Math.round((monthlyAmounts.get(monthKey(date)) || 0) * 100) / 100,
      };
    });

    const paymentRows = payments.slice(0, 30).map((payment) => ({
      id: payment.id,
      kind: "BOOKING" as const,
      amount: payment.amount,
      netAmount: getNetPaymentAmount(payment),
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() || null,
      refundAmount: payment.refundAmount || 0,
      serviceType: payment.booking.serviceType,
      bookingId: payment.booking.id,
      clientName: payment.booking.client.name,
      clientEmail: payment.booking.client.email,
      pets: payment.booking.pets.map((pet) => pet.name),
    }));

    const chargeRows = additionalCharges.slice(0, 30).map((charge) => ({
      id: charge.id,
      kind: "CHARGE" as const,
      amount: charge.amount,
      netAmount: charge.status === "SUCCEEDED" ? charge.amount : 0,
      status: charge.status,
      createdAt: charge.createdAt.toISOString(),
      paidAt: charge.chargedAt?.toISOString() || null,
      refundAmount: 0,
      serviceType: "Supplément",
      bookingId: charge.booking.id,
      clientName: charge.booking.client.name,
      clientEmail: charge.booking.client.email,
      pets: charge.booking.pets.map((pet) => pet.name),
      reason: charge.reason,
    }));

    const transactions = [...paymentRows, ...chargeRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 25);

    return NextResponse.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        averagePayment: succeededCount > 0
          ? Math.round((totalRevenue / succeededCount) * 100) / 100
          : 0,
        succeededCount,
        pendingAmount: Math.round(pendingAmount * 100) / 100,
      },
      monthly,
      transactions,
    });
  } catch (error) {
    console.error("Erreur lors du chargement des revenus admin:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
