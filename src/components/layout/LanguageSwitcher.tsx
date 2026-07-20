"use client";

import { Languages } from "lucide-react";
import { localeNames, supportedLocales, type Locale } from "@/lib/i18n";
import { useLanguage } from "@/components/providers/LanguageProvider";

const shortLabels: Record<Locale, string> = { fr: "FR", en: "EN", es: "ES" };

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      data-no-translate
      className="fixed bottom-20 left-4 z-[55] flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 p-1.5 shadow-xl shadow-gray-900/10 backdrop-blur-xl md:bottom-6 md:left-6"
      aria-label="Language / Langue / Idioma"
    >
      <Languages className="ml-1 mr-0.5 h-4 w-4 text-orange-600" aria-hidden="true" />
      {supportedLocales.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          aria-label={localeNames[item]}
          aria-pressed={locale === item}
          title={localeNames[item]}
          className={`min-h-9 rounded-full px-2.5 text-xs font-extrabold transition-colors sm:px-3 ${
            locale === item
              ? "bg-gray-950 text-white shadow-sm"
              : "text-gray-600 hover:bg-orange-50 hover:text-orange-700"
          }`}
        >
          {shortLabels[item]}
        </button>
      ))}
    </div>
  );
}
