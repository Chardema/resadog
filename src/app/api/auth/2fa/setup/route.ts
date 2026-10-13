import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { distributedRateLimit } from "@/lib/rate-limit";
import {
  createOtpAuthUri,
  createRecoveryCodes,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from "@/lib/auth/two-factor";

const verificationSchema = z.object({ code: z.string().regex(/^\s*\d{6}\s*$/) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });
  if (user?.twoFactorEnabled) {
    return NextResponse.json({ error: "La double authentification est déjà active." }, { status: 409 });
  }

  const { success } = await distributedRateLimit(`2fa-setup:${session.user.id}`, {
    maxRequests: 5,
    windowSeconds: 3600,
  });
  if (!success) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
  }

  const secret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(secret);
  const identifier = `two-factor-setup:${session.user.id}`;
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: encryptedSecret,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    }),
  ]);

  const uri = createOtpAuthUri(secret, session.user.email);
  const qrCode = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
  });
  return NextResponse.json(
    { secret, qrCode, expiresInSeconds: 900 },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const { code } = verificationSchema.parse(await request.json());
    const { success } = await distributedRateLimit(`2fa-setup-confirm:${session.user.id}`, {
      maxRequests: 8,
      windowSeconds: 900,
    });
    if (!success) {
      return NextResponse.json({ error: "Trop de codes incorrects." }, { status: 429 });
    }

    const identifier = `two-factor-setup:${session.user.id}`;
    const pending = await prisma.verificationToken.findFirst({ where: { identifier } });
    if (!pending || pending.expires <= new Date()) {
      return NextResponse.json({ error: "La configuration a expiré. Recommencez." }, { status: 400 });
    }

    const secret = decryptTotpSecret(pending.token);
    if (!verifyTotp(secret, code)) {
      return NextResponse.json({ error: "Code incorrect." }, { status: 400 });
    }

    const recoveryCodes = createRecoveryCodes();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptTotpSecret(secret),
          twoFactorRecoveryCodes: recoveryCodes.map((recoveryCode) =>
            hashRecoveryCode(session.user.id, recoveryCode)
          ),
        },
      }),
      prisma.verificationToken.deleteMany({ where: { identifier } }),
    ]);

    return NextResponse.json(
      { success: true, recoveryCodes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Saisissez le code à 6 chiffres." }, { status: 400 });
    }
    console.error("Erreur activation 2FA:", error);
    return NextResponse.json({ error: "Impossible d'activer la 2FA." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const { code } = z.object({ code: z.string().min(6).max(64) }).parse(await request.json());
    const { verifySecondFactor } = await import("@/lib/auth/two-factor");
    const valid = await verifySecondFactor(session.user.id, code);
    if (!valid) return NextResponse.json({ error: "Code incorrect." }, { status: 400 });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
        sessionVersion: { increment: 1 },
      },
    });
    return NextResponse.json({ success: true, sessionRevoked: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Code invalide." }, { status: 400 });
    }
    console.error("Erreur désactivation 2FA:", error);
    return NextResponse.json({ error: "Impossible de désactiver la 2FA." }, { status: 500 });
  }
}
