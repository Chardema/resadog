import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#FDFbf7] pt-12">
      {children}
    </div>
  );
}
