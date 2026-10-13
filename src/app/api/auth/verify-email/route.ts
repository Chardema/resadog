import { NextRequest, NextResponse } from "next/server";
import { consumeEmailVerification } from "@/lib/auth/email-verification";
import { distributedRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/auth/password";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");
  const destination = new URL("/auth/signin", request.url);

  if (!email || !token || token.length < 32) {
    destination.searchParams.set("verification", "invalid");
    return NextResponse.redirect(destination);
  }

  const { success } = await distributedRateLimit(
    `verify-email:${getClientIp(request)}:${email.toLowerCase()}`,
    { maxRequests: 10, windowSeconds: 3600 }
  );
  if (!success) {
    destination.searchParams.set("verification", "rate-limited");
    return NextResponse.redirect(destination);
  }

  try {
    const verified = await consumeEmailVerification(email, token);
    destination.searchParams.set("verification", verified ? "success" : "invalid");
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Erreur vérification email:", error);
    destination.searchParams.set("verification", "error");
    return NextResponse.redirect(destination);
  }
}
