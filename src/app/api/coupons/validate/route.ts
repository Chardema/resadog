import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { calculateCouponDiscount } from "@/lib/coupon-pricing";

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
    const { success } = rateLimit(`coupon:${session.user.id}`, { maxRequests: 20, windowSeconds: 3600 });
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
    if (coupon.restrictedTo.length > 0 && !coupon.restrictedTo.includes(session.user.email || "")) {
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
      message: capped
        ? `Réduction plafonnée à ${discountAmount}€`
        : coupon.discountType === "PERCENTAGE"
          ? `Réduction de ${coupon.discountValue}% appliquée`
          : `Réduction de ${discountAmount}€ appliquée`,
    });
  } catch (error) {
    console.error("Erreur lors de la validation du coupon:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
