"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { BadgeEuro, CalendarPlus, History, Home, Menu, PawPrint, Shield, UserRound, X, type LucideIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { adminMenuItems } from "@/components/admin/navigation";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon?: LucideIcon };
const publicLinks: NavLink[] = [
  { href: "/#services", label: "Services" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/#avis", label: "Avis" },
  { href: "/#nous-trouver", label: "Contact" },
];
const clientLinks: NavLink[] = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/booking", label: "Réserver", icon: CalendarPlus },
  { href: "/tarifs", label: "Tarifs", icon: BadgeEuro },
  { href: "/pets", label: "Animaux", icon: PawPrint },
  { href: "/profile", label: "Profil", icon: UserRound },
];
const accountLinks: NavLink[] = [
  ...clientLinks,
  { href: "/history", label: "Historique", icon: History },
  { href: "/subscriptions", label: "Premium" },
];
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const linkClass = "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600";

function NavigationMenu({ pathname, authenticated, canAccessAdmin, isAdmin }: {
  pathname: string; authenticated: boolean; canAccessAdmin: boolean; isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: session } = useSession();
  const links = isAdmin && canAccessAdmin
    ? adminMenuItems.filter((item) => !item.adminOnly || session?.user?.role === "ADMIN")
    : authenticated ? accountLinks : [...publicLinks, { href: "/concept", label: "Concept" }];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("shrink-0", !authenticated && "lg:hidden")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <button ref={triggerRef} type="button" onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open} aria-controls={open ? "site-navigation-menu" : undefined}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-gray-200 text-gray-700 transition-colors hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 sm:rounded-full">
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      {open && (
        <div id="site-navigation-menu" className="absolute inset-x-0 top-full mt-3 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-orange-900/10 sm:left-auto sm:w-80">
          <nav aria-label="Menu principal" className="grid gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-orange-50 hover:text-orange-700", isActive(pathname, href) ? "bg-orange-50 text-orange-700" : "text-gray-700")}>
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {label}
              </Link>
            ))}
            {canAccessAdmin && !isAdmin && (
              <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-orange-700 hover:bg-orange-50">
                <Shield className="h-4 w-4" aria-hidden="true" />Espace admin
              </Link>
            )}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            {authenticated ? <>
              <Link href="/" onClick={() => setOpen(false)} className={cn(linkClass, "text-gray-700")}>Voir le site</Link>
              {isAdmin && <Link href="/dashboard" onClick={() => setOpen(false)} className={cn(linkClass, "text-gray-700")}>Mon espace</Link>}
              <SignOutButton />
            </> : <>
              <Link href="/auth/signin" onClick={() => setOpen(false)} className={cn(linkClass, "text-gray-700")}>Connexion</Link>
              <Link href="/auth/signup" onClick={() => setOpen(false)} className={cn(linkClass, "bg-gray-900 text-white")}>S&apos;inscrire</Link>
            </>}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-600">Langue</span>
            <LanguageSwitcher inline />
          </div>
        </div>
      )}
    </div>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const canAccessAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SITTER";
  const isAdmin = pathname.startsWith("/admin/");
  const isClient = ["/dashboard", "/booking", "/pets", "/profile", "/history", "/subscriptions"].some((href) => isActive(pathname, href));
  const desktopLinks = isAdmin && canAccessAdmin
    ? [{ href: "/", label: "Voir le site" }, { href: "/dashboard", label: "Mon espace" }]
    : authenticated && isClient ? clientLinks.filter((link) => link.href !== "/booking") : publicLinks;
  const action = !authenticated
    ? { href: "/booking", label: "Réserver" }
    : isClient ? { href: "/booking", label: "Réserver" }
    : { href: isAdmin ? "/admin/dashboard" : "/dashboard", label: isAdmin ? "Admin" : "Mon espace" };

  return (
    <>
      <header data-app-nav="true" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:top-6">
        <div className="pointer-events-auto relative flex w-full max-w-5xl items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg shadow-orange-900/5 backdrop-blur-xl sm:gap-3 sm:rounded-full sm:px-6 sm:py-3">
          <Link href="/" aria-label="La Patte Dorée — Accueil" className="group flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-orange-100 bg-[#FDFBF7] shadow-md transition-transform group-hover:rotate-6 sm:rounded-full">
              <Image src="/logo-mark.png" width={40} height={40} alt="" className="h-full w-full object-cover" />
            </div>
            <span className="truncate font-bold tracking-tight text-gray-800">La Patte Dorée</span>
          </Link>
          <nav aria-label="Navigation principale" className="hidden shrink-0 items-center gap-1 lg:flex">
            {desktopLinks.map(({ href, label }) => (
              <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(linkClass, isActive(pathname, href) ? "bg-orange-50 text-orange-700" : "text-gray-600")}>{label}</Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {status === "loading" ? <div className="h-11 w-24 animate-pulse rounded-full bg-gray-100" aria-hidden="true" /> : <>
              {!authenticated && <Link href="/auth/signin" className="hidden min-h-11 items-center text-sm font-semibold text-gray-600 hover:text-orange-700 sm:inline-flex">Connexion</Link>}
              <Link href={action.href} className="inline-flex min-h-11 items-center justify-center rounded-md bg-gray-900 px-3 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-orange-600 hover:shadow-orange-500/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 sm:rounded-full sm:px-5">{action.label}</Link>
            </>}
            <NavigationMenu key={pathname} pathname={pathname} authenticated={authenticated} canAccessAdmin={canAccessAdmin} isAdmin={isAdmin} />
          </div>
        </div>
      </header>
      {authenticated && isClient && !isActive(pathname, "/booking") && (
        <nav aria-label="Raccourcis de votre espace" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden">
          {clientLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn("flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5", isActive(pathname, href) ? "bg-orange-50 text-orange-700" : "text-gray-600")}>
              {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
              <span className="text-[11px] font-semibold">{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
