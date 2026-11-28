import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password";

// Schéma de validation de POST /api/auth/register. Le téléphone reste libre
// (numéros internationaux acceptés) : seulement trim et 30 caractères maximum.
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(80),
  email: z.string().email("Email invalide"),
  password: passwordSchema,
  phone: z.string().trim().max(30).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
