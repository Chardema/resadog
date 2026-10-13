import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getLoyaltyAccount, isLoyaltyValidatedStatus } from "@/lib/loyalty-ledger";

// Lister tous les clients
export async function GET() {
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
        subscription: true,
        pets: {
          select: {
            id: true,
            name: true,
            species: true,
            birthDate: true,
            birthDateProofUrl: true,
            birthDateVerifiedAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        bookings: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
            startDate: true,
            createdAt: true,
            payment: {
              select: {
                amount: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    // Calculer des stats pour chaque client
    const clientsWithStats = await Promise.all(clients.map(async (client) => {
      const completedBookings = client.bookings.filter(b => b.status === "COMPLETED");
      const validatedBookings = client.bookings.filter((booking) => isLoyaltyValidatedStatus(booking.status));
      const loyaltyAccount = await getLoyaltyAccount(client.id);
      const lastBooking = client.bookings[0] || null;

      return {
        ...client,
        stats: {
          totalBookings: client._count.bookings,
          completedBookings: completedBookings.length,
          validatedBookings: validatedBookings.length,
          totalSpent: loyaltyAccount.totalQualifiedAmount,
          loyaltyPaws: loyaltyAccount.paws,
          loyalty: loyaltyAccount.status,
          lastBooking: lastBooking
            ? {
                id: lastBooking.id,
                status: lastBooking.status,
                paymentStatus: lastBooking.payment?.status || null,
                totalPrice: lastBooking.totalPrice,
                startDate: lastBooking.startDate,
              }
            : null,
        },
      };
    }));

    return NextResponse.json({ clients: clientsWithStats });
  } catch (error) {
    console.error("Erreur lors du chargement des clients:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
