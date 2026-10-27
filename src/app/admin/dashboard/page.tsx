import { requireAuth } from "@/lib/auth/protected-page";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const session = await requireAuth();

  // Vérifier que l'utilisateur est admin ou gardien
  if (session.user.role !== "ADMIN" && session.user.role !== "SITTER") {
    redirect("/dashboard");
  }

  const now = new Date();

  // Récupérer les statistiques
  const [
    totalBookings,
    pendingBookings,
    confirmedBookings,
    inProgressBookings,
    completedBookings,
    totalClients,
    totalRevenue,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: { in: ["PENDING", "ACCEPTING", "CANCELLING"] } } }),
    prisma.booking.count({ where: { status: "CONFIRMED", startDate: { gt: now } } }),
    prisma.booking.count({
      where: {
        OR: [
          { status: "IN_PROGRESS" },
          {
            status: "CONFIRMED",
            startDate: { lte: now },
            endDate: { gte: now },
          },
        ],
      },
    }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.$queryRaw<{ revenue: number }[]>`
      SELECT COALESCE(SUM("netAmount"), 0)::double precision AS "revenue"
      FROM (
        SELECT CASE
          WHEN "status" = 'SUCCEEDED' THEN "capturedAmount"
          WHEN "status" = 'PARTIALLY_REFUNDED' THEN GREATEST(0, "capturedAmount" - COALESCE("refundAmount", 0))
          ELSE 0
        END AS "netAmount"
        FROM "Payment"
        UNION ALL
        SELECT CASE WHEN "status" = 'SUCCEEDED' THEN "amount" ELSE 0 END
        FROM "AdditionalCharge"
      ) AS "dashboardRevenue"
    `,

  ]);

  // Récupérer les prochaines réservations
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      startDate: {
        gte: new Date(),
      },
    },
    include: {
      client: {
        include: {
          subscription: true,
        }
      },
      pet: true,
      pets: true,
    },
    orderBy: {
      startDate: "asc",
    },
    take: 5,
  });

  const stats = {
    totalBookings,
    pendingBookings,
    confirmedBookings,
    inProgressBookings,
    completedBookings,
    totalClients,
    totalRevenue: totalRevenue[0]?.revenue || 0,
  };

  return (
    <AdminDashboardClient
      stats={stats}
      upcomingBookings={upcomingBookings}

    />
  );
}
