import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { SERVICE_TYPES } from "@/lib/services";
import { z } from "zod";

const couponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "CUSTOM_TOTAL"]),
  discountValue: z.number().positive(),
  minAmount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  restrictedTo: z.array(z.string().email()).optional(),
  applicableServices: z.array(z.enum(SERVICE_TYPES)).optional(),
}).superRefine((coupon, context) => {
  if (coupon.discountType === "PERCENTAGE" && coupon.discountValue > 20) {
    context.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Une remise en pourcentage ne peut pas dépasser 20%",
    });
  }

  if (coupon.discountType === "CUSTOM_TOTAL" && coupon.discountValue < 1) {
    context.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Le tarif final personnalisé doit être d'au moins 1€",
    });
  }
});

const couponUpdateSchema = couponSchema.safeExtend({
  id: z.string().min(1),
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
        applicableServices: validatedData.applicableServices || [],
      },
    });

    return NextResponse.json({
      success: true,
      coupon,
      message: `Code promo ${coupon.code} créé avec succès`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Coupon invalide" },
        { status: 400 }
      );
    }

    console.error("Erreur lors de la création du coupon:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// Lister tous les coupons
export async function GET() {
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

    const updateData =
      body.code || body.discountType || body.discountValue !== undefined
        ? couponUpdateSchema.parse({ ...body, id: couponId })
        : null;

    if (updateData) {
      const existing = await prisma.coupon.findFirst({
        where: {
          code: updateData.code,
          id: { not: couponId },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Ce code promo existe déjà" },
          { status: 400 }
        );
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: updateData
        ? {
            code: updateData.code,
            description: updateData.description,
            discountType: updateData.discountType,
            discountValue: updateData.discountValue,
            minAmount: updateData.minAmount ?? null,
            maxUses: updateData.maxUses ?? null,
            validFrom: updateData.validFrom ? new Date(updateData.validFrom) : null,
            validUntil: updateData.validUntil ? new Date(updateData.validUntil) : null,
            restrictedTo: updateData.restrictedTo || [],
            applicableServices: updateData.applicableServices || [],
            isActive: isActive !== undefined ? isActive : undefined,
          }
        : {
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

// Supprimer complètement un coupon
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { couponId } = await request.json();

    if (!couponId) {
      return NextResponse.json(
        { error: "ID du coupon requis" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { autoApplyCouponId: couponId },
        data: { autoApplyCouponId: null },
      });

      await tx.coupon.delete({
        where: { id: couponId },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Code promo supprimé",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du coupon:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
