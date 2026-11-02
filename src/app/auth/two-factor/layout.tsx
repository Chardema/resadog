import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Confirmez votre identité",
  description: "Vérification en deux étapes de votre compte La Patte Dorée.",
  path: "/auth/two-factor",
  noIndex: true,
});

export default function AuthTwoFactorLayout({ children }: { children: ReactNode }) {
  return children;
}
