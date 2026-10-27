import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authUnverified } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { distributedRateLimit } from "@/lib/rate-limit";
import { verifySecondFactor } from "@/lib/auth/two-factor";

const schema = z.object({ code: z.string().min(6).max(64) });

export async function POST(request: Request) {
  const session = await authUnverified();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Session de connexion expirée." }, { status: 401 });
  }
  if (session.user.twoFactorVerified) {
    return NextResponse.json({ alreadyVerified: true });
  }

  try {
    const { code } = schema.parse(await request.json());
    const { success } = await distributedRateLimit(`2fa-challenge:${session.user.id}`, {
      maxRequests: 8,
      windowSeconds: 900,
    });
    if (!success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans 15 minutes." },
        { status: 429 }
      );
    }

    if (!(await verifySecondFactor(session.user.id, code))) {
      return NextResponse.json({ error: "Code incorrect." }, { status: 400 });
    }

    const rawToken = randomBytes(32).toString("base64url");
    const token = createHash("sha256").update(rawToken).digest("hex");
    const identifier = `two-factor-session:${session.user.id}`;
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { identifier } }),
      prisma.verificationToken.create({
        data: {
          identifier,
          token,
          expires: new Date(Date.now() + 5 * 60 * 1000),
        },
      }),
    ]);

    return NextResponse.json(
      { twoFactorToken: rawToken },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Code invalide." }, { status: 400 });
    }
    console.error("Erreur challenge 2FA:", error);
    return NextResponse.json({ error: "Vérification momentanément indisponible." }, { status: 500 });
  }
}
