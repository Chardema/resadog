import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendWelcomeEmail } from "@/lib/email";

const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { userId } = await params;
    const client = await prisma.user.findFirst({
      where: {
        id: userId,
        role: "CLIENT",
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    const timeBucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);
    await sendWelcomeEmail(client.email, client.name || "Client", {
      idempotencyKey: `admin-welcome-${client.id}-${timeBucket}`,
    });

    return NextResponse.json({
      success: true,
      message: `Mail explicatif envoyé à ${client.email}.`,
    });
  } catch (error) {
    console.error("Erreur envoi manuel du mail explicatif:", error);
    return NextResponse.json(
      { error: "Le mail explicatif n'a pas pu être envoyé." },
      { status: 500 }
    );
  }
}
