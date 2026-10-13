import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { distributedRateLimit } from "@/lib/rate-limit";
import { getClientIp, normalizeEmail } from "@/lib/auth/password";

const DUMMY_PASSWORD_HASH =
  "$2b$12$nmcVdOi2PNADnDLaF9zuKedZkiHikDVnhk24hqY1mvwsdw835A4dy";
const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const { email, password } = schema.parse(await request.json());
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(request);
    const [ipLimit, accountLimit] = await Promise.all([
      distributedRateLimit(`preflight-ip:${ip}`, { maxRequests: 20, windowSeconds: 900 }),
      distributedRateLimit(`preflight-account:${normalizedEmail}`, {
        maxRequests: 8,
        windowSeconds: 900,
      }),
    ]);
    if (!ipLimit.success || !accountLimit.success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        passwordHash: true,
        emailVerified: true,
        twoFactorEnabled: true,
      },
    });
    const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user?.passwordHash || !valid) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Confirmez votre adresse email avant de vous connecter.", emailUnverified: true },
        { status: 403 }
      );
    }

    return NextResponse.json({ requiresTwoFactor: user.twoFactorEnabled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Identifiants invalides." }, { status: 400 });
    }
    console.error("Erreur pré-vérification connexion:", error);
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
