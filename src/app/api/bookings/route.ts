import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { buildSpecialRequests, extractServiceDetails, stripServiceDetails } from "@/lib/booking-details";
import { calculateBookingPrice } from "@/lib/pricing";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";

class BookingInputError extends Error {}

// Helper pour parser une date ISO string en UTC (format YYYY-MM-DD)
function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDateKeysInRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    days.push(toDateKey(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return days;
}

const visitSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de passage invalide"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure de passage invalide"),
  duration: z.number().int().min(30).max(60),
});

// Schéma de validation pour la création de réservation
const createBookingSchema = z.object({
  petIds: z.array(z.string()).min(1, "Au moins un animal est requis"),
  pricingPetIds: z.array(z.string()).min(1).optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  startTime: z.string().optional(), // Heure de dépôt (HH:mm)
  endTime: z.string().optional(),   // Heure de récupération (HH:mm)
  serviceType: z.enum(["BOARDING", "DAY_CARE", "DROP_IN", "DOG_WALKING"]),
  // Conservés temporairement pour les anciens clients, mais jamais utilisés côté serveur.
  totalPrice: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(["PAYPAL", "WERO", "BANK_TRANSFER"]).optional(),
  useCredits: z.boolean().optional(),
  serviceDetails: z.object({
    visitSlots: z.array(visitSlotSchema).optional(),
    serviceAddress: z.string().trim().min(8).max(300).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté pour créer une réservation" },
        { status: 401 }
      );
    }

    // Rate limiting : 10 réservations par user par heure
    const { success: rateLimitOk } = rateLimit(`booking:${session.user.id}`, { maxRequests: 10, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Trop de réservations. Réessayez plus tard." },
        { status: 429 }
      );
    }

    // Parser et valider les données
    const body = await request.json();
    
    // Support backward compatibility if frontend sends single petId
    if (body.petId && !body.petIds) {
      body.petIds = [body.petId];
    }

    const validatedData = createBookingSchema.parse(body);

    const {
      petIds,
      pricingPetIds,
      startDate,
      endDate,
      startTime,
      endTime,
      serviceType,
      notes,
      promoCode,
      paymentMethod,
      useCredits,
      serviceDetails,
    } = validatedData;

    const isHourlyService = serviceType === "DROP_IN" || serviceType === "DOG_WALKING";
    const visitSlots = serviceDetails?.visitSlots || [];
    const pricingContextIds = pricingPetIds || petIds;

    // Convertir les dates en UTC pour éviter les problèmes de fuseau horaire
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);

    // Vérifier que la période est cohérente.
    // La garderie peut être réservée sur une seule journée, contrairement à l'hébergement.
    if (serviceType === "BOARDING" ? end <= start : end < start) {
      return NextResponse.json(
        { error: serviceType === "BOARDING" ? "La date de fin doit être après la date de début" : "La date de fin ne peut pas être avant la date de début" },
        { status: 400 }
      );
    }

    if (isHourlyService && visitSlots.length === 0) {
      return NextResponse.json(
        { error: "Ajoutez au moins un passage avec une date, une heure et une durée" },
        { status: 400 }
      );
    }

    if (isHourlyService && !serviceDetails?.serviceAddress) {
      return NextResponse.json(
        { error: "Indiquez l'adresse complète où la prestation doit avoir lieu" },
        { status: 400 }
      );
    }

    const selectedDateKeys = isHourlyService
      ? [...new Set(visitSlots.map((slot) => slot.date))].sort()
      : getDateKeysInRange(start, end);

    const todayInParis = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (selectedDateKeys.some((dateKey) => dateKey < todayInParis)) {
      return NextResponse.json({ error: "Une réservation ne peut pas commencer dans le passé" }, { status: 400 });
    }

    if (isHourlyService && selectedDateKeys.some((dateKey) => {
      const slotDate = parseUTCDate(dateKey);
      return slotDate < start || slotDate > end;
    })) {
      return NextResponse.json(
        { error: "Certains passages sont en dehors de la période demandée" },
        { status: 400 }
      );
    }

    // Vérifier que TOUS les animaux appartiennent bien à l'utilisateur
    const contextPetsFromDb = await prisma.pet.findMany({
      where: {
        id: { in: pricingContextIds },
        ownerId: session.user.id,
      },
    });

    if (contextPetsFromDb.length !== pricingContextIds.length || petIds.some((id) => !pricingContextIds.includes(id))) {
      return NextResponse.json(
        { error: "Certains animaux n'existent pas ou ne vous appartiennent pas" },
        { status: 404 }
      );
    }

    const pricingContextPets = pricingContextIds
      .map((id) => contextPetsFromDb.find((pet) => pet.id === id))
      .filter((pet) => pet !== undefined);
    const pets = petIds
      .map((id) => pricingContextPets.find((pet) => pet.id === id))
      .filter((pet) => pet !== undefined);

    const priceResult = calculateBookingPrice({
      serviceType,
      pets,
      pricingContextPets,
      startDate,
      endDate,
      startTime,
      endTime,
      visitSlots,
    });

    if (priceResult.total <= 0) {
      return NextResponse.json({ error: "Le tarif de cette réservation est invalide" }, { status: 400 });
    }

    let finalTotal = priceResult.total;
    if (promoCode && !useCredits) {
      if (pricingContextIds.length !== petIds.length) {
        return NextResponse.json(
          { error: "Les codes promo nécessitent des dates communes à tous les animaux" },
          { status: 400 }
        );
      }

      const coupon = await prisma.coupon.findUnique({
        where: { code: promoCode.toUpperCase() },
      });
      const now = new Date();

      if (!coupon || !coupon.isActive) throw new BookingInputError("Code promo invalide ou inactif");
      if (coupon.validFrom && now < coupon.validFrom) throw new BookingInputError("Ce code promo n'est pas encore valide");
      if (coupon.validUntil && now > coupon.validUntil) throw new BookingInputError("Ce code promo a expiré");
      if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) throw new BookingInputError("Ce code promo a atteint sa limite d'utilisation");
      if (coupon.minAmount && priceResult.total < coupon.minAmount) throw new BookingInputError(`Montant minimum de ${coupon.minAmount}€ requis`);
      if (coupon.restrictedTo.length > 0 && !coupon.restrictedTo.includes(session.user.email || "")) throw new BookingInputError("Ce code promo n'est pas valide pour votre compte");
      if (coupon.applicableServices.length > 0 && !coupon.applicableServices.includes(serviceType)) throw new BookingInputError("Ce code promo n'est pas valide pour ce service");

      finalTotal = calculateCouponDiscount({
        totalAmount: priceResult.total,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        quantity: priceResult.quantity,
      }).finalAmount;
    }

    // Gestion des CRÉDITS
    let creditsToDeduct = 0;
    if (useCredits) {
        if (serviceType !== "DOG_WALKING" && serviceType !== "DAY_CARE") {
          return NextResponse.json(
            { error: "Les crédits sont utilisables uniquement pour le service souscrit" },
            { status: 400 }
          );
        }
        creditsToDeduct = priceResult.quantity * petIds.length;

        // Check balance
        const batches = await prisma.creditBatch.findMany({
            where: { userId: session.user.id, serviceType, remaining: { gt: 0 } },
            orderBy: { expiresAt: 'asc' }
        });
        const totalAvailable = batches.reduce((acc, b) => acc + b.remaining, 0);
        
        if (totalAvailable < creditsToDeduct) {
            return NextResponse.json({ error: "Crédits insuffisants" }, { status: 400 });
        }
    }

    // Récupérer toutes les disponibilités pour ces dates et ce type de service
    const startOfRange = new Date(start);
    startOfRange.setUTCHours(0, 0, 0, 0);
    const endOfRange = new Date(end);
    endOfRange.setUTCHours(23, 59, 59, 999);

    const availabilities = await prisma.availability.findMany({
      where: {
        date: {
          gte: startOfRange,
          lte: endOfRange,
        },
        serviceType, // Important: filtrer par type de service !
      },
    });

    // Vérifier que toutes les dates sont disponibles
    const unavailableDates = selectedDateKeys.filter((dateKey) => {
      const availability = availabilities.find(
        (a) => toDateKey(a.date) === dateKey
      );
      // La date est indisponible UNIQUEMENT si elle existe dans la BDD ET est marquée comme indisponible
      return availability && !availability.available;
    });

    if (unavailableDates.length > 0) {
      return NextResponse.json(
        {
          error: `Certaines dates ne sont pas disponibles.`,
        },
        { status: 400 }
      );
    }

    // Vérifier les conflits réels (réservations CONFIRMED ou IN_PROGRESS)
    const potentiallyConflictingBookings = await prisma.booking.findMany({
      where: {
        pets: { some: { id: { in: petIds } } },
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        OR: [
          {
            AND: [{ startDate: { lte: start } }, { endDate: { gte: start } }],
          },
          {
            AND: [{ startDate: { lte: end } }, { endDate: { gte: end } }],
          },
          {
            AND: [{ startDate: { gte: start } }, { endDate: { lte: end } }],
          },
        ],
      },
    });

    const conflictingBookings = isHourlyService
      ? potentiallyConflictingBookings.filter((booking) => {
          const bookingDates = getDateKeysInRange(booking.startDate, booking.endDate);
          return selectedDateKeys.some((dateKey) => bookingDates.includes(dateKey));
        })
      : potentiallyConflictingBookings;

    if (conflictingBookings.length > 0) {
      return NextResponse.json(
        {
          error: "Une réservation confirmée existe déjà pour l'un de ces animaux sur cette période",
        },
        { status: 400 }
      );
    }

    // Transaction atomique : créer la réservation et déduire les crédits.
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          startDate: start,
          endDate: end,
          startTime: startTime || null,
          endTime: endTime || null,
          status: "PENDING",
          serviceType,
          totalPrice: useCredits ? 0 : finalTotal,
          depositPaid: useCredits ? true : false,
          depositAmount: useCredits ? 0 : finalTotal,
          creditsUsed: useCredits ? creditsToDeduct : 0,
          specialRequests: buildSpecialRequests(notes, serviceDetails),
          notes: [
            paymentMethod ? `Mode de paiement: ${paymentMethod}` : null,
            promoCode && !useCredits ? `Code promo: ${promoCode.toUpperCase()}` : null,
          ].filter(Boolean).join("\n") || null,
          clientId: session.user.id,
          pets: {
            connect: petIds.map((id) => ({ id })),
          },
          petId: petIds[0],
        },
        include: {
          pets: { select: { name: true, breed: true } },
          client: { select: { name: true, email: true } },
        },
      });

      // Déduire les crédits (FIFO par date d'expiration)
      if (useCredits && creditsToDeduct > 0) {
        const batches = await tx.creditBatch.findMany({
          where: { userId: session.user.id, serviceType, remaining: { gt: 0 } },
          orderBy: { expiresAt: 'asc' },
        });

        const availableInTransaction = batches.reduce((sum, batch) => sum + batch.remaining, 0);
        if (availableInTransaction < creditsToDeduct) {
          throw new BookingInputError("Crédits insuffisants");
        }

        let remainingToDeduct = creditsToDeduct;
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;
          const deduction = Math.min(batch.remaining, remainingToDeduct);
          await tx.creditBatch.update({
            where: { id: batch.id },
            data: { remaining: batch.remaining - deduction },
          });
          remainingToDeduct -= deduction;
        }
      }

      return newBooking;
    });

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
        serviceDetails: extractServiceDetails(booking.specialRequests),
        specialRequests: stripServiceDetails(booking.specialRequests),
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

    if (error instanceof BookingInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
        creditsUsed: b.creditsUsed,
        serviceDetails: extractServiceDetails(b.specialRequests),
        specialRequests: stripServiceDetails(b.specialRequests),
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
