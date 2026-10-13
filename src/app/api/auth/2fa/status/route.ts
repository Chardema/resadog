import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      twoFactorEnabled: true,
      twoFactorRecoveryCodes: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  return NextResponse.json(
    {
      enabled: user.twoFactorEnabled,
      recoveryCodesRemaining: user.twoFactorRecoveryCodes.length,
      methods: [
        ...(user.passwordHash ? ["password"] : []),
        ...user.accounts.map((account) => account.provider),
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
