import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Connexion",
  description: "Connectez-vous à votre espace La Patte Dorée.",
  path: "/auth/signin",
  noIndex: true,
});

export default function AuthSigninLayout({ children }: { children: ReactNode }) {
  return children;
}
