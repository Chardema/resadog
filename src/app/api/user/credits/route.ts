import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { SERVICE_TYPES } from "@/lib/services";

const emptyCreditBalances = () =>
  Object.fromEntries(SERVICE_TYPES.map((serviceType) => [serviceType, 0]));

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ total: 0, byService: emptyCreditBalances() });
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
  }, emptyCreditBalances());

  return NextResponse.json({ total, byService });
}
