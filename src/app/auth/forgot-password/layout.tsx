import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Mot de passe oublié",
  description: "Réinitialisez le mot de passe de votre compte La Patte Dorée.",
  path: "/auth/forgot-password",
  noIndex: true,
});

export default function AuthForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
