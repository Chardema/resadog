import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

// Helper pour parser une date ISO string en UTC (format YYYY-MM-DD)
function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

// Schéma de validation pour la création de réservation
const createBookingSchema = z.object({
  petIds: z.array(z.string()).min(1, "Au moins un animal est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  startTime: z.string().optional(), // Heure de dépôt (HH:mm)
  endTime: z.string().optional(),   // Heure de récupération (HH:mm)
  serviceType: z.enum(["BOARDING", "DAY_CARE", "DROP_IN", "DOG_WALKING"]),
  totalPrice: z.number().positive("Le prix doit être positif"),
  depositAmount: z.number().positive("Le montant doit être positif"),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(["PAYPAL", "WERO", "BANK_TRANSFER"]).optional(),
  useCredits: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // ... (auth check) ...

    // ... (body parsing) ...
    const {
      petIds,
      startDate,
      endDate,
      startTime,
      endTime,
      serviceType,
      totalPrice,
      depositAmount,
      notes,
      promoCode,
      paymentMethod,
      useCredits,
    } = validatedData;

    // ... (date checks) ...

    let creditsToDeduct = 0;
    if (useCredits) {
        // Calculate credits needed (simplified: 1 day = 1 credit per pet)
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
        creditsToDeduct = duration * petIds.length;

        // Check balance
        const batches = await prisma.creditBatch.findMany({
            where: { userId: session.user.id, remaining: { gt: 0 } },
            orderBy: { expiresAt: 'asc' }
        });
        const totalAvailable = batches.reduce((acc, b) => acc + b.remaining, 0);
        
        if (totalAvailable < creditsToDeduct) {
            return NextResponse.json({ error: "Crédits insuffisants" }, { status: 400 });
        }

        // Deduct credits (Simplified: just update first batch found for now, ideally transaction)
        // In a real app, distribute deduction across batches.
        // For MVP: We assume we just debit (we need a transaction logic here but let's just mark the booking)
        // We will just mark the booking as paid with credits for now.
    }

    // ... (availability check) ...

    // Créer une nouvelle réservation
    const booking = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        startTime: startTime || null,
        endTime: endTime || null,
        status: "PENDING",
        serviceType,
        totalPrice: useCredits ? 0 : totalPrice,
        depositPaid: useCredits ? true : false,
        depositAmount: useCredits ? 0 : depositAmount,
        creditsUsed: useCredits ? creditsToDeduct : 0,
        specialRequests: notes || null,
        notes: paymentMethod ? `Mode de paiement: ${paymentMethod}` : null,
        clientId: session.user.id,
        // Liaison Many-to-Many
        pets: {
          connect: petIds.map((id) => ({ id })),
        },
        // Backward compatibility (optional, points to first pet)
        petId: petIds[0],
      },
      include: {
        pets: { select: { name: true, breed: true } },
        client: { select: { name: true, email: true } },
      },
    });
    
    // If used credits, actually deduct from batches (Post-creation to keep it simple or use transaction)
    if (useCredits && creditsToDeduct > 0) {
        const batches = await prisma.creditBatch.findMany({
            where: { userId: session.user.id, remaining: { gt: 0 } },
            orderBy: { expiresAt: 'asc' }
        });
        
        let remainingToDeduct = creditsToDeduct;
        for (const batch of batches) {
            if (remainingToDeduct <= 0) break;
            const deduction = Math.min(batch.remaining, remainingToDeduct);
            await prisma.creditBatch.update({
                where: { id: batch.id },
                data: { remaining: batch.remaining - deduction }
            });
            remainingToDeduct -= deduction;
        }
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        serviceType: booking.serviceType,
        status: booking.status,
        totalPrice: booking.totalPrice,
        depositAmount: booking.depositAmount,
        pets: booking.pets,
        client: booking.client,
      },
      message: "Réservation créée avec succès! En attente de confirmation du gardien.",
    });
  } catch (error) {
    console.error("Erreur lors de la création de la réservation:", error);

    // Gérer les erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de la création de la réservation",
      },
      { status: 500 }
    );
  }
}

// GET: Récupérer les réservations de l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    // Récupérer toutes les réservations de l'utilisateur
    const bookings = await prisma.booking.findMany({
      where: {
        clientId: session.user.id,
      },
      include: {
        pets: {
          select: {
            name: true,
            breed: true,
          },
        },
        // Fallback for old bookings
        pet: {
          select: {
            name: true,
            breed: true,
          }
        }
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        serviceType: b.serviceType,
        status: b.status,
        totalPrice: b.totalPrice,
        depositAmount: b.depositAmount,
        depositPaid: b.depositPaid,
        // Combine old and new pets logic
        pets: b.pets.length > 0 ? b.pets : (b.pet ? [b.pet] : []),
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}