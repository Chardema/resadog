"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isLocale, type Locale, translateFrenchText } from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "la-patte-doree-language";
const COOKIE_NAME = "site-locale";
const ignoredParents = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE"]);

type TextSnapshot = { source: string; rendered: string };
type AttributeSnapshot = Record<string, TextSnapshot>;

function preferredBrowserLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const browserLocale = window.navigator.language.toLowerCase().split("-")[0];
  return isLocale(browserLocale) ? browserLocale : "fr";
}

export function LanguageProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const textSnapshots = useRef(new WeakMap<Text, TextSnapshot>());
  const attributeSnapshots = useRef(new WeakMap<Element, AttributeSnapshot>());
  const titleSnapshot = useRef<TextSnapshot | null>(null);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    document.cookie = `${COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    updateLocale(nextLocale);
  }, []);

  useLayoutEffect(() => {
    const preferred = preferredBrowserLocale();
    if (preferred !== locale) updateLocale(preferred);
    // Only detect once. Subsequent language changes are user initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;

    const translateTextNode = (node: Text) => {
      if (!node.parentElement || ignoredParents.has(node.parentElement.tagName) || node.parentElement.closest("[data-no-translate]")) return;
      const current = node.nodeValue ?? "";
      let snapshot = textSnapshots.current.get(node);
      if (!snapshot || current !== snapshot.rendered) snapshot = { source: current, rendered: current };
      const rendered = translateFrenchText(snapshot.source, locale);
      snapshot.rendered = rendered;
      textSnapshots.current.set(node, snapshot);
      if (current !== rendered) node.nodeValue = rendered;
    };

    const translateAttributes = (element: Element) => {
      if (element.closest("[data-no-translate]")) return;
      const attributes = ["placeholder", "aria-label", "title", "alt"];
      const snapshots = attributeSnapshots.current.get(element) ?? {};
      for (const name of attributes) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        let snapshot = snapshots[name];
        if (!snapshot || current !== snapshot.rendered) snapshot = { source: current, rendered: current };
        const rendered = translateFrenchText(snapshot.source, locale);
        snapshot.rendered = rendered;
        snapshots[name] = snapshot;
        if (current !== rendered) element.setAttribute(name, rendered);
      }
      attributeSnapshots.current.set(element, snapshots);
    };

    const translateTree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
      if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
        else translateAttributes(node as Element);
        node = walker.nextNode();
      }
    };

    const translateTitle = () => {
      const currentTitle = document.title;
      if (!titleSnapshot.current || currentTitle !== titleSnapshot.current.rendered) {
        titleSnapshot.current = { source: currentTitle, rendered: currentTitle };
      }
      const translatedTitle = translateFrenchText(titleSnapshot.current.source, locale);
      titleSnapshot.current.rendered = translatedTitle;
      if (document.title !== translatedTitle) document.title = translatedTitle;
    };

    translateTree(document.body);
    translateTitle();

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateTree(mutation.target);
        else if (mutation.type === "attributes") translateAttributes(mutation.target as Element);
        else mutation.addedNodes.forEach(translateTree);
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title", "alt"] });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title", "alt"] });
    const headObserver = new MutationObserver(() => {
      headObserver.disconnect();
      translateTitle();
      headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    });
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      headObserver.disconnect();
    };
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (text) => translateFrenchText(text, locale),
  }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
