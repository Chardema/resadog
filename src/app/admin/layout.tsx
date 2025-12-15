"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { href: "/admin/dashboard", label: "Vue d'ensemble", icon: "📊" },
    { href: "/admin/bookings", label: "Réservations", icon: "📅" },
    { href: "/admin/coupons", label: "Codes Promo", icon: "🎟️" },
    { href: "/admin/calendar", label: "Calendrier", icon: "📆" },
    { href: "/admin/clients", label: "Clients", icon: "👥" },
    { href: "/admin/revenue", label: "Finance", icon: "💰" },
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

        <div className="mt-auto p-8 border-t border-gray-50">
          <div className="flex items-center gap-3 mb-4">
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
      <main className="flex-1 md:ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
