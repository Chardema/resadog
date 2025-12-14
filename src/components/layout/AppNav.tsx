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

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/booking", label: "Réserver", icon: "📅" },
    { href: "/pets", label: "Mes Animaux", icon: "🐕" },
    { href: "/profile", label: "Profil", icon: "👤" },
  ];

  if (userRole === "ADMIN" || userRole === "SITTER") {
    navLinks.push({ href: "/admin/dashboard", label: "Admin", icon: "⚡" });
  }

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-lg shadow-orange-900/5 rounded-full px-2 py-2 flex items-center gap-2 pointer-events-auto">
        {/* Logo Home */}
        <Link href="/" className="flex items-center gap-2 px-4 py-2 hover:bg-white/50 rounded-full transition-colors group">
          <div className="bg-gradient-to-br from-orange-400 to-amber-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md group-hover:rotate-12 transition-transform">
            🐾
          </div>
          <span className="font-bold text-gray-800 tracking-tight hidden md:block">La Patte Dorée</span>
        </Link>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block" />

        {/* Links */}
        <div className="flex items-center bg-gray-100/50 rounded-full p-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                  isActive
                    ? "text-orange-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 text-lg">{link.icon}</span>
                <span className="relative z-10 hidden sm:block">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User & Logout */}
        <div className="flex items-center gap-2 pl-2">
          <div className="hidden lg:block text-xs font-medium text-gray-500 text-right leading-tight">
            <div>Bonjour</div>
            <div className="text-gray-900 font-bold truncate max-w-[100px]">{finalUserName?.split(' ')[0]}</div>
          </div>
          <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs border-2 border-white shadow-sm">
            {finalUserName?.charAt(0).toUpperCase()}
          </div>
          <SignOutButton />
        </div>
      </div>
    </motion.div>
  );
}