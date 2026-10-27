import { z } from "zod";

const COMMON_PASSWORDS = new Set([
  "azertyuiop123",
  "motdepasse123",
  "password1234",
  "123456789012",
  "qwertyuiop123",
  "lapattedoree",
]);

export const passwordSchema = z
  .string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères")
  .max(128, "Le mot de passe est trop long")
  .refine((password) => /[a-z]/.test(password), "Ajoutez une lettre minuscule")
  .refine((password) => /[A-Z]/.test(password), "Ajoutez une lettre majuscule")
  .refine((password) => /\d/.test(password), "Ajoutez un chiffre")
  .refine(
    (password) => !COMMON_PASSWORDS.has(password.toLowerCase()),
    "Choisissez un mot de passe moins courant"
  );

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
