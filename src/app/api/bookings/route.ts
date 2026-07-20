import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { distributedRateLimit } from "@/lib/rate-limit";
import { buildSpecialRequests, extractServiceDetails, stripServiceDetails } from "@/lib/booking-details";
import { calculatePremiumDiscount } from "@/lib/loyalty";
import { calculateBookingPrice, calculateSameDayDurationMinutes, calculateServiceDurationMinutes, MAX_VISIT_DURATION_MINUTES } from "@/lib/pricing";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";
import { isHourlyServiceType, isOvernightServiceType, SERVICE_TYPES } from "@/lib/services";
import {
  countBookingsByDate,
  getDateKeysInRange,
  getHourlyBookingConflicts,
  parseUTCDate,
  toDateKey,
} from "@/lib/booking-availability";
import {
  WELCOME_OFFER_CODE,
  WELCOME_OFFER_DISCOUNT_PERCENT,
  WELCOME_OFFER_MAX_CLIENTS,
  WELCOME_OFFER_NOTE,
  isWelcomeOfferCode,
} from "@/lib/welcome-offer";

class BookingInputError extends Error {}

function sameBookingPets(
  existingPets: Array<{ id: string }>,
  legacyPetId: string | null,
  requestedPetIds: string[]
) {
  const existingIds = existingPets.length > 0
    ? existingPets.map((pet) => pet.id)
    : (legacyPetId ? [legacyPetId] : []);

  if (existingIds.length !== requestedPetIds.length) return false;

  const existingKey = [...existingIds].sort().join("|");
  const requestedKey = [...requestedPetIds].sort().join("|");
  return existingKey === requestedKey;
}

const visitSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de passage invalide"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure de passage invalide"),
  duration: z.number().int().refine((duration) => [30, 60, 90, MAX_VISIT_DURATION_MINUTES].includes(duration), {
    message: "La durée doit être de 30 min, 1h, 1h30 ou 2h maximum",
  }),
});

