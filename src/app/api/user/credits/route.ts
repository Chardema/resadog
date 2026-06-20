import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ total: 0, byService: { DOG_WALKING: 0, DAY_CARE: 0 } });
  }

  const creditBatches = await prisma.creditBatch.findMany({
    where: {
      userId: session.user.id,
      remaining: { gt: 0 },
      // expiresAt logic removed as requested (unlimited)
    }
  });

  const total = creditBatches.reduce((acc, batch) => acc + batch.remaining, 0);
  const byService = creditBatches.reduce<Record<string, number>>((acc, batch) => {
    acc[batch.serviceType] = (acc[batch.serviceType] || 0) + batch.remaining;
    return acc;
  }, { DOG_WALKING: 0, DAY_CARE: 0 });

  return NextResponse.json({ total, byService });
}
