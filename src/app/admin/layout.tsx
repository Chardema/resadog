"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { href: "/admin/dashboard", label: "Vue d'ensemble", icon: "📊" },
    { href: "/admin/bookings", label: "Réservations", icon: "📅" },
    { href: "/admin/coupons", label: "Codes Promo", icon: "🎟️" },
    { href: "/admin/calendar", label: "Calendrier", icon: "📆" },
    { href: "/admin/clients", label: "Clients", icon: "👥" },
    { href: "/admin/reviews", label: "Avis", icon: "⭐" },
    { href: "/admin/revenue", label: "Finance", icon: "💰" },
  ];

  // Primary items shown in the mobile bottom bar
  const mobileBarItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/admin/bookings", label: "Réservations", icon: "📅" },
    { href: "/admin/clients", label: "Clients", icon: "👥" },
    { href: "/admin/reviews", label: "Avis", icon: "⭐" },
    { href: "/admin/calendar", label: "Calendrier", icon: "📆" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFbf7] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col fixed inset-y-0 z-50">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
              ⚡
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Admin</span>
          </Link>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative group",
                    isActive
                      ? "text-orange-700 bg-orange-50"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute left-0 w-1 h-6 bg-orange-500 rounded-r-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-gray-50 space-y-3">
          <Link
            href="/admin/calendar-sync"
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all"
          >
            <span className="text-base">📅</span>
            Sync Calendrier Apple
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
              A
            </div>
            <div className="text-xs">
              <p className="font-bold text-gray-900">Administrateur</p>
              <p className="text-gray-400">Master Access</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 pb-24 md:p-8 md:pb-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-50 safe-bottom">
        <div className="flex items-center justify-around px-1 py-2">
          {mobileBarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition-colors min-w-0",
                  isActive
                    ? "text-orange-600"
                    : "text-gray-400 active:text-gray-600"
                )}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-active"
                    className="w-4 h-0.5 bg-orange-500 rounded-full mt-0.5"
                  />
                )}
              </Link>
            );
          })}
          {/* More menu toggle */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition-colors",
              mobileMenuOpen ? "text-orange-600" : "text-gray-400 active:text-gray-600"
            )}
          >
            <span className="text-lg leading-none">☰</span>
            <span>Plus</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/30 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[70vh] overflow-y-auto pb-safe"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="p-4 space-y-1">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive
                          ? "text-orange-700 bg-orange-50"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      <span className="text-xl">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  href="/admin/calendar-sync"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    pathname === "/admin/calendar-sync"
                      ? "text-orange-700 bg-orange-50"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <span className="text-xl">📅</span>
                  Sync Calendrier Apple
                </Link>
                <div className="pt-3 border-t border-gray-100 mt-3">
                  <SignOutButton />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
