import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getClientIp, passwordSchema } from "@/lib/auth/password";
import { distributedRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(32),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const { success } = await distributedRateLimit(`reset-password:${getClientIp(request)}`, {
      maxRequests: 10,
      windowSeconds: 3600,
    });
    if (!success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const data = schema.parse(await request.json());
    const email = data.email.trim().toLowerCase();
    const token = createHash("sha256").update(data.token).digest("hex");
    const identifier = `password-reset:${email}`;

    const storedToken = await prisma.verificationToken.findUnique({ where: { token } });
    if (!storedToken || storedToken.identifier !== identifier || storedToken.expires < new Date()) {
      return NextResponse.json({ error: "Ce lien est invalide ou a expiré" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Ce lien est invalide ou a expiré" }, { status: 400 });

    const passwordHash = await bcrypt.hash(data.password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      }),
      prisma.verificationToken.deleteMany({ where: { identifier } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }
    console.error("Erreur réinitialisation mot de passe:", error);
    return NextResponse.json({ error: "Impossible de réinitialiser le mot de passe" }, { status: 500 });
  }
}
