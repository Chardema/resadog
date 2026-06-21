"use client";

import Link from "next/link";
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
  const { data: session } = useSession();
  
  const finalUserName = userName || session?.user?.name;
  const userRole = session?.user?.role;
  const isAuthenticated = Boolean(finalUserName || session?.user?.id);

  const navLinks = [
    { href: "/dashboard", label: "Accueil", icon: Home },
    { href: "/booking", label: "Réserver", icon: CalendarPlus },
    { href: "/pets", label: "Animaux", icon: PawPrint },
    { href: "/profile", label: "Profil", icon: UserRound },
  ];

  if (userRole === "ADMIN" || userRole === "SITTER") {
    navLinks.push({ href: "/admin/dashboard", label: "Admin", icon: Shield });
  }

  if (!isAuthenticated) {
    return (
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        className="fixed left-2 right-2 top-2 z-50 sm:left-4 sm:right-4 sm:top-4"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/95 px-2 py-2 shadow-lg shadow-orange-900/5 backdrop-blur-xl sm:rounded-full sm:px-3">
          <Link href="/" className="flex items-center gap-2 group min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white shadow-sm sm:rounded-full">
              <PawPrint className="h-5 w-5" />
            </div>
            <span className="hidden truncate font-bold text-gray-900 min-[350px]:inline">
              <span className="sm:hidden">La Patte</span>
              <span className="hidden sm:inline">La Patte Dorée</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 text-sm font-semibold">
            <Link
              href="/concept"
              className="px-4 py-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-white/70 transition-colors"
            >
              Concept
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
              <span className="sm:hidden">Créer</span>
              <span className="hidden sm:inline">S’inscrire</span>
            </Link>
          </div>
        </div>
      </motion.header>
    );
  }

  return (
    <>
      {/* --- DESKTOP NAV (Floating Top) --- */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="hidden md:flex fixed top-6 left-0 right-0 z-50 justify-center px-4 pointer-events-none"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-lg shadow-orange-900/5 rounded-full px-2 py-2 flex items-center gap-4 pointer-events-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 px-2 group">
            <div className="bg-gradient-to-br from-orange-400 to-amber-600 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-md group-hover:rotate-12 transition-transform">
              🐾
            </div>
            <span className="font-bold text-gray-800 tracking-tight">La Patte Dorée</span>
          </Link>

          {/* Links */}
          <div className="flex items-center bg-gray-100/50 rounded-full p-1">
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
          </div>

          {/* User */}
          <div className="flex items-center gap-3 pl-2 pr-2">
            <div className="text-xs font-medium text-gray-500 text-right leading-tight">
              <div>Bonjour</div>
              <div className="text-gray-900 font-bold truncate max-w-[100px]">{finalUserName?.split(' ')[0]}</div>
            </div>
            <div className="h-9 w-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold border-2 border-white shadow-sm">
              {finalUserName?.charAt(0).toUpperCase()}
            </div>
            <SignOutButton />
          </div>
        </div>
      </motion.div>

      {/* --- MOBILE NAV (Fixed Bottom) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
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
