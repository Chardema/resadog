import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/auth/password";
import { sendBugReport } from "@/lib/email";
import { distributedRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const identifier = session?.user?.id || getClientIp(request);
    const rateLimit = await distributedRateLimit(`report-bug:${identifier}`, {
      maxRequests: 5,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Trop de signalements. Veuillez réessayer plus tard." },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetIn) } }
      );
    }

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
