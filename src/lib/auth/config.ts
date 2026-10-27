import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { distributedRateLimit } from "@/lib/rate-limit";
import { getClientIp, normalizeEmail } from "@/lib/auth/password";
import { verifySecondFactor } from "@/lib/auth/two-factor";
import { sendWelcomeEmail } from "@/lib/email";

const DUMMY_PASSWORD_HASH =
  "$2b$12$nmcVdOi2PNADnDLaF9zuKedZkiHikDVnhk24hqY1mvwsdw835A4dy";

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
  secondFactor: z.string().max(64).optional(),
});

const providers: NextAuthConfig["providers"] = [
  CredentialsProvider({
    name: "Email et mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
      secondFactor: { label: "Code de sécurité", type: "text" },
    },
    async authorize(credentials, request) {
      try {
        const { email, password, secondFactor } = loginSchema.parse(credentials);
        const normalizedEmail = normalizeEmail(email);
        const ip = getClientIp(request);
        const [ipLimit, accountLimit] = await Promise.all([
          distributedRateLimit(`login-ip:${ip}`, { maxRequests: 30, windowSeconds: 900 }),
          distributedRateLimit(`login-account:${normalizedEmail}`, {
            maxRequests: 10,
            windowSeconds: 900,
          }),
        ]);
        if (!ipLimit.success || !accountLimit.success) return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        });
        const isValid = await bcrypt.compare(
          password,
          user?.passwordHash || DUMMY_PASSWORD_HASH
        );

        if (!user || !user.passwordHash || !isValid || !user.emailVerified) return null;
        if (user.twoFactorEnabled) {
          if (!secondFactor || !(await verifySecondFactor(user.id, secondFactor))) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          twoFactorVerified: true,
          sessionVersion: user.sessionVersion,
        };
      } catch {
        return null;
      }
    },
  }),
];

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // Google et Apple garantissent la propriété de l'adresse retournée.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

const appleClientId = process.env.AUTH_APPLE_ID || process.env.APPLE_CLIENT_ID;
const appleClientSecret =
  process.env.AUTH_APPLE_SECRET || process.env.APPLE_CLIENT_SECRET;
if (appleClientId && appleClientSecret) {
  providers.push(
    Apple({
      clientId: appleClientId,
      clientSecret: appleClientSecret,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

async function consumeTwoFactorSessionToken(userId: string, rawToken: string) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const identifier = `two-factor-session:${userId}`;
  return prisma.$transaction(async (transaction) => {
    const stored = await transaction.verificationToken.findUnique({
      where: { token: tokenHash },
    });
    if (!stored || stored.identifier !== identifier || stored.expires <= new Date()) {
      return false;
    }
    await transaction.verificationToken.deleteMany({ where: { identifier } });
    return true;
  });
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  trustHost: true,
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      if (!user.email) return false;

      if (account.provider === "google" && profile?.email_verified !== true) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        const databaseUser = await prisma.user.findFirst({
          where: user.id
            ? { id: user.id }
            : { email: { equals: user.email || "", mode: "insensitive" } },
          select: {
            id: true,
            role: true,
            sessionVersion: true,
            twoFactorEnabled: true,
          },
        });
        if (!databaseUser) return token;

        token.id = databaseUser.id;
        token.role = databaseUser.role;
        token.sessionVersion = databaseUser.sessionVersion;
        token.twoFactorVerified =
          account?.provider === "credentials" || !databaseUser.twoFactorEnabled;

        await prisma.user.update({
          where: { id: databaseUser.id },
          data: { lastLoginAt: new Date() },
        });
      }

      if (
        trigger === "update" &&
        typeof token.id === "string" &&
        typeof session?.twoFactorToken === "string" &&
        session.twoFactorToken.length >= 32
      ) {
        token.twoFactorVerified = await consumeTwoFactorSessionToken(
          token.id,
          session.twoFactorToken
        );
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = token.role as Role;
        session.user.twoFactorVerified = token.twoFactorVerified === true;
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : -1;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
        if (user.email) {
          try {
            await sendWelcomeEmail(user.email, user.name || "Client", {
              idempotencyKey: `welcome-${user.id}`,
            });
          } catch (error) {
            console.error("Compte social créé, mais email de bienvenue non envoyé:", error);
          }
        }
      }
    },
    async signIn({ user, account }) {
      if (user.id && account?.provider !== "credentials") {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
} satisfies NextAuthConfig;
