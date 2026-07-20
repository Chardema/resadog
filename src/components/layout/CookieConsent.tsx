"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import {
  GOOGLE_CONSENT_EVENT,
  GOOGLE_CONSENT_STORAGE_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  type GoogleConsentChoice,
} from "@/lib/google-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(!localStorage.getItem(GOOGLE_CONSENT_STORAGE_KEY));
    }, 0);
    const openSettings = () => setIsVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    };
  }, []);

  const saveChoice = (choice: GoogleConsentChoice) => {
    localStorage.setItem(GOOGLE_CONSENT_STORAGE_KEY, choice);
    const granted = choice === "accepted" ? "granted" : "denied";
    window.gtag?.("consent", "update", {
      analytics_storage: granted,
      ad_storage: granted,
      ad_user_data: granted,
      ad_personalization: granted,
    });
    window.dispatchEvent(new CustomEvent(GOOGLE_CONSENT_EVENT, { detail: choice }));
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
                <h3 className="font-bold text-gray-900">Vos préférences de cookies</h3>
                <p className="mt-1 text-sm leading-5 text-gray-600">
                  Les cookies essentiels assurent la connexion et les paiements. Avec votre accord,
                  Google Analytics nous aide à mesurer les visites et l’efficacité de nos annonces.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => saveChoice("accepted")} className="h-11 bg-gray-950 text-white hover:bg-gray-800">
                Tout accepter
              </Button>
              <Button onClick={() => saveChoice("rejected")} variant="outline" className="h-11 border-gray-300">
                Refuser
              </Button>
              <Link href="/legal/cookies" className="col-span-2 text-center text-sm font-medium text-orange-700 underline-offset-4 hover:underline">
                En savoir plus et gérer mes préférences
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
