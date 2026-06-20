import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    const { email } = schema.parse(await request.json());
    const normalizedEmail = email.trim().toLowerCase();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const { success } = rateLimit(`forgot-password:${ip}:${normalizedEmail}`, {
      maxRequests: 3,
      windowSeconds: 3600,
    });
    if (!success) return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const token = createHash("sha256").update(rawToken).digest("hex");
      const accountEmail = user.email.toLowerCase();
      const identifier = `password-reset:${accountEmail}`;
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.verificationToken.deleteMany({ where: { identifier } }),
        prisma.verificationToken.create({ data: { identifier, token, expires } }),
      ]);

      const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?email=${encodeURIComponent(accountEmail)}&token=${rawToken}`;
      await sendPasswordResetEmail(user.email, user.name || "Client", resetUrl);
    }

    return NextResponse.json({
      success: true,
      message: "Si un compte correspond à cette adresse, un email vient d'être envoyé.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    console.error("Erreur mot de passe oublié:", error);
    return NextResponse.json({ error: "Impossible de traiter la demande" }, { status: 500 });
  }
}
