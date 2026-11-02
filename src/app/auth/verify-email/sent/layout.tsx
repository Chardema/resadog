import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Vérifiez votre boîte mail",
  description: "Vérification de l'adresse e-mail de votre compte La Patte Dorée.",
  path: "/auth/verify-email/sent",
  noIndex: true,
});

export default function AuthVerifyEmailSentLayout({ children }: { children: ReactNode }) {
  return children;
}
