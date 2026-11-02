import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Nouveau mot de passe",
  description: "Choisissez un nouveau mot de passe pour votre compte La Patte Dorée.",
  path: "/auth/reset-password",
  noIndex: true,
});

export default function AuthResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
