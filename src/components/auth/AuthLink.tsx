"use client";

import { useEffect, useRef, type ComponentProps, type MouseEvent } from "react";
import Link from "next/link";

const HARD_NAVIGATION_FALLBACK_MS = 1500;

type AuthLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/**
 * <Link> vers les pages d'authentification avec filet de sécurité : si la
 * navigation client n'a pas abouti après ~1,5 s (routeur bloqué, DOM modifié
 * par la traduction automatique du navigateur…), on bascule sur une
 * navigation classique. Le brouillon /booking vit en sessionStorage et
 * survit donc au rechargement.
 */
export default function AuthLink({ href, onClick, ...props }: AuthLinkProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const startPathname = window.location.pathname;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (window.location.pathname === startPathname) {
        window.location.assign(href);
      }
    }, HARD_NAVIGATION_FALLBACK_MS);
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
