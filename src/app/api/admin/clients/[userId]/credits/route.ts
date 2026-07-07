import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { SERVICE_TYPES } from "@/lib/services";
import { z } from "zod";

const updateCreditsSchema = z.object({
  amount: z.number().int(), // Peut être négatif pour retirer
  serviceType: z.enum(SERVICE_TYPES).default("DOG_WALKING"),
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { amount, serviceType, reason } = updateCreditsSchema.parse(body);

    if (amount > 0) {
        // Ajouter des crédits (Nouveau Batch)
        await prisma.creditBatch.create({
            data: {
                userId,
                amount,
                remaining: amount,
                serviceType,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an
            }
        });
    } else if (amount < 0) {
        // Retirer des crédits (FIFO)
        let toRemove = Math.abs(amount);
        const batches = await prisma.creditBatch.findMany({
            where: { userId, remaining: { gt: 0 } },
            orderBy: { expiresAt: 'asc' }
        });

        for (const batch of batches) {
            if (toRemove <= 0) break;
            const deduction = Math.min(batch.remaining, toRemove);
            await prisma.creditBatch.update({
                where: { id: batch.id },
                data: { remaining: batch.remaining - deduction }
            });
            toRemove -= deduction;
        }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur update credits:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
