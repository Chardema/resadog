import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Programme fidélité et Premium",
  description:
    "Découvrez le programme de fidélité La Patte Dorée et les avantages Premium pour vos gardes de chiens et chats en Seine-et-Marne.",
  path: "/concept",
});

export default function ConceptLayout({ children }: { children: ReactNode }) {
  return children;
}
