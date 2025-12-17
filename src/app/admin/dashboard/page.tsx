import { requireAuth } from "@/lib/auth/protected-page";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { UserMenu } from "@/components/layout/UserMenu";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const session = await requireAuth();

  // Vérifier que l'utilisateur est admin ou gardien
  if (session.user.role !== "ADMIN" && session.user.role !== "SITTER") {
    redirect("/dashboard");
  }

  // Récupérer les statistiques
  const [totalBookings, pendingBookings, totalClients, totalRevenue] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCEEDED" },
    }),
  ]);

  // Récupérer les prochaines réservations
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      startDate: {
        gte: new Date(),
      },
    },
    include: {
      client: true,
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
    totalClients,
    totalRevenue: totalRevenue._sum.amount || 0,
  };

  return (
    <AdminDashboardClient
      stats={stats}
      upcomingBookings={upcomingBookings}
    />
  );
}
