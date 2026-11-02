import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Connexion interrompue",
  description: "Erreur de connexion à votre compte La Patte Dorée.",
  path: "/auth/error",
  noIndex: true,
});

export default function AuthErrorLayout({ children }: { children: ReactNode }) {
  return children;
}
