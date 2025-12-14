"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

interface Pet {
  id: string;
  name: string;
  breed: string;
  age?: number | null;
}

const serviceTypes = [
  {
    value: "BOARDING",
    name: "Hébergement avec nuitées",
    price: 50,
    unit: "jour",
    description: "Votre chien reste chez moi 24h/24 avec promenades, repas et câlins inclus",
    icon: "🏠",
    maxHours: 24, // 1 nuit = 24h avec tolérance de 2h
    extraHourlyRate: 3, // €/h au-delà du max + tolérance
  },
  {
    value: "DAY_CARE",
    name: "Garde de jour uniquement",
    price: 30,
    unit: "jour",
    description: "Journée complète de garde (jusqu'à 10h)",
    icon: "☀️",
    maxHours: 10, // Journée standard = 10h maximum
    extraHourlyRate: 3, // €/h au-delà de 10h
  },
  {
    value: "DROP_IN",
    name: "Visite à domicile",
    price: 20,
    unit: "visite",
    description: "Visite de 30 min (base) - +15€ par tranche de 30 min supplémentaire",
    icon: "🚪",
    maxHours: null,
    extraHourlyRate: 0,
    baseDuration: 30, // Minutes de base incluses dans le prix
    extraDurationRate: 15, // Prix par tranche de 30 min supplémentaire
    durationIncrement: 30, // Incrément en minutes
  },
  {
    value: "DOG_WALKING",
    name: "Promenade",
    price: 15,
    unit: "promenade",
    description: "Promenade de 15 min (base) - +10€ par tranche de 15 min supplémentaire",
    icon: "🦮",
    maxHours: null,
    extraHourlyRate: 0,
    baseDuration: 15, // Minutes de base incluses dans le prix
    extraDurationRate: 10, // Prix par tranche de 15 min supplémentaire
    durationIncrement: 15, // Incrément en minutes
  },
];

