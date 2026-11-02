import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Créer mon compte",
  description: "Créez votre compte La Patte Dorée.",
  path: "/auth/signup",
  noIndex: true,
});

export default function AuthSignupLayout({ children }: { children: ReactNode }) {
  return children;
}
