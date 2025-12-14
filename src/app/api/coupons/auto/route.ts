import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

// Récupérer le coupon auto-appliqué de l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Vous devez être connecté" },
        { status: 401 }
      );
    }

    // Charger l'utilisateur avec son coupon auto
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        autoApplyCoupon: true,
      },
    });

    if (!user || !user.autoApplyCoupon) {
      return NextResponse.json({ autoCoupon: null });
    }

    const coupon = user.autoApplyCoupon;

    // Vérifier si le coupon est toujours valide
    if (!coupon.isActive) {
      return NextResponse.json({ autoCoupon: null });
    }

    const now = new Date();
    if ((coupon.validFrom && now < coupon.validFrom) || (coupon.validUntil && now > coupon.validUntil)) {
      return NextResponse.json({ autoCoupon: null });
    }

    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json({ autoCoupon: null });
    }

    return NextResponse.json({
      autoCoupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minAmount: coupon.minAmount,
      },
    });
  } catch (error) {
    console.error("Erreur lors du chargement du coupon auto:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
