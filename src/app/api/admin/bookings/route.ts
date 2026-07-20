import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { extractServiceDetails, stripServiceDetails } from "@/lib/booking-details";
import { calculateBookingPrice, type PriceRateGroup, type Species } from "@/lib/pricing";
import type { Prisma } from "@prisma/client";

type PricingPet = {
  id: string;
  name: string;
  species: Species;
  age: number | null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function parsePremiumDiscount(notes?: string | null) {
  const value = notes?.match(/Avantage Premium:\s*-([\d.,]+)\s*€/i)?.[1];
  if (!value) return 0;
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function parsePromoCode(notes?: string | null) {
  return notes?.match(/Code promo:\s*([^\n]+)/i)?.[1]?.trim() || null;
}

function buildPriceBreakdown(input: {
  serviceType: string;
  startDate: Date;
  endDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  totalPrice: number;
  notes?: string | null;
  pets: PricingPet[];
  visitSlots?: { date: string; startTime: string; duration: number }[];
}) {
  if (input.pets.length === 0) return null;

  const priceResult = calculateBookingPrice({
    serviceType: input.serviceType,
    pets: input.pets,
    startDate: input.startDate.toISOString().slice(0, 10),
    endDate: input.endDate.toISOString().slice(0, 10),
    startTime: input.startTime || undefined,
    endTime: input.endTime || undefined,
    visitSlots: input.visitSlots,
  });

  if (priceResult.total <= 0) return null;

  const adjustments: { label: string; amount: number }[] = [];
  const totalAdjustment = roundMoney(input.totalPrice - priceResult.total);

  if (totalAdjustment < 0) {
    let remainingDiscount = roundMoney(-totalAdjustment);
    const premiumDiscount = Math.min(remainingDiscount, parsePremiumDiscount(input.notes));
    const promoCode = parsePromoCode(input.notes);
    const couponDiscount = promoCode
      ? roundMoney(Math.max(0, remainingDiscount - premiumDiscount))
      : 0;

    if (couponDiscount > 0) {
      adjustments.push({ label: `Réduction ${promoCode}`, amount: -couponDiscount });
      remainingDiscount = roundMoney(remainingDiscount - couponDiscount);
    }
    if (premiumDiscount > 0) {
      adjustments.push({ label: "Avantage Premium", amount: -premiumDiscount });
      remainingDiscount = roundMoney(remainingDiscount - premiumDiscount);
    }
    if (remainingDiscount > 0) {
      adjustments.push({ label: "Réduction appliquée", amount: -remainingDiscount });
    }
  } else if (totalAdjustment > 0) {
    adjustments.push({ label: "Ajustement du tarif réservé", amount: totalAdjustment });
  }

  const petNames = new Map(input.pets.map((pet) => [pet.id, pet.name]));
  return {
    subtotal: priceResult.total,
    total: input.totalPrice,
    pets: priceResult.pets.map((pet) => ({
      petId: pet.petId,
      petName: petNames.get(pet.petId) || "Animal",
      subtotal: pet.total,
      lines: pet.rateGroups.map((group: PriceRateGroup) => ({
        label: group.label,
        unitPrice: group.unitPrice,
        quantity: group.quantity,
        total: group.total,
        type: group.type,
      })),
    })),
    sharedLines: priceResult.durationExtra > 0
      ? [{
          label: "Supplément durée prolongée",
          unitPrice: priceResult.durationExtra,
          quantity: 1,
          total: priceResult.durationExtra,
          type: "surcharge" as const,
        }]
      : [],
    adjustments,
  };
}

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
    
    let whereClause: Prisma.BookingWhereInput = {};

    const actionablePending: Prisma.BookingWhereInput = {
      OR: [
        {
          status: "PENDING",
          payment: { is: { stripePaymentId: { not: null } } },
        },
        { status: { in: ["ACCEPTING", "CANCELLING"] } },
      ],
    };

    // Une demande n'arrive dans l'admin qu'après la finalisation de Checkout et
    // la création de l'autorisation Stripe. Les autres sont des brouillons.
    whereClause = {
      OR: [
        { status: { not: "PENDING" } },
        actionablePending,
      ],
    };

    if (filter === "pending") {
      whereClause = actionablePending;
    } else if (filter === "confirmed") {
      whereClause = { status: "CONFIRMED" };
    } else if (filter === "completed") {
      whereClause = { status: "COMPLETED" };
    } else if (filter === "cancelled") {
      whereClause = { status: "CANCELLED" };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        pet: {
          select: { id: true, name: true, breed: true, imageUrl: true, species: true, age: true },
        },
        pets: {
          select: { id: true, name: true, breed: true, imageUrl: true, species: true, age: true },
        },
        client: {
          select: {
            name: true,
            email: true,
            phone: true,
            image: true,
            subscription: { select: { status: true } },
          },
        },
        payment: {
          select: {
            amount: true,
            status: true,
            stripePaymentId: true,
          },
        },
        reviewRequest: {
          select: {
            sentAt: true,
            submittedAt: true,
            serviceRating: true,
            serviceComment: true,
            websiteRating: true,
            websiteComment: true,
          },
        },
      },
      orderBy: {
        startDate: "asc", // Les plus proches en premier
      },
    });

    const sortedBookings = [...bookings].sort((a, b) => {
      const premiumDelta =
        Number(b.client.subscription?.status === "ACTIVE") -
        Number(a.client.subscription?.status === "ACTIVE");
      if (premiumDelta !== 0) return premiumDelta;
      return a.startDate.getTime() - b.startDate.getTime();
    });

    return NextResponse.json({
      bookings: sortedBookings.map((booking) => {
        const serviceDetails = extractServiceDetails(booking.specialRequests);
        const pricingPets = (booking.pets.length > 0
          ? booking.pets
          : booking.pet
            ? [booking.pet]
            : []) as PricingPet[];

        return {
          ...booking,
          pet: booking.pet ? {
            name: booking.pet.name,
            breed: booking.pet.breed,
            imageUrl: booking.pet.imageUrl,
          } : null,
          pets: booking.pets.map((pet) => ({
            name: pet.name,
            breed: pet.breed,
            imageUrl: pet.imageUrl,
          })),
          serviceDetails,
          priceBreakdown: buildPriceBreakdown({
            serviceType: booking.serviceType,
            startDate: booking.startDate,
            endDate: booking.endDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            totalPrice: booking.totalPrice,
            notes: booking.notes,
            pets: pricingPets,
            visitSlots: serviceDetails?.visitSlots,
          }),
          specialRequests: stripServiceDetails(booking.specialRequests),
        };
      }),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations admin:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
