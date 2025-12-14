import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Vérifier si l'utilisateur est admin ou sitter
    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") || "all";
    
    let whereClause: any = {};

    // IMPORTANT: On ne montre que les réservations payées via Stripe (status SUCCEEDED)
    // On retire la vérification depositPaid pour éviter les faux positifs des tests
    
    whereClause = {
      payment: {
        status: "SUCCEEDED"
      }
    };

    if (filter === "pending") {
      whereClause.status = "PENDING";
    } else if (filter === "confirmed") {
      whereClause.status = "CONFIRMED";
    } else if (filter === "completed") {
      whereClause.status = "COMPLETED";
    } else if (filter === "cancelled") {
      whereClause.status = "CANCELLED";
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
            imageUrl: true,
          },
        },
        client: {
          select: {
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        payment: {
          select: {
            amount: true,
            status: true,
            stripePaymentId: true,
          },
        },
      },
      orderBy: {
        startDate: "asc", // Les plus proches en premier
      },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations admin:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
