import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { BetaBanner } from "@/components/layout/BetaBanner";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { AppNav } from "@/components/layout/AppNav";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { coreKeywords, getLocalBusinessJsonLd, getSiteUrl, SITE_NAME } from "@/lib/seo";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { isLocale } from "@/lib/i18n";
import { isGoogleConsentRequiredRegion } from "@/lib/google-consent";
import {
  GOOGLE_ANALYTICS_ID,
  GOOGLE_CONSENT_BOOTSTRAP,
  GOOGLE_TAG_CONFIGURATION,
} from "@/lib/google-analytics";
import { TwoFactorGuard } from "@/components/auth/TwoFactorGuard";

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
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "La Patte Dorée — Garde familiale de chiens et chats près de Disneyland Paris",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "La Patte Dorée | Pet-sitter près de Disneyland Paris",
    description:
      "Hébergement familial, visites et promenades près de Disneyland Paris, avec réservation en ligne.",
    images: ["/opengraph-image"],
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
  const countryCode = (await headers()).get("x-vercel-ip-country");
  const promptForGoogleConsent = isGoogleConsentRequiredRegion(countryCode);

  return (
    <html lang={initialLocale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body
        className="antialiased flex flex-col min-h-screen"
      >
        <JsonLd data={getLocalBusinessJsonLd()} />
        <LanguageProvider initialLocale={initialLocale}>
          <SessionProvider>
            <TwoFactorGuard />
            <AppNav />
            <div className="flex-1">
              {children}
            </div>
            <BetaBanner />
            <CookieConsent promptOnFirstVisit={promptForGoogleConsent} />
            <Footer />
            <LanguageSwitcher />
          </SessionProvider>
        </LanguageProvider>
        <Script
          id="google-consent-default"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: GOOGLE_CONSENT_BOOTSTRAP }}
        />
        <Script
          id="google-tag-manager"
          strategy="beforeInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
        />
        <Script
          id="google-tag-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: GOOGLE_TAG_CONFIGURATION }}
        />
      </body>
    </html>
  );
}
