"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

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
    { href: "/dashboard", label: "Accueil", icon: "🏠" },
    { href: "/booking", label: "Réserver", icon: "📅" },
    { href: "/pets", label: "Animaux", icon: "🐾" },
    { href: "/profile", label: "Profil", icon: "👤" },
  ];

  if (userRole === "ADMIN" || userRole === "SITTER") {
    navLinks.push({ href: "/admin/dashboard", label: "Admin", icon: "⚡" });
  }

  if (!isAuthenticated) {
    return (
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        className="fixed top-4 left-4 right-4 z-50"
      >
        <div className="mx-auto max-w-5xl bg-white/85 backdrop-blur-xl border border-white/60 shadow-lg shadow-orange-900/5 rounded-full px-3 py-2 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 group min-w-0">
            <div className="bg-gradient-to-br from-orange-400 to-amber-600 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-md group-hover:rotate-12 transition-transform">
              🐾
            </div>
            <span className="font-bold text-gray-800 tracking-tight truncate">
              La Patte Dorée
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

          <div className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="px-3 sm:px-4 py-2 rounded-full text-sm font-bold text-gray-700 hover:bg-white/70 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/auth/signup"
              className="px-3 sm:px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-orange-600 transition-colors"
            >
              S'inscrire
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
              const isActive = pathname === link.href;
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
                  <span className="relative z-10">{link.icon}</span>
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe-area-inset-bottom">
        <div className="bg-white/90 backdrop-blur-xl border-t border-orange-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-2 pt-1 px-2">
          <div className="flex justify-around items-center">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex flex-col items-center justify-center w-full py-2 rounded-xl transition-all duration-300 active:scale-95",
                    isActive ? "text-orange-600" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <div className={cn("text-2xl mb-0.5 transition-transform", isActive && "-translate-y-1")}>
                    {link.icon}
                  </div>
                  <span className={cn("text-xs font-bold", isActive ? "opacity-100" : "opacity-0 scale-0 h-0 overflow-hidden")}>
                    {link.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-pill-mobile"
                      className="w-1 h-1 bg-orange-500 rounded-full mt-1"
                    />
                  )}
                </Link>
              );
            })}
            
            {/* Mobile User/Menu trigger could go here if needed, but Profile tab covers it */}
          </div>
        </div>
      </div>
    </>
  );
}
