import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET public — Récupérer les avis actifs pour l'affichage
export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Erreur récupération avis:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
