"use client";

import { useEffect } from "react";
import Link, { type LinkProps } from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Locale } from "@/lib/i18n";

export function LocaleSync({ locale }: { locale: Locale }) {
  const { locale: currentLocale, setLocale } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = locale;
    if (currentLocale !== locale) {
      setLocale(locale);
    }
  }, [currentLocale, locale, setLocale]);

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
        setLocale(locale);
        document.documentElement.lang = locale;
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
