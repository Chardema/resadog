import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  createRecoveryCodes,
  hashRecoveryCode,
  verifySecondFactor,
} from "@/lib/auth/two-factor";
import { distributedRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const { code } = z.object({ code: z.string().min(6).max(64) }).parse(await request.json());
    const { success } = await distributedRateLimit(`2fa-recovery-regenerate:${session.user.id}`, {
      maxRequests: 3,
      windowSeconds: 3600,
    });
    if (!success) {
      return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
    }
    if (!(await verifySecondFactor(session.user.id, code))) {
      return NextResponse.json({ error: "Code incorrect." }, { status: 400 });
    }

    const recoveryCodes = createRecoveryCodes();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorRecoveryCodes: recoveryCodes.map((recoveryCode) =>
          hashRecoveryCode(session.user.id, recoveryCode)
        ),
      },
    });
    return NextResponse.json(
      { recoveryCodes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Code invalide." }, { status: 400 });
    }
    console.error("Erreur renouvellement codes de récupération:", error);
    return NextResponse.json({ error: "Impossible de renouveler les codes." }, { status: 500 });
  }
}
