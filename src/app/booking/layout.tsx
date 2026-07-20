import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Réserver une garde",
  description: "Réservez une prestation de garde personnalisée pour votre chien ou votre chat.",
  path: "/booking",
  noIndex: true,
});

export default function BookingLayout({ children }: { children: ReactNode }) {
  return children;
}
