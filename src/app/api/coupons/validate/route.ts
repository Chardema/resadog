import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { distributedRateLimit } from "@/lib/rate-limit";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";
import {
  WELCOME_OFFER_CODE,
  WELCOME_OFFER_DESCRIPTION,
  WELCOME_OFFER_DISCOUNT_PERCENT,
  WELCOME_OFFER_MAX_CLIENTS,
  WELCOME_OFFER_NOTE,
  isWelcomeOfferCode,
} from "@/lib/welcome-offer";

function getCouponSuccessMessage(input: {
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL";
  discountValue: number;
  discountAmount: number;
  finalAmount: number;
  capped: boolean;
}) {
  if (input.discountType === "CUSTOM_TOTAL") {
    return `Tarif personnalisé appliqué : ${input.finalAmount}€`;
  }

  if (input.capped) {
    return `Réduction plafonnée à ${input.discountAmount}€`;
  }

  return input.discountType === "PERCENTAGE"
    ? `Réduction de ${input.discountValue}% appliquée`
    : `Réduction de ${input.discountAmount}€ appliquée`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    // Rate limiting : 20 validations par user par heure (anti brute-force de codes)
    const { success } = await distributedRateLimit(`coupon:${session.user.id}`, { maxRequests: 20, windowSeconds: 3600 });
    if (!success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code, totalAmount, serviceType, duration } = body;

    if (!code || typeof totalAmount !== "number") {
      return NextResponse.json(
        { error: "Code et montant requis" },
        { status: 400 }
      );
    }

    if (isWelcomeOfferCode(code)) {
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

      if (hasPreviousBooking) {
        return NextResponse.json(
          { error: "Cette offre est réservée aux nouveaux clients, pour leur première réservation." },
          { status: 400 }
        );
      }

      if (!existingClaim && claimedPlaces >= WELCOME_OFFER_MAX_CLIENTS) {
        return NextResponse.json(
          { error: "Les 5 offres de bienvenue ont déjà été attribuées." },
          { status: 400 }
        );
      }

      const { discountAmount, finalAmount, capped } = calculateCouponDiscount({
        totalAmount,
        discountType: "PERCENTAGE",
        discountValue: WELCOME_OFFER_DISCOUNT_PERCENT,
        quantity: duration,
      });

      return NextResponse.json({
        success: true,
        coupon: {
          code: WELCOME_OFFER_CODE,
          description: WELCOME_OFFER_DESCRIPTION,
          discountType: "PERCENTAGE",
          discountValue: WELCOME_OFFER_DISCOUNT_PERCENT,
        },
        originalAmount: totalAmount,
        discountAmount,
        finalAmount,
        capped,
        message: "Offre de bienvenue : 10 % de réduction appliquée",
      });
    }

    // Chercher le coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Code promo invalide" },
        { status: 404 }
      );
    }

    // Vérifier les services applicables
    if (coupon.applicableServices.length > 0 && serviceType && !coupon.applicableServices.includes(serviceType)) {
      return NextResponse.json(
        { error: "Ce code promo n'est pas valide pour ce type de service" },
        { status: 400 }
      );
    }

    // Vérifier si le coupon est actif
    if (!coupon.isActive) {
      return NextResponse.json(
        { error: "Ce code promo n'est plus actif" },
        { status: 400 }
      );
    }

    // Vérifier la date de validité
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return NextResponse.json(
        { error: "Ce code promo n'est pas encore valide" },
        { status: 400 }
      );
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      return NextResponse.json(
        { error: "Ce code promo a expiré" },
        { status: 400 }
      );
    }

    // Vérifier le nombre d'utilisations
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json(
        { error: "Ce code promo a atteint son nombre maximum d'utilisations" },
        { status: 400 }
      );
    }

    // Vérifier le montant minimum
    if (coupon.minAmount && totalAmount < coupon.minAmount) {
      return NextResponse.json(
        {
          error: `Montant minimum de ${coupon.minAmount}€ requis pour utiliser ce code`,
        },
        { status: 400 }
      );
    }

    // Vérifier les restrictions d'email
    const userEmail = session.user.email?.toLowerCase() || "";
    if (coupon.restrictedTo.length > 0 && !coupon.restrictedTo.map((email) => email.toLowerCase()).includes(userEmail)) {
      return NextResponse.json(
        { error: "Ce code promo n'est pas valide pour votre compte" },
        { status: 403 }
      );
    }

    const { discountAmount, finalAmount, capped } = calculateCouponDiscount({
      totalAmount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      quantity: duration,
    });

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      originalAmount: totalAmount,
      discountAmount: discountAmount,
      finalAmount: finalAmount,
      capped,
      message: getCouponSuccessMessage({
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        finalAmount,
        capped,
      }),
    });
  } catch (error) {
    console.error("Erreur lors de la validation du coupon:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
