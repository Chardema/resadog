import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Helper pour protéger une page
 * Utiliser dans les Server Components: const session = await requireAuth();
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return session;
}
