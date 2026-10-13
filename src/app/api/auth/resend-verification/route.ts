import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { distributedRateLimit } from "@/lib/rate-limit";
import { issueEmailVerification } from "@/lib/auth/email-verification";
import { getClientIp, normalizeEmail } from "@/lib/auth/password";

const schema = z.object({ email: z.string().email() });
const genericMessage =
  "Si cette adresse correspond à un compte non vérifié, un nouvel email vient d'être envoyé.";

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const normalizedEmail = normalizeEmail(email);
    const { success } = await distributedRateLimit(
      `resend-verification:${getClientIp(request)}:${normalizedEmail}`,
      { maxRequests: 3, windowSeconds: 3600 }
    );
    if (!success) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez dans une heure." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (user && !user.emailVerified) {
      try {
        await issueEmailVerification({
          userId: user.id,
          email: user.email,
          name: user.name,
        });
      } catch (error) {
        // La réponse reste identique pour ne pas révéler si le compte existe.
        console.error("Email de vérification non envoyé:", error);
      }
    }

    return NextResponse.json({ success: true, message: genericMessage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }
    console.error("Erreur renvoi vérification:", error);
    return NextResponse.json(
      { error: "Impossible d'envoyer l'email pour le moment." },
      { status: 500 }
    );
  }
}
