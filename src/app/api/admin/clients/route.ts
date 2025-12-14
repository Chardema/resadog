import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

// Lister tous les clients
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const clients = await prisma.user.findMany({
      where: {
        role: "CLIENT",
      },
      orderBy: { createdAt: "desc" },
      include: {
        autoApplyCoupon: true,
        bookings: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    // Calculer des stats pour chaque client
    const clientsWithStats = clients.map((client) => {
      const completedBookings = client.bookings.filter(b => b.status === "COMPLETED");
      const totalSpent = completedBookings.reduce((sum, b) => sum + b.totalPrice, 0);

      return {
        ...client,
        stats: {
          totalBookings: client._count.bookings,
          completedBookings: completedBookings.length,
          totalSpent,
        },
      };
    });

    return NextResponse.json({ clients: clientsWithStats });
  } catch (error) {
    console.error("Erreur lors du chargement des clients:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
