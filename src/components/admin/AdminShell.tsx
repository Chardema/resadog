"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { adminMenuItems } from "./navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";


export function AdminShell({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  const visibleMenuItems = adminMenuItems.filter((item) => !item.adminOnly || role === "ADMIN");
  const mobileBarItems = visibleMenuItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 pt-28">
      <aside className="admin-desktop-sidebar fixed bottom-0 left-0 top-28 z-40 hidden w-72 flex-col md:flex border-r border-gray-200 bg-white transition-transform">
        <p className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">Espace administration</p>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation administration">
          {visibleMenuItems.map((item) => {
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

      <main className="admin-shell-main min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8">
          {children}
        </div>
      </main>

      <nav aria-label="Raccourcis administration" className="admin-mobile-only fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
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

    </div>
  );
}
