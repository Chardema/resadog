import type { NextRequest } from "next/server";

const supportedStripeLocales = new Set(["fr", "en", "es"]);

export function getStripeCheckoutLocale(request: NextRequest): "fr" | "en" | "es" | "auto" {
  const locale = request.cookies.get("site-locale")?.value;
  return locale && supportedStripeLocales.has(locale)
    ? (locale as "fr" | "en" | "es")
    : "auto";
}

export function getStripeReturnBaseUrl(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") || "https";
  const requestOrigin = forwardedHost
    ? `${forwardedProtocol}://${forwardedHost}`
    : request.nextUrl.origin;

  const configuredOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => origin.replace(/\/$/, ""));

  return configuredOrigins.includes(requestOrigin)
    ? requestOrigin
    : configuredOrigins[0] || requestOrigin;
}
