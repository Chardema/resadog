import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { redeemLoyaltyReward } from "@/lib/loyalty-ledger";

const redeemSchema = z.object({
  threshold: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }

    const { threshold } = redeemSchema.parse(await request.json());
    const redemption = await redeemLoyaltyReward(session.user.id, threshold);

    return NextResponse.json({
      success: true,
      reward: redemption.reward,
      coupon: redemption.coupon,
      message: `Code ${redemption.coupon.code} créé pour ${redemption.reward.label}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Récompense invalide" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'utiliser cette récompense" },
      { status: 400 }
    );
  }
}
