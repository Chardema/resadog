import NextAuth from "next-auth";
import { authConfig } from "./config";
import { prisma } from "@/lib/db/prisma";

const nextAuth = NextAuth(authConfig);

export const handlers = nextAuth.handlers;
export const authUnverified = nextAuth.auth;
export const updateSession = nextAuth.unstable_update;

/**
 * Authentification forte utilisée par toutes les pages et API existantes.
 * Une session OAuth en attente de 2FA est volontairement traitée comme absente.
 * La version en base permet aussi de révoquer les JWT après un changement sensible.
 */
export async function auth() {
  const session = await authUnverified();
  if (!session?.user?.id || session.user.twoFactorVerified !== true) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailVerified: true,
      twoFactorEnabled: true,
      sessionVersion: true,
    },
  });
  if (
    !user?.emailVerified ||
    user.sessionVersion !== session.user.sessionVersion ||
    (user.twoFactorEnabled && !session.user.twoFactorVerified)
  ) {
    return null;
  }

  return session;
}