// Schéma de validation pour la création de réservation
const createBookingSchema = z.object({
  petIds: z.array(z.string()).min(1, "Au moins un animal est requis"),
  pricingPetIds: z.array(z.string()).min(1).optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure de début invalide").optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure de fin invalide").optional(),
  serviceType: z.enum(SERVICE_TYPES),
  // Conservés temporairement pour les anciens clients, mais jamais utilisés côté serveur.
  totalPrice: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(["PAYPAL", "WERO", "BANK_TRANSFER"]).optional(),
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
    const { success: rateLimitOk } = await distributedRateLimit(`booking:${session.user.id}`, { maxRequests: 10, windowSeconds: 3600 });
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
      serviceDetails,
    } = validatedData;

    const isHourlyService = isHourlyServiceType(serviceType);
    const visitSlots = serviceDetails?.visitSlots || [];
    const pricingContextIds = pricingPetIds || petIds;

    // Convertir les dates en UTC pour éviter les problèmes de fuseau horaire
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);

    // Vérifier que la période est cohérente.
    // La garderie peut être réservée sur une seule journée, contrairement aux services à la nuit.
    if (isOvernightServiceType(serviceType) ? end <= start : end < start) {
      return NextResponse.json(
        { error: isOvernightServiceType(serviceType) ? "La date de fin doit être après la date de début" : "La date de fin ne peut pas être avant la date de début" },
        { status: 400 }
      );
    }

    if (serviceType === "DAY_CARE" && startDate !== endDate) {
      return NextResponse.json(
        { error: "La garderie de jour se réserve sur une seule journée. Pour plusieurs jours avec nuit, choisissez l'hébergement." },
        { status: 400 }
      );
    }

    if (serviceType === "DAY_CARE") {
      const dayCareDurationMinutes = calculateServiceDurationMinutes({ startDate, endDate, startTime, endTime });
      if (dayCareDurationMinutes <= 0 || dayCareDurationMinutes > 600) {
        return NextResponse.json(
          { error: "La garderie doit durer entre quelques minutes et 10 heures maximum, avec une fin après le début" },
          { status: 400 }
        );
      }
    }

    if (
      serviceType === "HOUSE_SITTING"
      && calculateSameDayDurationMinutes({ startTime, endTime }) <= 0
    ) {
      return NextResponse.json(
        { error: "La garde à domicile doit commencer et se terminer le même jour, avec une heure de fin après l’heure de début. Les nuitées ne sont pas proposées." },
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

    if (serviceType === "DOG_WALKING" && pets.some((pet) => pet.species === "CAT")) {
      return NextResponse.json(
        { error: "La promenade chat n'est pas proposée par défaut. Contactez-nous pour une demande spécifique." },
        { status: 400 }
      );
    }

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
    let couponDiscountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL" | null = null;
    if (promoCode) {
      if (pricingContextIds.length !== petIds.length) {
        return NextResponse.json(
          { error: "Les codes promo nécessitent des dates communes à tous les animaux" },
          { status: 400 }
        );
      }

      if (isWelcomeOfferCode(promoCode)) {
        const [hasPreviousBooking, existingClaim, claimedPlaces] = await Promise.all([
          prisma.booking.findFirst({
            where: {
              clientId: session.user.id,
              OR: [
                { depositPaid: true },
                { payment: { is: { status: "SUCCEEDED" } } },
                { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
              ],
            },
            select: { id: true },
          }),
          prisma.booking.findFirst({
            where: {
              clientId: session.user.id,
              couponRedeemedAt: { not: null },
              notes: { contains: WELCOME_OFFER_NOTE },
            },
            select: { id: true },
          }),
          prisma.booking.count({
            where: {
              couponRedeemedAt: { not: null },
              notes: { contains: WELCOME_OFFER_NOTE },
            },
          }),
        ]);

        if (hasPreviousBooking) throw new BookingInputError("Cette offre est réservée aux nouveaux clients, pour leur première réservation.");
        if (!existingClaim && claimedPlaces >= WELCOME_OFFER_MAX_CLIENTS) throw new BookingInputError("Les 5 offres de bienvenue ont déjà été attribuées.");

        couponDiscountType = "PERCENTAGE";
        finalTotal = calculateCouponDiscount({
          totalAmount: priceResult.total,
          discountType: "PERCENTAGE",
          discountValue: WELCOME_OFFER_DISCOUNT_PERCENT,
          quantity: priceResult.quantity,
        }).finalAmount;
      } else {
        const coupon = await prisma.coupon.findUnique({
          where: { code: promoCode.toUpperCase() },
        });
        const now = new Date();

        if (!coupon || !coupon.isActive) throw new BookingInputError("Code promo invalide ou inactif");
        if (coupon.validFrom && now < coupon.validFrom) throw new BookingInputError("Ce code promo n'est pas encore valide");
        if (coupon.validUntil && now > coupon.validUntil) throw new BookingInputError("Ce code promo a expiré");
        if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) throw new BookingInputError("Ce code promo a atteint sa limite d'utilisation");
        if (coupon.minAmount && priceResult.total < coupon.minAmount) throw new BookingInputError(`Montant minimum de ${coupon.minAmount}€ requis`);
        const userEmail = session.user.email?.toLowerCase() || "";
        if (coupon.restrictedTo.length > 0 && !coupon.restrictedTo.map((email) => email.toLowerCase()).includes(userEmail)) throw new BookingInputError("Ce code promo n'est pas valide pour votre compte");
        if (coupon.applicableServices.length > 0 && !coupon.applicableServices.includes(serviceType)) throw new BookingInputError("Ce code promo n'est pas valide pour ce service");

        couponDiscountType = coupon.discountType;
        finalTotal = calculateCouponDiscount({
          totalAmount: priceResult.total,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          quantity: priceResult.quantity,
        }).finalAmount;
      }
    }

    const activePremium = await prisma.userSubscription.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    });
    const isPremium = activePremium?.status === "ACTIVE";
    const premiumDiscount = isPremium && couponDiscountType !== "CUSTOM_TOTAL" ? calculatePremiumDiscount(finalTotal) : null;
    if (premiumDiscount) {
      finalTotal = premiumDiscount.finalAmount;
    }

    const bookingSpecialRequests = buildSpecialRequests(notes, serviceDetails);
    const bookingNotes = [
      paymentMethod ? `Mode de paiement: ${paymentMethod}` : null,
      promoCode ? `Code promo: ${isWelcomeOfferCode(promoCode) ? WELCOME_OFFER_CODE : promoCode.toUpperCase()}` : null,
      isPremium ? "Premium actif: Pattes doublées" : null,
      premiumDiscount ? `Avantage Premium: -${premiumDiscount.discountAmount}€` : null,
    ].filter(Boolean).join("\n") || null;

    const pendingDuplicateCandidates = await prisma.booking.findMany({
      where: {
        clientId: session.user.id,
        status: "PENDING",
        serviceType,
        startDate: start,
        endDate: end,
        startTime: startTime || null,
        endTime: endTime || null,
        notes: bookingNotes,
        specialRequests: bookingSpecialRequests,
      },
      include: {
        pets: { select: { id: true, name: true, breed: true } },
        pet: { select: { id: true } },
        payment: { select: { status: true, stripePaymentId: true } },
        client: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const exactPendingDuplicates = pendingDuplicateCandidates.filter((booking) =>
      sameBookingPets(booking.pets, booking.petId, petIds)
    );

    const duplicateWithStripePayment = exactPendingDuplicates.find((booking) =>
      Boolean(booking.payment?.stripePaymentId) || booking.payment?.status === "SUCCEEDED"
    );

    if (duplicateWithStripePayment) {
      return NextResponse.json(
        {
          error: "Une réservation identique est déjà en attente. Retrouvez-la dans votre dashboard ou contactez-nous si vous souhaitez la modifier.",
        },
        { status: 409 }
      );
    }

    const reusableDuplicate = exactPendingDuplicates[0];
    if (reusableDuplicate) {
      const booking = await prisma.booking.update({
        where: { id: reusableDuplicate.id },
        data: {
          totalPrice: finalTotal,
          depositAmount: finalTotal,
        },
        include: {
          pets: { select: { name: true, breed: true } },
          client: { select: { name: true, email: true } },
        },
      });

      return NextResponse.json({
        success: true,
        reusedExistingBooking: true,
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
        message: "Une réservation identique existe déjà. Elle va être réutilisée pour le paiement.",
      });
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

    const selectedDateKeySet = new Set(selectedDateKeys);
    const availabilityByDate = new Map(
      availabilities.map((availability) => [toDateKey(availability.date), availability])
    );

    // Vérifier que toutes les dates sont ouvertes manuellement.
    const unavailableDates = selectedDateKeys.filter((dateKey) => {
      const availability = availabilities.find(
        (a) => toDateKey(a.date) === dateKey
      );
      return availability && (!availability.available || availability.maxSlots <= 0);
    });

    if (unavailableDates.length > 0) {
      return NextResponse.json(
        {
          error: `Certaines dates ne sont pas disponibles.`,
        },
        { status: 400 }
      );
    }

    // Vérifier la capacité réelle du service sur les dates demandées.
    const existingServiceBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["ACCEPTING", "CANCELLING", "CONFIRMED", "IN_PROGRESS"] },
        serviceType,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        serviceType: true,
        specialRequests: true,
      },
    });
    const fullyBookedDates = isHourlyService
      ? getHourlyBookingConflicts(
          existingServiceBookings,
          visitSlots.map((slot) => ({
            date: slot.date,
            startTime: slot.startTime,
            duration: slot.duration,
          }))
        ).map((slot) => slot.date || "")
      : (() => {
          const serviceBookingCountsByDate = countBookingsByDate(existingServiceBookings, selectedDateKeySet);
          return selectedDateKeys.filter((dateKey) => {
            const maxSlots = availabilityByDate.get(dateKey)?.maxSlots ?? 1;
            return (serviceBookingCountsByDate.get(dateKey) || 0) >= maxSlots;
          });
        })();

    if (fullyBookedDates.length > 0) {
      return NextResponse.json(
        {
          error: isHourlyService
            ? "Certains créneaux horaires sont déjà réservés."
            : "Certaines dates sont déjà réservées.",
        },
        { status: 400 }
      );
    }

    // Vérifier les conflits réels pour les animaux (tous services confondus).
    const potentiallyConflictingBookings = await prisma.booking.findMany({
      where: {
        pets: { some: { id: { in: petIds } } },
        status: { in: ["ACCEPTING", "CANCELLING", "CONFIRMED", "IN_PROGRESS"] },
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
          if (isHourlyServiceType(booking.serviceType)) {
            return getHourlyBookingConflicts(
              [booking],
              visitSlots.map((slot) => ({
                date: slot.date,
                startTime: slot.startTime,
                duration: slot.duration,
              }))
            ).length > 0;
          }

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

    const booking = await prisma.booking.create({
        data: {
          startDate: start,
          endDate: end,
          startTime: startTime || null,
          endTime: endTime || null,
          status: "PENDING",
          serviceType,
          totalPrice: finalTotal,
          depositPaid: false,
          depositAmount: finalTotal,
          specialRequests: bookingSpecialRequests,
          notes: bookingNotes,
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

    console.error("Erreur lors de la création de la réservation:", error);

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
export async function GET() {
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
