"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setIsVisible(true);
    }
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
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🍪</div>
              <div>
                <h3 className="font-bold text-gray-900">Des cookies ? Oui, mais juste pour le site !</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Nous utilisons des cookies essentiels pour votre connexion et vos paiements sécurisés via Stripe. Pas de pub, promis.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Button onClick={accept} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl">
                Accepter
              </Button>
              <Link href="/legal/cookies" className="flex-1">
                <Button variant="outline" className="w-full rounded-xl">En savoir plus</Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
