"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/layout/AppNav";

function BookingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Lancer les confettis !
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: ReturnType<typeof setInterval> = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Compte à rebours pour la redirection
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FDFbf7] relative overflow-hidden">
      <AppNav />
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-100/30 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6 pt-28 text-center md:pt-36">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-full max-w-lg rounded-[3rem] border border-green-50 bg-white p-12 shadow-2xl shadow-green-100"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30"
          >
            <span className="text-5xl text-white">✓</span>
          </motion.div>

          <h1 className="mb-4 text-4xl font-extrabold text-gray-900">
            Demande Reçue ! 🎉
          </h1>

          <div className="mb-8 space-y-4 text-gray-600">
            <p className="text-lg font-medium">
              Votre demande de réservation a bien été enregistrée.
            </p>
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm font-medium text-orange-800">
              ⏳ Nous validerons votre demande sous 48h maximum.
            </div>
            <p className="text-sm">
              Tous les détails pratiques et organisationnels pour le séjour de votre compagnon vous seront communiqués <strong>par téléphone</strong>.
            </p>
          </div>

          <div className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-left">
            <p className="mb-1 text-sm text-gray-500">Numéro de réservation</p>
            <p className="font-mono text-lg font-bold tracking-wider text-gray-900">
              #{bookingId?.slice(-8).toUpperCase() || "PENDING"}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600">
              <span>📧</span> Un email récapitulatif vous sera envoyé après validation du paiement.
            </p>
          </div>

          <div className="space-y-4">
            <Link href="/dashboard">
              <Button className="h-14 w-full rounded-xl bg-gray-900 text-lg font-bold text-white shadow-xl transition-all hover:scale-[1.02] hover:bg-green-600">
                Aller à mon Dashboard
              </Button>
            </Link>

            <p className="text-sm text-gray-400">
              Redirection automatique dans {countdown}s...
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-4xl animate-bounce">🎉</div>}>
      <BookingSuccessContent />
    </Suspense>
  );
}
