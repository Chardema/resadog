import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

// Assigner un code promo VIP à un client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await request.json();
    const { couponId } = body;

    if (!couponId) {
      return NextResponse.json(
        { error: "ID du coupon requis" },
        { status: 400 }
      );
    }

    // Vérifier que le coupon existe
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon introuvable" },
        { status: 404 }
      );
    }

    // Assigner le coupon VIP au client
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        autoApplyCouponId: couponId,
      },
      include: {
        autoApplyCoupon: true,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: `Code promo ${coupon.code} assigné à ${user.email}`,
    });
  } catch (error) {
    console.error("Erreur lors de l'assignation du coupon VIP:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// Retirer le statut VIP d'un client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { userId } = await params;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        autoApplyCouponId: null,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: `Statut VIP retiré pour ${user.email}`,
    });
  } catch (error) {
    console.error("Erreur lors du retrait du statut VIP:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
