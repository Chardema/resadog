"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  AlertCircle,
  ArrowRight,
  BadgeEuro,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Heart,
  History,
  PawPrint,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { getServiceLabel } from "@/lib/services";

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  serviceType: string;
  status: string;
  pets: {
    name: string;
    imageUrl?: string | null;
  }[];
  pet?: {
    name: string;
    imageUrl?: string | null;
  } | null;
  totalPrice: number;
}

interface DashboardData {
  upcomingBookings: Booking[];
  loyalty: {
    paws: number;
    tier: { name: string };
    nextTier?: { name: string } | null;
    nextReward: { label: string } | null;
    pawsToNextReward: number;
    nextRewardProgress: number;
  };
  subscription: {
    status: string;
  } | null;
  currentPeriodEnd: string | null;
  cancellationEffectiveAt: string | null;
  cancelAtPeriodEnd: boolean;
  stats: {
    completedBookings: number;
    totalSpent: number;
    nextBookingCount: number;
  };
}

const ACTIVE_BOOKING_STATUSES = ["PENDING", "ACCEPTING", "CANCELLING", "CONFIRMED", "IN_PROGRESS"] as const;

const statusLabels: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  PENDING: {
    label: "Demande envoyée",
    className: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  ACCEPTING: {
    label: "Validation en cours",
    className: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  CANCELLING: {
    label: "Annulation en cours",
    className: "bg-orange-100 text-orange-800",
    icon: Clock,
  },
  CONFIRMED: {
    label: "Confirmée",
    className: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle2,
  },
  IN_PROGRESS: {
    label: "En cours",
    className: "bg-blue-100 text-blue-800",
    icon: PawPrint,
  },
  COMPLETED: {
    label: "Terminée",
    className: "bg-gray-100 text-gray-700",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Annulée",
    className: "bg-red-100 text-red-800",
    icon: X,
  },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function formatLongDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getBookingPets(booking: Booking) {
  return booking.pets.length > 0 ? booking.pets : booking.pet ? [booking.pet] : [];
}

function getPetNames(booking: Booking) {
  const pets = getBookingPets(booking);
  return pets.length > 0 ? pets.map((pet) => pet.name).join(", ") : "Animal à confirmer";
}

function getStatusMeta(status: string) {
  return statusLabels[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700",
    icon: AlertCircle,
  };
}

function isUpcomingBooking(booking: Booking, now: Date) {
  const endDate = new Date(booking.endDate);
  return ACTIVE_BOOKING_STATUSES.includes(booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number])
    && endDate >= now;
}

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchDashboardData(controller.signal);
    }

    return () => controller.abort();
  }, [status, router]);

  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      setShowSubscriptionSuccess(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
      });

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        await fetch("/api/stripe/check-subscription");
        await fetchDashboardData();
        if (attempts >= 5) {
          clearInterval(interval);
          router.replace("/dashboard");
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [searchParams, router]);

  const fetchDashboardData = async (signal?: AbortSignal) => {
    try {
      const [bookingsRes, subRes] = await Promise.all([
        fetch("/api/bookings", { signal }),
        fetch("/api/user/subscription", { signal }),
      ]);

      if (bookingsRes.ok && subRes.ok) {
        const bookingsData = await bookingsRes.json();
        const subData = await subRes.json();
        const bookings: Booking[] = Array.isArray(bookingsData.bookings) ? bookingsData.bookings : [];
        const now = new Date();

        const upcomingBookings = bookings
          .filter((booking) => isUpcomingBooking(booking, now))
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        const completedBookings = bookings.filter((booking) => booking.status === "COMPLETED");

        setData({
          upcomingBookings,
          loyalty: subData.loyalty,
          subscription: subData.subscription,
          currentPeriodEnd: subData.currentPeriodEnd,
          cancellationEffectiveAt: subData.cancellationEffectiveAt,
          cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
          stats: {
            completedBookings: completedBookings.length,
            totalSpent: subData.totalSpent || 0,
            nextBookingCount: upcomingBookings.length,
          },
        });
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error("Erreur chargement dashboard:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isSubscribed = data?.subscription?.status === "ACTIVE";
  const hasCanceledSub = data?.subscription?.status === "CANCELED";
  const nextBooking = data?.upcomingBookings[0] || null;
  const pendingBookings = data?.upcomingBookings.filter((booking) => booking.status === "PENDING").length || 0;
  const firstName = session?.user?.name?.split(" ")[0] || "bonjour";
  const premiumReferenceAmount = nextBooking?.totalPrice || 81;
  const premiumSavings = Math.round(premiumReferenceAmount * 0.1 * 100) / 100;
  const premiumTotal = Math.round((premiumReferenceAmount - premiumSavings) * 100) / 100;
  const premiumPaws = Math.floor(premiumTotal * 2);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFbf7]">
        <div className="flex flex-col items-center gap-4">
          <PawPrint className="h-12 w-12 animate-bounce text-orange-500" />
          <p className="font-medium text-gray-500">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />

      <main className="container relative z-10 mx-auto px-4 pt-6 sm:px-6 md:pt-32">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 text-sm font-bold uppercase tracking-wide text-orange-600"
            >
              Espace client
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-extrabold text-gray-950 md:text-5xl"
            >
              Bon retour, <span className="text-orange-600">{firstName}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-2 max-w-2xl text-base text-gray-600 md:text-lg"
            >
              Vos réservations, vos Pattes et les actions utiles au même endroit.
            </motion.p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/booking"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
            >
              <CalendarPlus className="h-4 w-4" />
              Nouvelle réservation
            </Link>
            <Link
              href="/profile#subscription"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm hover:border-orange-200 hover:text-orange-700"
            >
              <Settings className="h-4 w-4" />
              Compte
            </Link>
          </div>
        </div>

        {showSubscriptionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-6 flex flex-col items-stretch justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-left text-green-900 shadow-sm md:flex-row md:items-center md:px-6"
          >
            <div>
              <p className="pr-8 text-lg font-bold">Premium activé</p>
              <p className="text-sm text-green-700">Remise de 10 %, Pattes doublées et priorité vacances sont actifs.</p>
            </div>
            <Link href="/booking" className="inline-flex min-h-11 items-center justify-center rounded-md bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800">
              Réserver avec Premium
            </Link>
            <button
              type="button"
              onClick={() => setShowSubscriptionSuccess(false)}
              aria-label="Fermer le message"
              className="absolute right-3 top-3 p-1 text-green-800"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        )}

        {data?.cancelAtPeriodEnd && data.subscription?.status === "ACTIVE" && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col items-start justify-between gap-4 rounded-lg border border-yellow-200 bg-yellow-50 px-5 py-4 text-yellow-900 shadow-sm md:flex-row md:items-center"
          >
            <div>
              <p className="font-bold">Résiliation en cours</p>
              <p className="text-sm text-yellow-800">
                Premium se terminera le {new Date(data.cancellationEffectiveAt || data.currentPeriodEnd!).toLocaleDateString("fr-FR")}. Vos Pattes restent conservées.
              </p>
            </div>
            <Link href="/profile#subscription" className="rounded-md bg-yellow-700 px-4 py-2 text-sm font-bold text-white hover:bg-yellow-800">
              Gérer
            </Link>
          </motion.div>
        )}

        {hasCanceledSub && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 text-gray-800 shadow-sm md:flex-row md:items-center"
          >
            <div>
              <p className="font-bold">Premium est inactif</p>
              <p className="text-sm text-gray-600">Le programme fidélité gratuit reste disponible.</p>
            </div>
            <Link href="/subscriptions" className="rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700">
              Réactiver Premium
            </Link>
          </motion.div>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-7"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-gray-500">Prochaine réservation</p>
                {nextBooking ? (
                  <>
                    <h2 className="mt-2 text-2xl font-extrabold text-gray-950">
                      {getServiceLabel(nextBooking.serviceType)}
                    </h2>
                    <p className="mt-1 text-gray-600">
                      {getPetNames(nextBooking)} · {formatLongDate(nextBooking.startDate)}
                      {formatDate(nextBooking.startDate) !== formatDate(nextBooking.endDate) ? ` au ${formatLongDate(nextBooking.endDate)}` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-2 text-2xl font-extrabold text-gray-950">Rien de prévu</h2>
                    <p className="mt-1 text-gray-600">Aucune réservation active à venir pour le moment.</p>
                  </>
                )}
              </div>

              {nextBooking && (
                <StatusPill status={nextBooking.status} />
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MetricCard label="À venir" value={data?.stats.nextBookingCount || 0} icon={CalendarDays} />
              <MetricCard label="En attente" value={pendingBookings} icon={Clock} tone="amber" />
              <MetricCard label="Dépensé validé" value={`${Math.round(data?.stats.totalSpent || 0)}€`} icon={BadgeEuro} tone="green" />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/booking" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600">
                Réserver
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/history" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:border-orange-200 hover:text-orange-700">
                Voir l&apos;historique
                <History className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="overflow-hidden rounded-lg border border-orange-200 bg-gradient-to-br from-white via-orange-50 to-amber-50 shadow-sm lg:col-span-5"
          >
            <div className="border-b border-orange-200/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-orange-700">Fidélité</p>
                  <h2 className="mt-2 text-3xl font-extrabold text-gray-950">{data?.loyalty.paws || 0} Pattes</h2>
                  <p className="mt-1 text-sm text-gray-600">Niveau {data?.loyalty.tier.name || "Bronze"}</p>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-sm font-bold text-orange-700 shadow-sm">
                  {isSubscribed ? "Premium actif" : "Gratuit"}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-bold text-gray-600">
                  <span>{data?.loyalty.nextReward ? "Prochaine récompense" : "Toutes les récompenses atteintes"}</span>
                  <span>{data?.loyalty.nextRewardProgress || 100}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-orange-100">
                  <div
                    className="h-full rounded-full bg-orange-600"
                    style={{ width: `${data?.loyalty.nextRewardProgress || 100}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {data?.loyalty.nextReward
                    ? `${data.loyalty.pawsToNextReward} Pattes avant ${data.loyalty.nextReward.label}.`
                    : "Vous avez atteint le dernier palier fidélité."}
                </p>
              </div>
            </div>

            <div className="grid divide-y divide-orange-200/70 bg-white/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-gray-950 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="font-bold text-gray-950">Premium</p>
                <p className="mt-1 text-sm text-gray-600">
                  {isSubscribed ? "-10 % et Pattes doublées sur vos réservations." : "Passez à -10 % et doublez vos Pattes."}
                </p>
                <Link href={isSubscribed ? "/profile#subscription" : "/subscriptions"} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-700 hover:text-orange-900">
                  {isSubscribed ? "Gérer Premium" : "Découvrir"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-orange-100 text-orange-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="font-bold text-gray-950">Avantage immédiat</p>
                <p className="mt-1 text-sm text-gray-600">
                  {nextBooking
                    ? `Sur votre prochaine réservation, Premium économiserait ${formatCurrency(premiumSavings)} et rapporterait ${premiumPaws} Pattes.`
                    : `Exemple à ${formatCurrency(premiumReferenceAmount)} : ${formatCurrency(premiumSavings)} économisés et ${premiumPaws} Pattes.`}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-7"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-gray-950">Réservations à venir</h2>
                <p className="text-sm text-gray-600">Demandes en attente, confirmées ou en cours uniquement.</p>
              </div>
              <Link href="/booking" aria-label="Ajouter une réservation" className="rounded-md border border-gray-200 p-2 text-gray-700 hover:border-orange-200 hover:text-orange-700">
                <CalendarPlus className="h-5 w-5" />
              </Link>
            </div>

            {data?.upcomingBookings.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {data?.upcomingBookings.slice(0, 5).map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid gap-4 lg:col-span-5"
          >
            <ActionCard
              title="Mes animaux"
              description="Profils, santé, habitudes et informations utiles."
              href="/pets"
              icon={Heart}
            />
            <ActionCard
              title="Profil & fidélité"
              description="Pattes, Premium, informations client et factures."
              href="/profile"
              icon={Settings}
            />
            <ActionCard
              title="Historique"
              description={`${data?.stats.completedBookings || 0} prestation${(data?.stats.completedBookings || 0) > 1 ? "s" : ""} terminée${(data?.stats.completedBookings || 0) > 1 ? "s" : ""}.`}
              href="/history"
              icon={History}
              tone="orange"
            />
          </motion.div>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${meta.className}`}>
      <Icon className="h-4 w-4" />
      {meta.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "gray",
}: {
  label: string;
  value: string | number;
  icon: typeof CalendarDays;
  tone?: "gray" | "amber" | "green";
}) {
  const toneClasses = {
    gray: "bg-gray-50 text-gray-700",
    amber: "bg-amber-50 text-amber-800",
    green: "bg-emerald-50 text-emerald-800",
  }[tone];

  return (
    <div className={`rounded-lg p-4 ${toneClasses}`}>
      <Icon className="mb-3 h-5 w-5" />
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const pets = getBookingPets(booking);
  const imageUrl = pets[0]?.imageUrl;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white text-gray-500 shadow-sm">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <PawPrint className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-bold text-gray-950">{getPetNames(booking)}</p>
            <p className="text-sm text-gray-600">
              {getServiceLabel(booking.serviceType)} · {formatDate(booking.startDate)}
              {formatDate(booking.startDate) !== formatDate(booking.endDate) ? ` - ${formatDate(booking.endDate)}` : ""}
            </p>
          </div>
          <StatusPill status={booking.status} />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <PawPrint className="mx-auto h-10 w-10 text-gray-300" />
      <p className="mt-3 font-bold text-gray-800">Aucune réservation active</p>
      <p className="mt-1 text-sm text-gray-500">Les réservations terminées ou annulées restent dans l&apos;historique.</p>
      <Link href="/booking" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600">
        Créer une réservation
      </Link>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon: Icon,
  tone = "white",
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof Heart;
  tone?: "white" | "orange";
}) {
  const className = tone === "orange"
    ? "border-orange-100 bg-orange-50 hover:border-orange-200"
    : "border-gray-200 bg-white hover:border-orange-200";

  return (
    <Link
      href={href}
      className={`flex min-h-[112px] items-center justify-between gap-4 rounded-lg border p-5 shadow-sm transition ${className}`}
    >
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-orange-700 shadow-sm">
          <Icon className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-lg font-extrabold text-gray-950">{title}</span>
          <span className="mt-1 block text-sm text-gray-600">{description}</span>
        </span>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-500" />
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#FDFbf7]"><PawPrint className="h-12 w-12 animate-bounce text-orange-500" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
