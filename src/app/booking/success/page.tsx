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

    const interval: any = setInterval(function () {
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
    <div className="min-h-screen bg-[#FDFbf7] flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-100/30 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 bg-white rounded-[3rem] p-12 shadow-2xl shadow-green-100 border border-green-50 max-w-lg w-full"
      >
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          transition={{ delay: 0.2, type: "spring" }}
          className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/30"
        >
          <span className="text-5xl text-white">✓</span>
        </motion.div>

        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Réservation Confirmée ! 🎉
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          Merci pour votre confiance. Votre compagnon est entre de bonnes mains.
        </p>

        <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Numéro de réservation</p>
          <p className="font-mono font-bold text-gray-900 text-lg tracking-wider">
            #{bookingId?.slice(-8).toUpperCase() || "PENDING"}
          </p>
          <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
            <span>📧</span> Un email de confirmation vous a été envoyé.
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/dashboard">
            <Button className="w-full h-14 rounded-xl bg-gray-900 hover:bg-green-600 text-white font-bold text-lg shadow-xl transition-all transform hover:scale-[1.02]">
              Aller à mon Dashboard
            </Button>
          </Link>
          
          <p className="text-sm text-gray-400">
            Redirection automatique dans {countdown}s...
          </p>
        </div>
      </motion.div>
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
