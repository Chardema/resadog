import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Abonnement Premium",
  description:
    "Premium La Patte Dorée : 10 % de remise sur les réservations, Pattes doublées et priorité sur les créneaux pour 9,99 € par mois.",
  path: "/subscriptions",
});

export default function SubscriptionsLayout({ children }: { children: ReactNode }) {
  return children;
}
