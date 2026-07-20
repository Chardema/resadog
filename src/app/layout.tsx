import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@uploadthing/react/styles.css";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { BetaBanner } from "@/components/layout/BetaBanner";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { coreKeywords, getLocalBusinessJsonLd, getSiteUrl, SITE_NAME } from "@/lib/seo";
import { cookies } from "next/headers";
import { isLocale } from "@/lib/i18n";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: "La Patte Dorée | Pet-sitter près de Disneyland Paris",
    template: "%s | La Patte Dorée",
  },
  description:
    "La Patte Dorée garde vos chiens et chats près de Disneyland Paris, Val d'Europe et en Seine-et-Marne 77 : hébergement familial, visites, promenades et garderie.",
  keywords: coreKeywords,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "La Patte Dorée | Pet-sitter près de Disneyland Paris",
    description:
      "Un accueil familial et attentionné pour vos compagnons près de Disneyland Paris : hébergement sans box, visites à domicile et promenades.",
    url: "/",
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/logo-mark.png",
        width: 512,
        height: 512,
        alt: "Emblème La Patte Dorée",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "La Patte Dorée | Pet-sitter près de Disneyland Paris",
    description:
      "Hébergement familial, visites et promenades près de Disneyland Paris, avec réservation en ligne.",
    images: ["/logo-mark.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieLocale = (await cookies()).get("site-locale")?.value;
  const initialLocale = isLocale(cookieLocale) ? cookieLocale : "fr";

  return (
    <html lang={initialLocale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <GoogleAnalytics />
      </head>
      <body
        className="antialiased flex flex-col min-h-screen"
      >
        <JsonLd data={getLocalBusinessJsonLd()} />
        <LanguageProvider initialLocale={initialLocale}>
          <SessionProvider>
            <div className="flex-1">
              {children}
            </div>
            <BetaBanner />
            <CookieConsent />
            <Footer />
            <LanguageSwitcher />
          </SessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
