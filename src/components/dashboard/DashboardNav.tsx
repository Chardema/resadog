"use client";

import Link from "next/link";
import { UserMenu } from "@/components/layout/UserMenu";
import { motion } from "framer-motion";

export function DashboardNav() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-r from-white to-orange-50 border-b border-orange-200 shadow-lg"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold text-xl shadow-lg transform rotate-12">
                🐾
              </div>
              <div className="absolute -top-1 -right-1 text-yellow-400 text-sm animate-pulse">
                ✨
              </div>
            </motion.div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                La Patte Dorée
              </span>
            </div>
          </Link>
          <UserMenu />
        </div>
      </div>
    </motion.nav>
  );
}
