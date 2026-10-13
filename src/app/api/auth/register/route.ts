import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { distributedRateLimit } from "@/lib/rate-limit";
import { issueEmailVerification } from "@/lib/auth/email-verification";
import { getClientIp, normalizeEmail, passwordSchema } from "@/lib/auth/password";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(80),
  email: z.string().email("Email invalide"),
  password: passwordSchema,
  phone: z.string().trim().max(30).optional(),
});

export async function POST(request: Request) {
  try {
    // Rate limiting : 5 inscriptions par IP par heure
    const ip = getClientIp(request);
    const { success } = await distributedRateLimit(`register:${ip}`, { maxRequests: 5, windowSeconds: 3600 });
    if (!success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validation des données
    const validatedData = registerSchema.parse(body);

    const normalizedEmail = normalizeEmail(validatedData.email);

    // PostgreSQL compare les chaînes avec leur casse par défaut. Cette recherche
    // empêche donc la création de deux comptes pour le même email.
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Impossible de créer le compte. Vérifiez vos informations." },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: normalizedEmail,
        passwordHash,
        phone: validatedData.phone,
        role: "CLIENT", // Par défaut, les nouveaux utilisateurs sont des clients
      },
    });

    let verificationEmailSent = true;
    try {
      await issueEmailVerification({
        userId: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      verificationEmailSent = false;
      console.error("Compte créé, mais email de vérification non envoyé:", error);
    }

    // Retourner les données de l'utilisateur (sans le mot de passe)
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: verificationEmailSent
        ? "Compte créé. Consultez votre boîte mail pour l'activer."
        : "Compte créé. L'email n'a pas pu être envoyé ; utilisez le bouton de renvoi.",
      verificationRequired: true,
      verificationEmailSent,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Erreur lors de l'inscription:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la création du compte" },
      { status: 500 }
    );
  }
}
