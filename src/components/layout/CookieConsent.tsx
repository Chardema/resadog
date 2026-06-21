"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(!localStorage.getItem("cookie-consent"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "true");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[60] md:bottom-4 md:left-auto md:right-4 md:max-w-md"
        >
          <div className="flex flex-col gap-3 border border-gray-200 bg-white p-4 shadow-2xl md:rounded-lg md:p-5">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" aria-hidden="true" />
              <div>
                <h3 className="font-bold text-gray-900">Cookies essentiels</h3>
                <p className="mt-1 text-sm leading-5 text-gray-600">
                  Nécessaires pour la connexion et les paiements Stripe. Aucun cookie publicitaire.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={accept} className="h-11 bg-gray-950 text-white hover:bg-gray-800">
                Accepter
              </Button>
              <Link href="/legal/cookies">
                <Button variant="outline" className="h-11 w-full border-gray-300">En savoir plus</Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
