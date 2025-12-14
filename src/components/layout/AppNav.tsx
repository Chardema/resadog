"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

interface AppNavProps {
  userName?: string | null;
  showAuth?: boolean;
}

export function AppNav({ userName, showAuth = true }: AppNavProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/pets", label: "Mes animaux" },
    { href: "/booking", label: "Réservations" },
    { href: "/profile", label: "Mon profil" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
              R
            </div>
            <span className="text-2xl font-bold text-gray-900">ResaDog</span>
          </Link>

          {/* Navigation Links */}
          {showAuth && userName && (
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-blue-600",
                    pathname === link.href
                      ? "text-blue-600"
                      : "text-gray-600"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* User Section */}
          {showAuth && userName ? (
            <div className="flex items-center gap-4">
              <Link
                href="/profile"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Bonjour, <span className="font-semibold">{userName}</span>
              </Link>
              <SignOutButton />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Connexion
              </Link>
              <Link
                href="/auth/signup"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Inscription
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
