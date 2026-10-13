import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { sendEmailVerificationEmail } from "@/lib/email";
import { normalizeEmail } from "@/lib/auth/password";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function verificationIdentifier(email: string) {
  return `email-verification:${normalizeEmail(email)}`;
}

export async function issueEmailVerification({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name: string | null;
}) {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const identifier = verificationIdentifier(email);
  const expires = new Date(Date.now() + VERIFICATION_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    }),
  ]);

  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("NEXTAUTH_URL manquante pour créer le lien de vérification.");
  }

  const verificationUrl = new URL("/api/auth/verify-email", siteUrl);
  verificationUrl.searchParams.set("email", normalizeEmail(email));
  verificationUrl.searchParams.set("token", rawToken);

  await sendEmailVerificationEmail(
    email,
    name || "Client",
    verificationUrl.toString(),
    { idempotencyKey: `verify-email-${userId}-${tokenHash.slice(0, 16)}` }
  );
}

export async function consumeEmailVerification(email: string, rawToken: string) {
  const normalizedEmail = normalizeEmail(email);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const identifier = verificationIdentifier(normalizedEmail);

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (
      !storedToken ||
      storedToken.identifier !== identifier ||
      storedToken.expires <= new Date()
    ) {
      return false;
    }

    const user = await transaction.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, emailVerified: true },
    });

    if (!user) return false;

    await transaction.user.update({
      where: { id: user.id },
      data: { emailVerified: user.emailVerified || new Date() },
    });
    await transaction.verificationToken.deleteMany({ where: { identifier } });
    return true;
  });
}
