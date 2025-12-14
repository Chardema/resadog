import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const couponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().positive(),
  minAmount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  restrictedTo: z.array(z.string().email()).optional(),
});

// Créer un nouveau coupon
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = couponSchema.parse(body);

    // Vérifier que le code n'existe pas déjà
    const existing = await prisma.coupon.findUnique({
      where: { code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ce code promo existe déjà" },
        { status: 400 }
      );
    }

    // Créer le coupon
    const coupon = await prisma.coupon.create({
      data: {
        code: validatedData.code,
        description: validatedData.description,
        discountType: validatedData.discountType,
        discountValue: validatedData.discountValue,
        minAmount: validatedData.minAmount,
        maxUses: validatedData.maxUses,
        validFrom: validatedData.validFrom ? new Date(validatedData.validFrom) : null,
        validUntil: validatedData.validUntil ? new Date(validatedData.validUntil) : null,
        restrictedTo: validatedData.restrictedTo || [],
      },
    });

    return NextResponse.json({
      success: true,
      coupon,
      message: `Code promo ${coupon.code} créé avec succès`
    });
  } catch (error) {
    console.error("Erreur lors de la création du coupon:", error);

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
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// Lister tous les coupons
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        usersAutoApply: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ coupons });
  } catch (error) {
    console.error("Erreur lors du chargement des coupons:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// Mettre à jour un coupon
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { couponId, isActive } = body;

    if (!couponId) {
      return NextResponse.json(
        { error: "ID du coupon requis" },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      coupon,
      message: `Coupon ${coupon.code} ${isActive ? 'activé' : 'désactivé'}`
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du coupon:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
