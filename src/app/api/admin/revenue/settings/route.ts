import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { financeSettingsSchema } from "@/lib/finance";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origine non autorisée" }, { status: 403 });
  const parsed = financeSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Paramètres invalides" }, { status: 400 });
  try {
    await prisma.financeSettings.upsert({ where: { id: "default" }, create: { id: "default", settings: parsed.data }, update: { settings: parsed.data } });
    return NextResponse.json({ settings: parsed.data });
  } catch {
    return NextResponse.json({ error: "Les paramètres n’ont pas pu être enregistrés." }, { status: 500 });
  }
}
