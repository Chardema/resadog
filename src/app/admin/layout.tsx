"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarCheck,
  CalendarCog,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  PawPrint,
  TicketPercent,
  UsersRound,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Réservations", icon: CalendarCheck },
  { href: "/admin/calendar", label: "Calendrier", icon: CalendarCog },
  { href: "/admin/clients", label: "Clients", icon: UsersRound },
  { href: "/admin/coupons", label: "Codes promo", icon: TicketPercent },
  { href: "/admin/reviews", label: "Avis", icon: MessageSquareText },
  { href: "/admin/revenue", label: "Finance", icon: CreditCard },
  { href: "/admin/calendar-sync", label: "Synchronisation", icon: BarChart3 },
];

const mobileBarItems = menuItems.slice(0, 5);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-gray-200 bg-white md:flex md:flex-col">
        <div className="border-b border-gray-100 p-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-600 text-white shadow-sm">
              <PawPrint className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-gray-950">La Patte Dorée</span>
              <span className="block truncate text-xs font-semibold text-gray-500">Espace administration</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation administration">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                  isActive
                    ? "bg-gray-950 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mode équipe</p>
            <p className="mt-1 text-sm font-bold text-gray-950">Gestion quotidienne</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white">
              <PawPrint className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="truncate font-bold text-gray-950">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-bold text-gray-800"
          >
            Menu
          </button>
        </div>
      </header>

      <main className="min-h-screen pb-24 md:ml-72 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
        <div className="flex items-stretch justify-around">
          {mobileBarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors active:bg-gray-100",
                  isActive ? "text-orange-700" : "text-gray-500"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                {isActive && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-orange-600" />}
              </Link>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-50 w-[86vw] max-w-sm bg-white shadow-xl md:hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <div>
                  <p className="text-sm font-bold text-gray-950">Administration</p>
                  <p className="text-xs text-gray-500">La Patte Dorée</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md border border-gray-300 p-2 text-gray-700"
                  aria-label="Fermer le menu"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <nav className="space-y-1 p-3" aria-label="Menu administration mobile">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                        isActive ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="absolute inset-x-0 bottom-0 border-t border-gray-100 p-4">
                <SignOutButton />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
