import type { Metadata } from "next";
import { AppNav } from "@/components/layout/AppNav";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
