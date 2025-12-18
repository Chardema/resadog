import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ total: 0 });

  // Récupérer les lots de crédits actifs
  // Note: On pourrait filtrer par serviceType, mais pour l'instant les crédits sont universels
  // ou on filtre côté client. Simplifions : universels.
  const creditBatches = await prisma.creditBatch.findMany({
    where: {
      userId: session.user.id,
      remaining: { gt: 0 },
      // expiresAt logic removed as requested (unlimited)
    }
  });

  const total = creditBatches.reduce((acc, batch) => acc + batch.remaining, 0);

  return NextResponse.json({ total });
}