export default function BookingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    checking: boolean;
    available: boolean;
    message: string;
    unavailableDates: string[];
  }>({
    checking: false,
    available: true,
    message: "",
    unavailableDates: [],
  });
  const [formData, setFormData] = useState<{
    petId: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    serviceType: "BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING";
    notes: string;
    promoCode: string;
  }>({
    petId: "",
    startDate: "",
    endDate: "",
    startTime: "18:00", // Heure par défaut de dépôt
    endTime: "10:00",   // Heure par défaut de récupération
    serviceType: "BOARDING",
    notes: "",
    promoCode: "",
  });

  // Pour DROP_IN et DOG_WALKING : système de dates individuelles
  const [individualDates, setIndividualDates] = useState<Array<{ date: string; duration: number }>>([
    { date: "", duration: 30 }, // DROP_IN par défaut : 30 min
  ]);

  // Système de coupons
  const [couponStatus, setCouponStatus] = useState<{
    applied: boolean;
    loading: boolean;
    isAuto: boolean;
    data: null | {
      code: string;
      description?: string;
      discountType: "PERCENTAGE" | "FIXED_AMOUNT";
      discountValue: number;
      discountAmount: number;
      finalAmount: number;
      message: string;
    };
    error: string;
  }>({
    applied: false,
    loading: false,
    isAuto: false,
    data: null,
    error: "",
  });

  // Réinitialiser les dates individuelles quand on change de type de service
  useEffect(() => {
    const defaultDuration = formData.serviceType === "DOG_WALKING" ? 15 : 30;
    setIndividualDates([{ date: "", duration: defaultDuration }]);
  }, [formData.serviceType]);

  // Fonctions pour gérer les dates individuelles
  const addIndividualDate = () => {
    const defaultDuration = formData.serviceType === "DOG_WALKING" ? 15 : 30;
    setIndividualDates([...individualDates, { date: "", duration: defaultDuration }]);
  };

  const removeIndividualDate = (index: number) => {
    if (individualDates.length > 1) {
      setIndividualDates(individualDates.filter((_, i) => i !== index));
    }
  };

  const updateIndividualDate = (index: number, field: "date" | "duration", value: string | number) => {
    const updated = [...individualDates];
    if (field === "date") {
      updated[index].date = value as string;
    } else {
      updated[index].duration = value as number;
    }
    setIndividualDates(updated);
  };

  const increaseDuration = (index: number, increment: number) => {
    const updated = [...individualDates];
    updated[index].duration += increment;
    setIndividualDates(updated);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    fetchPets();
  }, []);

  // Auto-charger le coupon quand on arrive à l'étape 2 ou plus
  useEffect(() => {
    if (step >= 2 && !couponStatus.applied) {
      fetchAutoCoupon();
    }
  }, [step]);

  // Re-valider le coupon automatiquement quand les dates/prix changent
  useEffect(() => {
    if (formData.promoCode && calculatePrice() > 0) {
      // Debounce pour éviter trop d'appels pendant la saisie
      const timer = setTimeout(() => {
        validateCoupon();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.startDate, formData.endDate, formData.startTime, formData.endTime, individualDates, formData.serviceType]);

  // Vérifier les disponibilités quand les dates changent
  useEffect(() => {
    const checkAvailability = async () => {
      // Pour DROP_IN et DOG_WALKING, vérifier les dates individuelles
      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
        const validDates = individualDates.filter(d => d.date !== "");

        if (validDates.length === 0) {
          setAvailabilityStatus({
            checking: false,
            available: true,
            message: "",
            unavailableDates: [],
          });
          return;
        }

        setAvailabilityStatus((prev) => ({ ...prev, checking: true }));

        try {
          // Vérifier chaque date individuellement
          const dateChecks = await Promise.all(
            validDates.map(async (item) => {
              const response = await fetch(
                `/api/availability/check?startDate=${item.date}&endDate=${item.date}&serviceType=${formData.serviceType}`
              );
              if (response.ok) {
                const data = await response.json();
                return { date: item.date, available: data.available };
              }
              return { date: item.date, available: false };
            })
          );

          const unavailable = dateChecks.filter(c => !c.available);

          if (unavailable.length === 0) {
            setAvailabilityStatus({
              checking: false,
              available: true,
              message: `✅ Toutes les dates sont disponibles (${validDates.length} ${formData.serviceType === "DROP_IN" ? "visite" : "promenade"}${validDates.length > 1 ? "s" : ""})`,
              unavailableDates: [],
            });
          } else {
            const formattedDates = unavailable
              .map((d) => new Date(d.date).toLocaleDateString("fr-FR"))
              .join(", ");
            setAvailabilityStatus({
              checking: false,
              available: false,
              message: `❌ Dates non disponibles: ${formattedDates}`,
              unavailableDates: unavailable.map(d => d.date),
            });
          }
        } catch (error) {
          console.error("Erreur lors de la vérification:", error);
          setAvailabilityStatus({
            checking: false,
            available: false,
            message: "Impossible de vérifier les disponibilités",
            unavailableDates: [],
          });
        }
        return;
      }

      // Pour BOARDING et DAY_CARE, vérifier la plage de dates
      if (!formData.startDate || !formData.endDate) {
        setAvailabilityStatus({
          checking: false,
          available: true,
          message: "",
          unavailableDates: [],
        });
        return;
      }

      // Vérifier que la date de fin est après ou égale à la date de début
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        setAvailabilityStatus({
          checking: false,
          available: false,
          message: "La date de fin doit être après la date de début",
          unavailableDates: [],
        });
        return;
      }

      // Si c'est le même jour, vérifier les heures
      if (formData.startDate === formData.endDate) {
         if (formData.endTime <= formData.startTime) {
           setAvailabilityStatus({
            checking: false,
            available: false,
            message: "L'heure de fin doit être après l'heure de début",
            unavailableDates: [],
          });
          return;
         }
      }

      setAvailabilityStatus((prev) => ({ ...prev, checking: true }));

      try {
        const response = await fetch(
          `/api/availability/check?startDate=${formData.startDate}&endDate=${formData.endDate}&serviceType=${formData.serviceType}`
        );

        if (response.ok) {
          const data = await response.json();

          if (data.available) {
            setAvailabilityStatus({
              checking: false,
              available: true,
              message: `✅ Toutes les dates sont disponibles (${data.totalDays} jour${data.totalDays > 1 ? "s" : ""})`,
              unavailableDates: [],
            });
          } else {
            const formattedDates = data.unavailableDates
              .map((d: string) => new Date(d).toLocaleDateString("fr-FR"))
              .join(", ");
            setAvailabilityStatus({
              checking: false,
              available: false,
              message: `❌ Dates non disponibles: ${formattedDates}`,
              unavailableDates: data.unavailableDates,
            });
          }
        } else {
          setAvailabilityStatus({
            checking: false,
            available: false,
            message: "Erreur lors de la vérification des disponibilités",
            unavailableDates: [],
          });
        }
      } catch (error) {
        console.error("Erreur lors de la vérification:", error);
        setAvailabilityStatus({
          checking: false,
          available: false,
          message: "Impossible de vérifier les disponibilités",
          unavailableDates: [],
        });
      }
    };

    checkAvailability();
  }, [formData.startDate, formData.endDate, formData.serviceType, individualDates]);

  const fetchPets = async () => {
    try {
      const response = await fetch("/api/pets");
      if (response.ok) {
        const data = await response.json();
        setPets(data.pets || []);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des animaux:", err);
    }
  };

  // Charger le coupon automatique si l'utilisateur en a un
  const fetchAutoCoupon = async () => {
    try {
      const response = await fetch("/api/coupons/auto");
      if (response.ok) {
        const data = await response.json();
        if (data.autoCoupon) {
          setFormData((prev) => ({ ...prev, promoCode: data.autoCoupon.code }));
          setCouponStatus((prev) => ({ ...prev, isAuto: true }));

          // Auto-valider le coupon VIP
          const basePrice = calculatePrice();
          if (basePrice > 0) {
            const validateResponse = await fetch("/api/coupons/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: data.autoCoupon.code,
                totalAmount: basePrice,
                serviceType: formData.serviceType,
                duration: calculateDays(),
              }),
            });

            const validateData = await validateResponse.json();
            if (validateResponse.ok) {
              setCouponStatus({
                applied: true,
                loading: false,
                isAuto: true,
                data: {
                  code: validateData.coupon.code,
                  description: validateData.coupon.description,
                  discountType: validateData.coupon.discountType,
                  discountValue: validateData.coupon.discountValue,
                  discountAmount: validateData.discountAmount,
                  finalAmount: validateData.finalAmount,
                  message: validateData.message,
                },
                error: "",
              });
            }
          } else {
            // Appliquer visuellement immédiatement même sans dates
            setCouponStatus({
              applied: true,
              loading: false,
              isAuto: true,
              data: {
                code: data.autoCoupon.code,
                description: data.autoCoupon.description,
                discountType: data.autoCoupon.discountType,
                discountValue: data.autoCoupon.discountValue,
                discountAmount: 0,
                finalAmount: 0,
                message: "Réduction VIP disponible",
              },
              error: "",
            });
          }
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement du coupon auto:", err);
    }
  };

  // Valider un code promo manuellement
  const validateCoupon = async () => {
    if (!formData.promoCode) {
      setCouponStatus({
        applied: false,
        loading: false,
        isAuto: false,
        data: null,
        error: "Veuillez entrer un code promo",
      });
      return;
    }

    const basePrice = calculatePrice();
    if (basePrice === 0) {
      setCouponStatus({
        applied: false,
        loading: false,
        isAuto: false,
        data: null,
        error: "Veuillez d'abord renseigner les dates",
      });
      return;
    }

    setCouponStatus((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.promoCode,
          totalAmount: basePrice,
          serviceType: formData.serviceType,
          duration: calculateDays(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCouponStatus({
          applied: true,
          loading: false,
          isAuto: couponStatus.isAuto,
          data: {
            code: data.coupon.code,
            description: data.coupon.description,
            discountType: data.coupon.discountType,
            discountValue: data.coupon.discountValue,
            discountAmount: data.discountAmount,
            finalAmount: data.finalAmount,
            message: data.message,
          },
          error: "",
        });
      } else {
        setCouponStatus({
          applied: false,
          loading: false,
          isAuto: false,
          data: null,
          error: data.error || "Code promo invalide",
        });
      }
    } catch (err) {
      setCouponStatus({
        applied: false,
        loading: false,
        isAuto: false,
        data: null,
        error: "Erreur lors de la validation du code",
      });
    }
  };

  // Retirer le code promo
  const removeCoupon = () => {
    if (!couponStatus.isAuto) {
      setFormData({ ...formData, promoCode: "" });
    }
    setCouponStatus({
      applied: false,
      loading: false,
      isAuto: couponStatus.isAuto,
      data: null,
      error: "",
    });
  };

  const getSelectedService = () => {
    return serviceTypes.find((s) => s.value === formData.serviceType);
  };

  // Calcul intelligent du prix selon la règle des 24h
  const calculatePriceBreakdown = () => {
    if (!formData.startDate || !formData.endDate) {
      return {
        baseNights: 0,
        extraHours: 0,
        surchargeType: null as "demi" | "plein" | "hourly" | null,
        basePrice: 0,
        surchargePrice: 0,
        puppySurcharge: 0,
        totalPrice: 0,
        detail: "",
      };
    }

    const service = getSelectedService();
    if (!service) return {
      baseNights: 0,
      extraHours: 0,
      surchargeType: null,
      basePrice: 0,
      surchargePrice: 0,
      puppySurcharge: 0,
      totalPrice: 0,
      detail: "",
    };

    // Vérifier si l'animal sélectionné est un chiot (< 1 an)
    const selectedPet = pets.find((p) => p.id === formData.petId);
    const isPuppy = selectedPet && selectedPet.age !== undefined && selectedPet.age !== null && selectedPet.age < 1;
    const puppyDailyRate = 10; // 10€ de supplément par nuit/jour pour un chiot

    // Pour les services ponctuels (visite, promenade), calcul basé sur les dates individuelles ET les durées
    if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
      // Compter seulement les dates renseignées
      const validDates = individualDates.filter(d => d.date !== "");
      const days = validDates.length;

      // Calculer le prix total en tenant compte des durées de chaque prestation
      let totalBasePrice = 0;
      let totalSurcharge = 0;

      validDates.forEach(item => {
        // Prix de base pour la durée standard
        totalBasePrice += service.price;

        // Calculer la durée supplémentaire
        const baseDuration = service.baseDuration || 0;
        const extraDuration = item.duration - baseDuration;

        if (extraDuration > 0) {
          // Calculer le nombre de tranches supplémentaires
          const increment = service.durationIncrement || baseDuration;
          const extraIncrements = Math.ceil(extraDuration / increment);
          const extraRate = service.extraDurationRate || 0;
          totalSurcharge += extraIncrements * extraRate;
        }
      });

      const puppySurcharge = isPuppy ? days * puppyDailyRate : 0;
      const total = totalBasePrice + totalSurcharge + puppySurcharge;

      return {
        baseNights: days,
        extraHours: 0,
        surchargeType: totalSurcharge > 0 ? "hourly" as const : null,
        basePrice: totalBasePrice,
        surchargePrice: totalSurcharge,
        puppySurcharge,
        totalPrice: total,
        detail: `${days} ${service.unit}${days > 1 ? "s" : ""}`,
      };
    }

    // Pour l'hébergement et la garderie de jour: Règle des heures avec plafond
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

    // Calculer la différence en heures
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

    const maxHours = service.maxHours || 24;
    const hourlyRate = service.extraHourlyRate || 0;

    // Pour BOARDING (hébergement): logique par périodes de 24h
    if (formData.serviceType === "BOARDING") {
      // Nombre de périodes de 24h (nuits)
      const baseNights = Math.floor(totalHours / 24);

      // Heures restantes après les périodes de 24h
      const extraHours = totalHours % 24;

      // Prix de base (nuits complètes)
      const basePrice = baseNights * service.price;

      // Calcul de la surcharge selon les heures supplémentaires
      let surchargePrice = 0;
      let surchargeType: "demi" | "plein" | "hourly" | null = null;

      if (extraHours > 2 && extraHours <= 8) {
        // Dépassement de 2h à 8h: +50% du tarif
        surchargePrice = service.price * 0.5;
        surchargeType = "demi";
      } else if (extraHours > 8) {
        // Dépassement de +8h: +100% du tarif (journée complète)
        surchargePrice = service.price;
        surchargeType = "plein";
      }

      // Supplément chiot si applicable
      const puppySurcharge = isPuppy ? baseNights * puppyDailyRate : 0;

      const totalPrice = basePrice + surchargePrice + puppySurcharge;

      // Créer le détail
      let detail = `${baseNights} nuit${baseNights > 1 ? "s" : ""}`;
      if (surchargeType === "demi") {
        detail += ` + prolongation (${extraHours.toFixed(0)}h)`;
      } else if (surchargeType === "plein") {
        detail += ` + 1 journée supplémentaire`;
      } else if (extraHours > 0 && extraHours <= 2) {
        detail += ` (tolérance ${extraHours.toFixed(0)}h)`;
      }

      return {
        baseNights,
        extraHours,
        surchargeType,
        basePrice,
        surchargePrice,
        puppySurcharge,
        totalPrice,
        detail,
      };
    }

    // Pour DAY_CARE (garde de jour): logique par plafond d'heures
    if (formData.serviceType === "DAY_CARE") {
      // Nombre de jours (on compte les jours calendaires)
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Prix de base (journées)
      let basePrice = days * service.price;
      let surchargePrice = 0;
      let surchargeType: "demi" | "plein" | "hourly" | null = null;

      // Supplément chiot si applicable
      const puppySurcharge = isPuppy ? days * puppyDailyRate : 0;

      // Si c'est sur une seule journée, vérifier le dépassement d'heures
      if (days === 1 && totalHours > maxHours) {
        const extraHours = totalHours - maxHours;
        surchargePrice = extraHours * hourlyRate;
        surchargeType = "hourly";

        return {
          baseNights: 1,
          extraHours,
          surchargeType,
          basePrice,
          surchargePrice,
          puppySurcharge,
          totalPrice: basePrice + surchargePrice + puppySurcharge,
          detail: `1 jour (${maxHours}h) + ${extraHours.toFixed(0)}h supplémentaires`,
        };
      }

      return {
        baseNights: days,
        extraHours: 0,
        surchargeType: null,
        basePrice,
        surchargePrice: 0,
        puppySurcharge,
        totalPrice: basePrice + puppySurcharge,
        detail: `${days} jour${days > 1 ? "s" : ""}`,
      };
    }

    // Ne devrait jamais arriver ici (cas par défaut pour DROP_IN et DOG_WALKING)
    // Ces services ont déjà leur return au début de la fonction
    return {
      baseNights: 0,
      extraHours: 0,
      surchargeType: null,
      basePrice: 0,
      surchargePrice: 0,
      puppySurcharge: 0,
      totalPrice: 0,
      detail: "",
    };
  };

  const calculatePrice = () => {
    return calculatePriceBreakdown().totalPrice;
  };

  const calculateDays = () => {
    const breakdown = calculatePriceBreakdown();
    return breakdown.baseNights + (breakdown.surchargeType === "plein" ? 1 : 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Utiliser le prix final avec réduction si un coupon est appliqué
      const price = couponStatus.applied && couponStatus.data
        ? couponStatus.data.finalAmount
        : calculatePrice();

      // Pour DROP_IN et DOG_WALKING, calculer les dates min/max à partir des dates individuelles
      let startDate = formData.startDate;
      let endDate = formData.endDate;
      let startTime = formData.startTime;
      let endTime = formData.endTime;

      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
        const validDates = individualDates.filter(d => d.date !== "").map(d => d.date).sort();
        if (validDates.length > 0) {
          startDate = validDates[0];
          endDate = validDates[validDates.length - 1];
          startTime = "09:00"; // Heure par défaut
          endTime = "18:00";
        }
      }

      // 1. Créer la réservation
      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          petId: formData.petId,
          startDate,
          endDate,
          startTime,
          endTime,
          serviceType: formData.serviceType,
          notes: formData.notes,
          promoCode: formData.promoCode || undefined,
          totalPrice: price,
          depositAmount: price, // Paiement complet immédiat
        }),
      });

      const bookingData = await bookingResponse.json();

      if (!bookingResponse.ok) {
        throw new Error(bookingData.error || "Une erreur est survenue");
      }

      // 2. Créer la session Stripe Checkout
      const checkoutResponse = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: bookingData.booking.id,
        }),
      });

      const checkoutData = await checkoutResponse.json();

      if (!checkoutResponse.ok) {
        throw new Error(checkoutData.error || "Erreur lors de la création du paiement");
      }

      // 3. Rediriger vers Stripe Checkout
      window.location.href = checkoutData.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split("T")[0];

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🐾</div>
          <p className="text-gray-700 font-semibold">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <DashboardNav />

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Nouvelle Réservation ⭐
            </h1>
            <p className="text-gray-700 text-lg">
              Réservez une garde premium pour votre compagnon
            </p>
          </motion.div>

          {/* Indicateur de progression */}
          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-4">
                  <motion.button
                    type="button"
                    onClick={() => {
                      // Permettre de revenir en arrière uniquement
                      if (s < step) {
                        setStep(s);
                      }
                    }}
                    whileHover={s < step ? { scale: 1.1 } : {}}
                    whileTap={s < step ? { scale: 0.95 } : {}}
                    disabled={s > step}
                    className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                      step >= s
                        ? "bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg scale-110"
                        : "bg-gray-200 text-gray-500"
                    } ${s < step ? "cursor-pointer hover:ring-4 hover:ring-orange-200" : s === step ? "" : "cursor-not-allowed opacity-50"}`}
                  >
                    {s}
                  </motion.button>
                  {s < 4 && (
                    <div
                      className={`h-1 w-16 transition-all ${
                        step > s ? "bg-gradient-to-r from-amber-400 to-orange-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Légende sous l'indicateur */}
          <div className="flex items-center justify-center gap-6 mb-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold">1.</span> Animal
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">2.</span> Dates & Service
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">3.</span> Récapitulatif
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">4.</span> Paiement
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border-2 border-red-300 text-red-700 px-6 py-4 rounded-xl mb-6 font-medium"
            >
              ❌ {error}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Étape 1: Choisir l'animal */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    1. Choisissez votre compagnon 🐶
                  </h2>

                  {pets.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-orange-300 rounded-2xl">
                      <div className="text-6xl mb-4">🐕</div>
                      <p className="text-gray-700 font-semibold mb-4">
                        Vous n'avez pas encore ajouté d'animal
                      </p>
                      <Link href="/pets/new">
                        <Button className="bg-gradient-to-r from-amber-500 to-orange-600">
                          Ajouter un animal 🐾
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {pets.map((pet) => (
                        <motion.div
                          key={pet.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setFormData({ ...formData, petId: pet.id });
                          }}
                          className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                            formData.petId === pet.id
                              ? "border-orange-500 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-lg"
                              : "border-gray-200 hover:border-orange-300"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-3xl">
                              🐕
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">{pet.name}</h3>
                              <p className="text-sm text-gray-600">{pet.breed}</p>
                            </div>
                          </div>
                          {formData.petId === pet.id && (
                            <div className="mt-4 text-orange-600 font-bold text-sm">
                              ✓ Sélectionné
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.petId}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                    size="lg"
                  >
                    Continuer →
                  </Button>
                </motion.div>
              )}

              {/* Étape 2: Type de service et dates */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    2. Type de garde et dates 📅
                  </h2>

                  {/* Type de service */}
                  <div>
                    <Label className="text-gray-700 font-semibold text-base mb-4 block">
                      Choisissez le type de garde
                    </Label>
                    <div className="grid gap-3">
                      {serviceTypes.map((service) => (
                        <motion.div
                          key={service.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              serviceType: service.value as typeof formData.serviceType,
                            })
                          }
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.serviceType === service.value
                              ? "border-orange-500 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-md"
                              : "border-gray-200 hover:border-orange-300 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="text-4xl">{service.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-gray-900">{service.name}</h3>
                                {couponStatus.applied && couponStatus.data && service.value !== "DROP_IN" && service.value !== "DOG_WALKING" ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm text-gray-500 line-through">
                                      {service.price}€/{service.unit}
                                    </span>
                                    <span className="text-lg font-bold text-green-600">
                                      {(() => {
                                        let discounted = service.price;
                                        if (couponStatus.data.discountType === "PERCENTAGE") {
                                          discounted = service.price * (1 - couponStatus.data.discountValue / 100);
                                        } else {
                                          // Montant fixe par nuit/jour
                                          discounted = Math.max(0, service.price - couponStatus.data.discountValue);
                                        }
                                        return discounted.toFixed(2);
                                      })()}
                                      €<span className="text-sm text-green-600">/{service.unit}</span>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-lg font-bold text-orange-600">
                                    {service.price}€<span className="text-sm text-gray-600">/{service.unit}</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{service.description.replace("Votre chien", pets.find(p => p.id === formData.petId)?.name || "Votre chien")}</p>
                            </div>
                            {formData.serviceType === service.value && (
                              <div className="text-orange-600 font-bold">✓</div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Dates et Horaires - Adapté au type de service */}
                  <div className="space-y-4">
                    {/* BOARDING et DAY_CARE : Dépôt et Récupération avec horaires */}
                    {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                      <>
                        {/* Dépôt */}
                        <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">📥</span>
                            <h3 className="font-bold text-green-900">Dépôt de votre compagnon</h3>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="startDate" className="text-green-800 font-semibold text-sm mb-2 block">
                                Date
                              </Label>
                              <Input
                                id="startDate"
                                type="date"
                                value={formData.startDate}
                                onChange={(e) =>
                                  setFormData({ ...formData, startDate: e.target.value })
                                }
                                min={today}
                                required
                                className="border-2 border-green-300 focus:border-green-500 rounded-xl h-12 text-base"
                              />
                            </div>
                            <div>
                              <Label htmlFor="startTime" className="text-green-800 font-semibold text-sm mb-2 block">
                                Heure
                              </Label>
                              <Input
                                id="startTime"
                                type="time"
                                value={formData.startTime}
                                onChange={(e) =>
                                  setFormData({ ...formData, startTime: e.target.value })
                                }
                                required
                                className="border-2 border-green-300 focus:border-green-500 rounded-xl h-12 text-base"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Récupération */}
                        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">📤</span>
                            <h3 className="font-bold text-blue-900">Récupération de {pets.find(p => p.id === formData.petId)?.name || "votre compagnon"}</h3>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="endDate" className="text-blue-800 font-semibold text-sm mb-2 block">
                                Date
                              </Label>
                              <Input
                                id="endDate"
                                type="date"
                                value={formData.endDate}
                                onChange={(e) =>
                                  setFormData({ ...formData, endDate: e.target.value })
                                }
                                min={formData.startDate || today}
                                required
                                className="border-2 border-blue-300 focus:border-blue-500 rounded-xl h-12 text-base"
                              />
                            </div>
                            <div>
                              <Label htmlFor="endTime" className="text-blue-800 font-semibold text-sm mb-2 block">
                                Heure
                              </Label>
                              <Input
                                id="endTime"
                                type="time"
                                value={formData.endTime}
                                onChange={(e) =>
                                  setFormData({ ...formData, endTime: e.target.value })
                                }
                                required
                                className="border-2 border-blue-300 focus:border-blue-500 rounded-xl h-12 text-base"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* DROP_IN et DOG_WALKING : Dates individuelles avec durées personnalisables */}
                    {(formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") && (
                      <div className="p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{formData.serviceType === "DROP_IN" ? "🚪" : "🦮"}</span>
                            <h3 className="font-bold text-purple-900">
                              {formData.serviceType === "DROP_IN" ? "Visites à domicile" : "Promenades"}
                            </h3>
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={addIndividualDate}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                          >
                            <span className="text-lg">+</span>
                            Ajouter une date
                          </motion.button>
                        </div>

                        <div className="space-y-3">
                          {individualDates.map((item, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 bg-white rounded-xl border-2 border-purple-200"
                            >
                              <div className="flex items-center gap-3">
                                {/* Numéro */}
                                <div className="h-8 w-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                  {index + 1}
                                </div>

                                {/* Date */}
                                <div className="flex-1">
                                  <Input
                                    type="date"
                                    value={item.date}
                                    onChange={(e) => updateIndividualDate(index, "date", e.target.value)}
                                    min={today}
                                    required
                                    className="border-2 border-purple-300 focus:border-purple-500 rounded-lg h-10"
                                  />
                                </div>

                                {/* Durée avec boutons +15min */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="px-3 py-2 bg-purple-100 rounded-lg border border-purple-300 font-bold text-purple-900 min-w-[80px] text-center">
                                    {item.duration} min
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => increaseDuration(index, formData.serviceType === "DOG_WALKING" ? 15 : 30)}
                                    className="h-10 px-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all"
                                  >
                                    +{formData.serviceType === "DOG_WALKING" ? "15" : "30"} min
                                  </motion.button>
                                  {item.duration > (formData.serviceType === "DOG_WALKING" ? 15 : 30) && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => increaseDuration(index, formData.serviceType === "DOG_WALKING" ? -15 : -30)}
                                      className="h-10 px-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all"
                                    >
                                      -{formData.serviceType === "DOG_WALKING" ? "15" : "30"} min
                                    </motion.button>
                                  )}
                                </div>

                                {/* Bouton supprimer */}
                                {individualDates.length > 1 && (
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => removeIndividualDate(index)}
                                    className="h-10 w-10 bg-red-500 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center"
                                  >
                                    ×
                                  </motion.button>
                                )}
                              </div>

                              {/* Prix de cette ligne */}
                              <div className="mt-2 text-sm text-purple-700 font-semibold text-right">
                                {(() => {
                                  const service = getSelectedService();
                                  if (!service) return null;

                                  let itemPrice = service.price; // Prix de base
                                  const baseDuration = service.baseDuration || 0;
                                  const extraDuration = item.duration - baseDuration;

                                  if (extraDuration > 0) {
                                    const increment = service.durationIncrement || baseDuration;
                                    const extraIncrements = Math.ceil(extraDuration / increment);
                                    const extraRate = service.extraDurationRate || 0;
                                    itemPrice += extraIncrements * extraRate;
                                  }

                                  return `Prix : ${itemPrice}€`;
                                })()}
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        <div className="mt-4 p-3 bg-white/70 rounded-lg border border-purple-200">
                          <p className="text-xs text-purple-700">
                            💡 <span className="font-semibold">
                              {formData.serviceType === "DROP_IN"
                                ? "Durée de base : 30 minutes par visite. Cliquez sur +30min pour prolonger."
                                : "Durée de base : 15 minutes par promenade. Cliquez sur +15min pour prolonger."}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message de vérification des disponibilités */}
                  {((formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") ?
                    (formData.startDate && formData.endDate) :
                    (individualDates.some(d => d.date !== ""))) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl p-5 border-2 ${
                        availabilityStatus.checking
                          ? "bg-blue-50 border-blue-300"
                          : availabilityStatus.available
                          ? "bg-green-50 border-green-300"
                          : "bg-red-50 border-red-300"
                      }`}
                    >
                      {availabilityStatus.checking ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-blue-700 font-medium">
                            Vérification des disponibilités...
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p
                            className={`font-bold text-lg ${
                              availabilityStatus.available ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {availabilityStatus.message}
                          </p>
                          {!availabilityStatus.available && availabilityStatus.unavailableDates.length > 0 && (
                            <div className="text-sm text-red-600 mt-2 bg-white/50 rounded-lg p-3">
                              <p className="font-semibold mb-1">💡 Que faire ?</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>Choisissez d'autres dates disponibles</li>
                                <li>Contactez le gardien pour des dates spéciales</li>
                                <li>Consultez le calendrier des disponibilités</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Aperçu du prix avec détail transparent */}
                  {formData.startDate && formData.endDate &&
                    // Pour BOARDING et DAY_CARE, vérifier les horaires. Pour les autres, pas besoin.
                    ((formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") ?
                      (formData.startTime && formData.endTime) : true) &&
                    calculatePrice() > 0 && availabilityStatus.available && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5"
                    >
                      {(() => {
                        const breakdown = calculatePriceBreakdown();
                        const service = getSelectedService();

                        return (
                          <>
                            <div className="space-y-2 mb-3">
                              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <span className="text-xl">💰</span>
                                Détail du tarif
                              </h3>

                              {/* BOARDING: Hébergement avec nuitées */}
                              {formData.serviceType === "BOARDING" && (
                                <>
                                  {/* Prix de base */}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                      {breakdown.baseNights} nuit{breakdown.baseNights > 1 ? "s" : ""} × {service?.price}€
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      {breakdown.basePrice.toFixed(2)}€
                                    </span>
                                  </div>

                                  {/* Surcharge si applicable */}
                                  {breakdown.surchargeType && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-orange-700">
                                        {breakdown.surchargeType === "demi"
                                          ? `Prolongation (+${breakdown.extraHours.toFixed(0)}h) × 50%`
                                          : `Journée supplémentaire (+${breakdown.extraHours.toFixed(0)}h)`}
                                      </span>
                                      <span className="font-semibold text-orange-700">
                                        +{breakdown.surchargePrice.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}

                                  {/* Tolérance gratuite */}
                                  {breakdown.extraHours > 0 && breakdown.extraHours <= 2 && !breakdown.surchargeType && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-green-700">
                                        ✓ Tolérance +{breakdown.extraHours.toFixed(0)}h gratuite
                                      </span>
                                      <span className="font-semibold text-green-700">
                                        0€
                                      </span>
                                    </div>
                                  )}

                                  {/* Supplément chiot */}
                                  {breakdown.puppySurcharge > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-pink-700 flex items-center gap-2">
                                        <span className="text-lg">🐶</span>
                                        Supplément chiot ({breakdown.baseNights} × 10€)
                                      </span>
                                      <span className="font-semibold text-pink-700">
                                        +{breakdown.puppySurcharge.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* DAY_CARE: Garde de jour */}
                              {formData.serviceType === "DAY_CARE" && (
                                <>
                                  {/* Prix de base */}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                      {breakdown.baseNights} jour{breakdown.baseNights > 1 ? "s" : ""} × {service?.price}€
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      {breakdown.basePrice.toFixed(2)}€
                                    </span>
                                  </div>

                                  {/* Heures totales avec info 10h */}
                                  {breakdown.extraHours > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-blue-700 text-xs">
                                        ℹ️ Durée totale: {(breakdown.baseNights * 10 + breakdown.extraHours).toFixed(0)}h
                                        {breakdown.extraHours > 0 && ` (10h incluses + ${breakdown.extraHours.toFixed(0)}h sup.)`}
                                      </span>
                                    </div>
                                  )}

                                  {/* Heures supplémentaires si > 10h */}
                                  {breakdown.surchargeType === "hourly" && breakdown.surchargePrice > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-orange-700">
                                        +{breakdown.extraHours.toFixed(0)}h au-delà de 10h × {service?.extraHourlyRate}€/h
                                      </span>
                                      <span className="font-semibold text-orange-700">
                                        +{breakdown.surchargePrice.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}

                                  {/* Supplément chiot */}
                                  {breakdown.puppySurcharge > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-pink-700 flex items-center gap-2">
                                        <span className="text-lg">🐶</span>
                                        Supplément chiot ({breakdown.baseNights} × 10€)
                                      </span>
                                      <span className="font-semibold text-pink-700">
                                        +{breakdown.puppySurcharge.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* DROP_IN: Visite à domicile */}
                              {formData.serviceType === "DROP_IN" && (
                                <>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                      {breakdown.baseNights} visite{breakdown.baseNights > 1 ? "s" : ""} × {service?.price}€ (30 min chacune)
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      {breakdown.basePrice.toFixed(2)}€
                                    </span>
                                  </div>

                                  {/* Supplément de durée */}
                                  {breakdown.surchargePrice > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-orange-700">
                                        Suppléments de durée (+30 min)
                                      </span>
                                      <span className="font-semibold text-orange-700">
                                        +{breakdown.surchargePrice.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}

                                  {/* Supplément chiot */}
                                  {breakdown.puppySurcharge > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-pink-700 flex items-center gap-2">
                                        <span className="text-lg">🐶</span>
                                        Supplément chiot ({breakdown.baseNights} × 10€)
                                      </span>
                                      <span className="font-semibold text-pink-700">
                                        +{breakdown.puppySurcharge.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* DOG_WALKING: Promenade */}
                              {formData.serviceType === "DOG_WALKING" && (
                                <>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                      {breakdown.baseNights} promenade{breakdown.baseNights > 1 ? "s" : ""} × {service?.price}€ (15 min chacune)
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      {breakdown.basePrice.toFixed(2)}€
                                    </span>
                                  </div>

                                  {/* Supplément de durée */}
                                  {breakdown.surchargePrice > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-orange-700">
                                        Suppléments de durée (+15 min)
                                      </span>
                                      <span className="font-semibold text-orange-700">
                                        +{breakdown.surchargePrice.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}

                                  {/* Supplément chiot */}
                                  {breakdown.puppySurcharge > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-pink-700 flex items-center gap-2">
                                        <span className="text-lg">🐶</span>
                                        Supplément chiot ({breakdown.baseNights} × 10€)
                                      </span>
                                      <span className="font-semibold text-pink-700">
                                        +{breakdown.puppySurcharge.toFixed(2)}€
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Section Code Promo (Masqué pour promenades et visites) */}
                            {formData.serviceType !== "DROP_IN" && formData.serviceType !== "DOG_WALKING" && (
                              <div className="border-t-2 border-green-200 py-3 mt-2">
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor="promoCodeStep2" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <span>🎟️</span> Code promo
                                  </Label>
                                  <div className="flex gap-2">
                                    <Input
                                      id="promoCodeStep2"
                                      value={formData.promoCode}
                                      onChange={(e) => {
                                        setFormData({ ...formData, promoCode: e.target.value.toUpperCase() });
                                        if (couponStatus.error) setCouponStatus(prev => ({ ...prev, error: "" }));
                                      }}
                                      placeholder="ENTREZ VOTRE CODE"
                                      className="h-10 text-sm uppercase font-semibold bg-white"
                                      disabled={couponStatus.applied || couponStatus.loading}
                                    />
                                    {!couponStatus.applied ? (
                                      <Button
                                        type="button"
                                        onClick={validateCoupon}
                                        disabled={!formData.promoCode || couponStatus.loading}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 h-10"
                                      >
                                        {couponStatus.loading ? "..." : "Appliquer"}
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        onClick={removeCoupon}
                                        variant="destructive"
                                        size="sm"
                                        className="px-3 h-10"
                                      >
                                        ×
                                      </Button>
                                    )}
                                  </div>
                                  {couponStatus.error && (
                                    <p className="text-xs text-red-600 font-semibold">{couponStatus.error}</p>
                                  )}
                                  {couponStatus.applied && couponStatus.data && (
                                    <div className="text-xs text-green-700 bg-green-100 p-2 rounded border border-green-200 mt-1">
                                      ✅ Code <strong>{couponStatus.data.code}</strong> appliqué : -{couponStatus.data.discountAmount.toFixed(2)}€
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="border-t-2 border-green-300 pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-lg font-bold text-gray-900">Total</span>
                                <div className="text-right">
                                  {couponStatus.applied && couponStatus.data ? (
                                    <>
                                      <span className="text-sm text-gray-500 line-through mr-2 block">{breakdown.totalPrice.toFixed(2)}€</span>
                                      <span className="text-3xl font-bold text-green-700">{couponStatus.data.finalAmount.toFixed(2)}€</span>
                                    </>
                                  ) : (
                                    <span className="text-3xl font-bold text-green-700">
                                      {breakdown.totalPrice.toFixed(2)}€
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Info pédagogique selon le type de service */}
                            <div className="mt-3 bg-white/50 rounded-lg p-3 border border-green-200">
                              <p className="text-xs text-gray-700">
                                {formData.serviceType === "BOARDING" && (
                                  <>
                                    <span className="font-semibold">ℹ️ Règle des 24h:</span> 1 nuit = 24h de garde.
                                    Tolérance de 2h offerte. Au-delà: +50% jusqu'à 8h, puis tarif plein journée.
                                  </>
                                )}
                                {formData.serviceType === "DAY_CARE" && (
                                  <>
                                    <span className="font-semibold">ℹ️ Garde de jour:</span> Le forfait jour couvre jusqu'à 10h de garde.
                                    Au-delà: {service?.extraHourlyRate}€/h supplémentaire pour protéger le gardien.
                                  </>
                                )}
                                {(formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") && (
                                  <>
                                    <span className="font-semibold">ℹ️ {service?.name}:</span> Prix unitaire par {service?.unit}.
                                  </>
                                )}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      onClick={() => setStep(1)}
                      variant="outline"
                      className="flex-1 border-2 border-gray-300 hover:bg-gray-100 font-semibold"
                      size="lg"
                    >
                      ← Retour
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={
                        (formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE")
                          ? (!formData.startDate || !formData.endDate || !availabilityStatus.available || availabilityStatus.checking)
                          : (individualDates.filter(d => d.date !== "").length === 0 || !availabilityStatus.available || availabilityStatus.checking)
                      }
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      {availabilityStatus.checking ? "Vérification..." : "Continuer →"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Étape 3: Récapitulatif */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    3. Réservation pour {pets.find(p => p.id === formData.petId)?.name || "votre compagnon"} 📝
                  </h2>

                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-6 border-2 border-orange-200">
                    <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📋</span>
                      Récapitulatif de votre réservation
                    </h3>
                    <div className="space-y-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold min-w-[80px]">Animal:</span>
                        <span>{pets.find((p) => p.id === formData.petId)?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold min-w-[80px]">Service:</span>
                        <span>{getSelectedService()?.name}</span>
                      </div>

                      {/* Pour BOARDING et DAY_CARE : afficher période */}
                      {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold min-w-[80px]">Du:</span>
                            <span>{new Date(formData.startDate).toLocaleDateString("fr-FR")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold min-w-[80px]">Au:</span>
                            <span>{new Date(formData.endDate).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </>
                      )}

                      {/* Pour DROP_IN et DOG_WALKING : afficher liste des dates */}
                      {(formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") && (
                        <div className="space-y-2">
                          <span className="font-semibold">Dates sélectionnées:</span>
                          <div className="ml-4 space-y-1">
                            {individualDates.filter(d => d.date !== "").map((item, index) => (
                              <div key={index} className="flex items-center justify-between text-sm bg-white px-3 py-2 rounded-lg border border-purple-200">
                                <span>{new Date(item.date).toLocaleDateString("fr-FR", { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                                <span className="font-semibold text-purple-700">{item.duration} min</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t-2 border-orange-300 mt-4 pt-4">
                        {/* Affichage adapté selon le type de service */}
                        {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") ? (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">Durée:</span>
                              <span className="font-bold text-gray-900">
                                {calculateDays()} {getSelectedService()?.unit}
{calculateDays() > 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">Prix unitaire:</span>
                              <span className="font-bold text-gray-900">
                                {getSelectedService()?.price}€/{getSelectedService()?.unit}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">Nombre total:</span>
                              <span className="font-bold text-gray-900">
                                {individualDates.filter(d => d.date !== "").length} {getSelectedService()?.unit}
{individualDates.filter(d => d.date !== "").length > 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">Prix unitaire:</span>
                              <span className="font-bold text-gray-900">
                                {getSelectedService()?.price}€/{getSelectedService()?.unit}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Prix avec gestion du coupon */}
                        {couponStatus.applied && couponStatus.data ? (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-base font-semibold text-gray-700">Sous-total:</span>
                              <span className="text-xl font-semibold text-gray-700">
                                {calculatePrice().toFixed(2)}€
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-orange-300">
                              <span className="text-base font-semibold text-green-700 flex items-center gap-2">
                                <span>🎟️</span>
                                Code promo ({couponStatus.data.code}):
                              </span>
                              <span className="text-xl font-bold text-green-700">
                                -{couponStatus.data.discountAmount.toFixed(2)}€
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xl font-bold text-orange-600">Total final:</span>
                              <span className="text-3xl font-bold text-orange-600">
                                {couponStatus.data.finalAmount.toFixed(2)}€
                              </span>
                            </div>
                            <div className="bg-white/70 rounded-lg p-3 border border-orange-200">
                              <p className="text-sm text-gray-700 mb-1">
                                <span className="font-semibold">Montant à régler maintenant:</span>{" "}
                                <span className="text-lg font-bold text-green-600">
                                  {couponStatus.data.finalAmount.toFixed(2)}€
                                </span>
                              </p>
                              <p className="text-xs text-green-600 mt-2 font-semibold">
                                ✨ Vous économisez {couponStatus.data.discountAmount.toFixed(2)}€ avec ce code promo!
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xl font-bold text-orange-600">Total:</span>
                              <span className="text-3xl font-bold text-orange-600">
                                {calculatePrice()}€
                              </span>
                            </div>
                            <div className="bg-white/70 rounded-lg p-3 border border-orange-200">
                              <p className="text-sm text-gray-700 mb-1">
                                <span className="font-semibold">Montant à régler maintenant:</span>{" "}
                                <span className="text-lg font-bold text-green-600">
                                  {calculatePrice().toFixed(2)}€
                                </span>
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Code promo - Affichage seulement si appliqué */}
                  {couponStatus.applied && couponStatus.data && (
                    <div className="p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-2xl border-2 border-purple-200">
                      <Label className="text-gray-900 font-bold text-lg flex items-center gap-2 mb-4">
                        <span className="text-2xl">🎟️</span>
                        Code promo appliqué
                      </Label>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-0 p-5 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-xl shadow-md"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                              ✓
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-green-900 text-lg">
                                  {couponStatus.data.code}
                                </span>
                                {couponStatus.isAuto && (
                                  <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold rounded-full shadow-md">
                                    ⭐ VIP
                                  </span>
                                )}
                              </div>
                              {couponStatus.data.description && (
                                <p className="text-sm text-green-700 mt-1">
                                  {couponStatus.data.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 bg-white/70 rounded-lg">
                            <span className="text-sm text-gray-700 font-semibold">
                              {couponStatus.data.message}
                            </span>
                            <span className="text-lg font-bold text-green-700">
                              -{couponStatus.data.discountAmount.toFixed(2)}€
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes" className="text-gray-700 font-semibold">
                      Notes supplémentaires (optionnel)
                    </Label>
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Informations importantes sur votre animal, habitudes alimentaires, médicaments..."
                      className="mt-2 w-full border-2 border-orange-200 rounded-xl p-3 focus:border-orange-400 outline-none h-32 text-gray-900"
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      onClick={() => setStep(2)}
                      variant="outline"
                      className="flex-1 border-2 border-gray-300 hover:bg-gray-100 font-semibold"
                      size="lg"
                    >
                      ← Retour
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setStep(4)}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600"
                      size="lg"
                    >
                      Continuer vers le paiement 💳
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Étape 4: Paiement par carte bancaire */}
              {step === 4 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    4. Paiement sécurisé 💳
                  </h2>

                  {/* Récapitulatif du montant à payer */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-300">
                    {couponStatus.applied && couponStatus.data ? (
                      <>
                        <div className="text-center mb-4">
                          <p className="text-sm text-gray-700 mb-2">Montant total à payer</p>
                          <p className="text-5xl font-bold text-green-700">
                            {couponStatus.data.finalAmount.toFixed(2)}€
                          </p>
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-gray-500 line-through">
                              Total original: {calculatePrice().toFixed(2)}€
                            </p>
                            <p className="text-sm text-green-700 font-semibold flex items-center justify-center gap-2">
                              <span>🎟️</span>
                              Avec code {couponStatus.data.code}
                            </p>
                            <p className="text-xs text-green-600 font-bold">
                              ✨ Vous économisez {couponStatus.data.discountAmount.toFixed(2)}€!
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center mb-4">
                          <p className="text-sm text-gray-700 mb-2">Montant total à payer</p>
                          <p className="text-5xl font-bold text-green-700">
                            {calculatePrice().toFixed(2)}€
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Système "Uber" expliqué */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-300">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        💳
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">
                          Paiement par carte bancaire (Stripe)
                        </h3>
                        <p className="text-sm text-gray-700">
                          Votre carte sera enregistrée de manière sécurisée pour une meilleure expérience
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 bg-white/70 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-blue-600 text-xl">✓</span>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Paiement unique maintenant</span> - Vous payez le montant total de la réservation
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-blue-600 text-xl">✓</span>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Carte enregistrée</span> - Pour d'éventuels suppléments (retards, extras...)
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-blue-600 text-xl">✓</span>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Système "Uber"</span> - Suppléments automatiquement débités sans ressaisir votre carte
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-blue-600 text-xl">🔒</span>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">100% sécurisé</span> - Vos données bancaires sont protégées par Stripe (certifié PCI-DSS)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exemple concret */}
                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-5">
                    <p className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                      <span className="text-xl">💡</span>
                      Exemple : Comment ça marche ?
                    </p>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 font-bold">1.</span>
                        Vous payez {couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount.toFixed(2) : calculatePrice().toFixed(2)}€ maintenant pour confirmer votre réservation
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 font-bold">2.</span>
                        Votre carte est enregistrée de manière sécurisée (vous voyez les 4 derniers chiffres)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 font-bold">3.</span>
                        Si besoin d'un supplément (retard, visite véto...), on débite automatiquement votre carte
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 font-bold">4.</span>
                        Vous recevez une facture détaillée par email à chaque débit
                      </li>
                    </ul>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      onClick={() => setStep(3)}
                      variant="outline"
                      className="flex-1 border-2 border-gray-300 hover:bg-gray-100 font-semibold"
                      size="lg"
                    >
                      ← Retour
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Redirection vers Stripe...</span>
                        </div>
                      ) : (
                        "Payer par carte bancaire 💳"
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
