import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendBugReport } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { description, path } = body;

    if (!description) {
      return NextResponse.json({ error: "La description est requise" }, { status: 400 });
    }

    await sendBugReport(session?.user?.email || undefined, description, path);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur API Report Bug:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
