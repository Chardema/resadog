"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";
import { CalendarPlus, Home, PawPrint, Shield, UserRound } from "lucide-react";

interface AppNavProps {
  userName?: string | null;
}

export function AppNav({ userName }: AppNavProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  
  const finalUserName = userName || session?.user?.name;
  const userRole = session?.user?.role;
  const hasSessionUser = Boolean(finalUserName || session?.user?.id);
  const isAuthenticated = hasSessionUser || status === "authenticated";
  const canAccessAdmin = userRole === "ADMIN" || userRole === "SITTER";

  const navLinks = [
    { href: "/dashboard", label: "Accueil", icon: Home },
    { href: "/booking", label: "Réserver", icon: CalendarPlus },
    { href: "/pets", label: "Animaux", icon: PawPrint },
    { href: "/profile", label: "Profil", icon: UserRound },
  ];

  if (canAccessAdmin) {
    navLinks.push({ href: "/admin/dashboard", label: "Admin", icon: Shield });
  }

  if (!isAuthenticated) {
    return (
      <motion.header
        initial={false}
        animate={{ y: 0 }}
        data-app-nav="true"
        className="fixed left-2 right-2 top-2 z-50 sm:left-4 sm:right-4 sm:top-4"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/95 px-2 py-2 shadow-lg shadow-orange-900/5 backdrop-blur-xl sm:rounded-full sm:px-3">
          <Link href="/" className="flex items-center gap-2 group min-w-0">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-orange-100 bg-[#FDFBF7] shadow-sm sm:rounded-full">
              <Image
                src="/logo-mark.png"
                width={36}
                height={36}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
              <span className="hidden truncate font-bold text-gray-900 min-[350px]:inline">
              <span className="app-nav-public-short">La Patte</span>
              <span className="app-nav-public-full">La Patte Dorée</span>
            </span>
          </Link>

          <nav className="app-nav-public-menu items-center gap-1 text-sm font-semibold">
            <Link
              href="/concept"
              className="px-4 py-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-white/70 transition-colors"
            >
              Concept
            </Link>
            <Link
              href="/garde-chien-disneyland-paris"
              className="px-4 py-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-white/70 transition-colors"
            >
              Services
            </Link>
            <Link
              href="/subscriptions"
              className="px-4 py-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-white/70 transition-colors"
            >
              Tarifs
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/auth/signin"
              className="px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 sm:rounded-full sm:px-4"
            >
              Connexion
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-md bg-gray-950 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600 sm:rounded-full sm:px-4"
            >
              <span className="app-nav-public-short">Créer</span>
              <span className="app-nav-public-full">S’inscrire</span>
            </Link>
          </div>
        </div>
      </motion.header>
    );
  }

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: 0 }}
        data-app-nav="true"
        className="fixed left-2 right-2 top-2 z-50 pointer-events-none md:left-0 md:right-0 md:top-6 md:flex md:justify-center md:px-4"
      >
        <div className="pointer-events-auto mx-auto flex w-full max-w-5xl items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/95 px-2 py-2 shadow-lg shadow-orange-900/5 backdrop-blur-xl md:w-auto md:rounded-full md:border-white/50 md:bg-white/80 md:px-2">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 px-0 md:px-2 group">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-orange-100 bg-[#FDFBF7] shadow-sm transition-transform group-hover:rotate-6 md:rounded-full">
              <Image
                src="/logo-mark.png"
                width={36}
                height={36}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <span className="truncate font-bold tracking-tight text-gray-900 md:text-gray-800">La Patte Dorée</span>
          </Link>

          <nav aria-label="Navigation principale" className="app-nav-desktop-only items-center rounded-full bg-gray-100/50 p-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                    isActive
                      ? "text-orange-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill-desktop"
                      className="absolute inset-0 bg-white rounded-full shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="app-nav-desktop-only items-center gap-3 pl-2 pr-2">
            <div className="text-right text-xs font-medium leading-tight text-gray-500">
              <div>Bonjour</div>
              <div className="max-w-[100px] truncate font-bold text-gray-900">{finalUserName?.split(' ')[0]}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-orange-100 font-bold text-orange-600 shadow-sm">
              {finalUserName?.charAt(0).toUpperCase()}
            </div>
            <SignOutButton />
          </div>

          <div className="app-nav-mobile-actions shrink-0 items-center gap-2">
            {canAccessAdmin && (
              <Link
                href="/admin/dashboard"
                aria-label="Espace admin"
                className={cn(
                  "inline-flex min-h-9 items-center justify-center gap-1 rounded-md border px-2 text-sm font-bold",
                  pathname.startsWith("/admin")
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:text-orange-700"
                )}
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span className="hidden min-[420px]:inline">Admin</span>
              </Link>
            )}
            <Link
              href="/booking"
              className="inline-flex min-h-9 items-center justify-center rounded-md bg-gray-950 px-3 text-sm font-bold text-white hover:bg-orange-600"
            >
              Réserver
            </Link>
            <Link
              href="/profile"
              aria-label="Profil"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 font-bold text-orange-700"
            >
              {finalUserName?.charAt(0).toUpperCase() || <UserRound className="h-4 w-4" />}
            </Link>
          </div>
        </div>
      </motion.header>
      <div className="app-nav-mobile-spacer h-20" aria-hidden="true" />

      {/* --- MOBILE NAV (Fixed Bottom) --- */}
      <div className="app-nav-mobile-bottom fixed bottom-0 left-0 right-0 z-50">
        <nav aria-label="Navigation principale" className="border-t border-gray-200 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <div className="flex items-stretch justify-around">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors active:bg-gray-100",
                    isActive ? "text-orange-700" : "text-gray-500"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className={cn("text-[10px] font-semibold leading-none", isActive && "font-bold")}>
                    {link.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-pill-mobile"
                      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-orange-600"
                    />
                  )}
                </Link>
              );
            })}
            
            {/* Mobile User/Menu trigger could go here if needed, but Profile tab covers it */}
          </div>
        </nav>
      </div>
    </>
  );
}
