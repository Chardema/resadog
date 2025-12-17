import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
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
      console.log(`[Coupon] ${code} inactif`);
      return NextResponse.json(
        { error: "Ce code promo n'est plus actif" },
        { status: 400 }
      );
    }

    // Vérifier la date de validité
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      console.log(`[Coupon] ${code} pas encore valide (Début: ${coupon.validFrom})`);
      return NextResponse.json(
        { error: "Ce code promo n'est pas encore valide" },
        { status: 400 }
      );
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      console.log(`[Coupon] ${code} expiré (Fin: ${coupon.validUntil})`);
      return NextResponse.json(
        { error: "Ce code promo a expiré" },
        { status: 400 }
      );
    }

    // Vérifier le nombre d'utilisations
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      console.log(`[Coupon] ${code} max utilisations atteint (${coupon.currentUses}/${coupon.maxUses})`);
      return NextResponse.json(
        { error: "Ce code promo a atteint son nombre maximum d'utilisations" },
        { status: 400 }
      );
    }

    // Vérifier le montant minimum
    if (coupon.minAmount && totalAmount < coupon.minAmount) {
      console.log(`[Coupon] ${code} montant insuffisant (${totalAmount} < ${coupon.minAmount})`);
      return NextResponse.json(
        {
          error: `Montant minimum de ${coupon.minAmount}€ requis pour utiliser ce code`,
        },
        { status: 400 }
      );
    }

    // Vérifier les restrictions d'email
    if (coupon.restrictedTo.length > 0 && !coupon.restrictedTo.includes(session.user.email || "")) {
      console.log(`[Coupon] ${code} restreint (User: ${session.user.email})`);
      return NextResponse.json(
        { error: "Ce code promo n'est pas valide pour votre compte" },
        { status: 403 }
      );
    }

    // Calculer la réduction
    let discountAmount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = (totalAmount * coupon.discountValue) / 100;
    } else {
      // Pour le montant fixe, on multiplie par la durée si elle est fournie
      // Cela permet d'adapter la réduction au nombre de nuitées
      const multiplier = duration && duration > 0 ? duration : 1;
      discountAmount = coupon.discountValue * multiplier;
    }

    // Ne pas permettre une réduction supérieure au total
    discountAmount = Math.min(discountAmount, totalAmount);

    const finalAmount = Math.max(0, totalAmount - discountAmount);

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
      message: coupon.discountType === "PERCENTAGE"
        ? `Réduction de ${coupon.discountValue}% appliquée`
        : `Réduction de ${coupon.discountValue}€${duration && duration > 1 ? " / nuit" : ""} appliquée`,
    });
  } catch (error) {
    console.error("Erreur lors de la validation du coupon:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
