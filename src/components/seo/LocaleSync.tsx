"use client";

import { useEffect } from "react";
import Link, { type LinkProps } from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Locale } from "@/lib/i18n";

const STORAGE_KEY = "la-patte-doree-language";

export function LocaleSync({ locale }: { locale: Locale }) {
  const { locale: currentLocale } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = currentLocale;
    };
  }, [currentLocale, locale]);

  return null;
}

type LocaleBookingLinkProps = LinkProps & {
  locale: Locale;
  className?: string;
  children: React.ReactNode;
};

export function LocaleBookingLink({
  locale,
  onClick,
  children,
  ...props
}: LocaleBookingLinkProps) {
  const { setLocale } = useLanguage();

  return (
    <Link
      {...props}
      onClick={(e) => {
        const storedLocale =
          typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (locale === "fr" || storedLocale !== "fr") {
          setLocale(locale);
          document.documentElement.lang = locale;
        }
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
