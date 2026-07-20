import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rotateCalendarToken } from "@/lib/calendar-token";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "SITTER")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const token = await rotateCalendarToken(session.user.id);

  return NextResponse.json({ token });
}
