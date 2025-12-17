"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppNav } from "@/components/layout/AppNav";

// On reprend les mêmes types de service
const serviceTypes = [
  {
    value: "BOARDING",
    name: "Hébergement",
    price: 22,
    unit: "jour",
    description: "Votre chien vit avec nous, accès canapé et jardin inclus.",
    icon: "🏠",
    maxHours: 24,
    extraHourlyRate: 3,
  },
  {
    value: "DAY_CARE",
    name: "Garderie Jour",
    price: 25,
    unit: "jour",
    description: "Déposez-le le matin, récupérez-le le soir.",
    icon: "☀️",
    maxHours: 10,
    extraHourlyRate: 3,
  },
  {
    value: "DROP_IN",
    name: "Visite à domicile",
    price: 20,
    unit: "visite",
    description: "Visite de 30 min pour les chats et chiens indépendants.",
    icon: "🚪",
    baseDuration: 30,
    extraDurationRate: 15,
    durationIncrement: 30,
  },
  {
    value: "DOG_WALKING",
    name: "Promenade",
    price: 15,
    unit: "promenade",
    description: "Balade de 15 min dans le quartier.",
    icon: "🦮",
    baseDuration: 15,
    extraDurationRate: 10,
    durationIncrement: 15,
  },
];

interface Pet {
  id: string;
  name: string;
  breed: string;
  age?: number | null;
}

export default function BookingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // États
  const [step, setStep] = useState(1);
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Disponibilités
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

  // Formulaire
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
    startTime: "18:00",
    endTime: "10:00",
    serviceType: "BOARDING",
    notes: "",
    promoCode: "",
  });

  // Dates individuelles (Visites/Promenades)
  const [individualDates, setIndividualDates] = useState<Array<{ date: string; duration: number }>>([
    { date: "", duration: 30 },
  ]);

  // Coupons
  const [couponStatus, setCouponStatus] = useState<{
    applied: boolean;
    loading: boolean;
    isAuto: boolean;
    data: null | {
      coupon: {
        code: string;
        description?: string | null;
        discountType: "PERCENTAGE" | "FIXED_AMOUNT";
        discountValue: number;
      };
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

  // --- LOGIQUE (Gardée intacte, juste nettoyée pour la concision) ---
  
  // Auth Check
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  // Fetch Pets
  useEffect(() => {
    const fetchPets = async () => {
      const res = await fetch("/api/pets");
      if (res.ok) {
        const data = await res.json();
        setPets(data.pets || []);
      }
    };
    fetchPets();
  }, []);

  // Update duration default when service changes
  useEffect(() => {
    const defaultDuration = formData.serviceType === "DOG_WALKING" ? 15 : 30;
    setIndividualDates([{ date: "", duration: defaultDuration }]);
  }, [formData.serviceType]);

  // Auto Coupon
  useEffect(() => {
    if (step >= 2 && !couponStatus.applied) {
      fetchAutoCoupon();
    }
  }, [step]);

  // Auto Re-validate Coupon
  useEffect(() => {
    if (formData.promoCode && calculatePrice() > 0) {
      const timer = setTimeout(() => validateCoupon(), 500);
      return () => clearTimeout(timer);
    }
  }, [formData.startDate, formData.endDate, formData.startTime, formData.endTime, individualDates, formData.serviceType]);

  // Check Availability
  useEffect(() => {
    const check = async () => {
      // Logic for DROP_IN / WALKING
      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
        const validDates = individualDates.filter(d => d.date !== "");
        if (validDates.length === 0) {
          resetAvailability(); return;
        }
        setAvailabilityStatus(p => ({ ...p, checking: true }));
        try {
          const checks = await Promise.all(validDates.map(async (item) => {
            const res = await fetch(`/api/availability/check?startDate=${item.date}&endDate=${item.date}&serviceType=${formData.serviceType}`);
            return { date: item.date, available: res.ok ? (await res.json()).available : false };
          }));
          const unavailable = checks.filter(c => !c.available);
          if (unavailable.length === 0) {
            setAvailabilityStatus({ checking: false, available: true, message: "✅ Disponible", unavailableDates: [] });
          } else {
            setAvailabilityStatus({ checking: false, available: false, message: "❌ Certaines dates sont indisponibles", unavailableDates: unavailable.map(d => d.date) });
          }
        } catch (e) { resetAvailability(); }
        return;
      }

      // Logic for BOARDING / DAY_CARE
      if (!formData.startDate || !formData.endDate) {
        resetAvailability(); return;
      }
      
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        setAvailabilityStatus({ checking: false, available: false, message: "Date de fin incorrecte", unavailableDates: [] });
        return;
      }

      if (formData.startDate === formData.endDate && formData.endTime <= formData.startTime) {
        setAvailabilityStatus({ checking: false, available: false, message: "Heure de fin incorrecte", unavailableDates: [] });
        return;
      }

      setAvailabilityStatus(p => ({ ...p, checking: true }));
      try {
        const res = await fetch(`/api/availability/check?startDate=${formData.startDate}&endDate=${formData.endDate}&serviceType=${formData.serviceType}`);
        if (res.ok) {
          const data = await res.json();
          if (data.available) setAvailabilityStatus({ checking: false, available: true, message: "✅ Disponible", unavailableDates: [] });
          else setAvailabilityStatus({ checking: false, available: false, message: "❌ Dates indisponibles", unavailableDates: data.unavailableDates });
        }
      } catch (e) { resetAvailability(); }
    };
    check();
  }, [formData.startDate, formData.endDate, formData.serviceType, individualDates, formData.startTime, formData.endTime]);

  const resetAvailability = () => setAvailabilityStatus({ checking: false, available: true, message: "", unavailableDates: [] });

  // Helpers
  const getSelectedService = () => serviceTypes.find(s => s.value === formData.serviceType);
  
  const calculatePriceBreakdown = () => {
    const defaultResult = { baseNights: 0, extraHours: 0, surchargeType: null as any, basePrice: 0, surchargePrice: 0, puppySurcharge: 0, totalPrice: 0, detail: "" };

    if (!formData.startDate || !formData.endDate) return defaultResult;
    const service = getSelectedService();
    if (!service) return defaultResult;

    const selectedPet = pets.find(p => p.id === formData.petId);
    const isPuppy = selectedPet && selectedPet.age !== undefined && selectedPet.age !== null && selectedPet.age < 1;
    const puppyDailyRate = 10;

    if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
      const validDates = individualDates.filter(d => d.date !== "");
      const days = validDates.length;
      let totalBasePrice = 0;
      let totalSurcharge = 0;

      validDates.forEach(item => {
        totalBasePrice += service.price;
        const extraDuration = item.duration - (service.baseDuration || 0);
        if (extraDuration > 0) {
          const increment = service.durationIncrement || 1;
          const extraIncrements = Math.ceil(extraDuration / increment);
          totalSurcharge += extraIncrements * (service.extraDurationRate || 0);
        }
      });

      const puppySurcharge = isPuppy ? days * puppyDailyRate : 0;
      const total = totalBasePrice + totalSurcharge + puppySurcharge;

      return {
        ...defaultResult,
        baseNights: days,
        basePrice: totalBasePrice,
        surchargePrice: totalSurcharge,
        puppySurcharge,
        totalPrice: total,
      };
    }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

    // Boarding logic
    if (formData.serviceType === "BOARDING") {
      const baseNights = Math.floor(totalHours / 24);
      const extraHours = totalHours % 24;
      const basePrice = baseNights * service.price;
      
      let surchargePrice = 0;
      let surchargeType = null;

      if (extraHours > 8) {
        surchargePrice = service.price;
        surchargeType = "plein";
      } else if (extraHours > 2) {
        surchargePrice = service.price * 0.5;
        surchargeType = "demi";
      }

      const puppySurcharge = isPuppy ? baseNights * puppyDailyRate : 0;
      const total = basePrice + surchargePrice + puppySurcharge;

      return {
        baseNights,
        extraHours,
        surchargeType,
        basePrice,
        surchargePrice,
        puppySurcharge,
        totalPrice: total,
        detail: "",
      };
    }

    // Day Care logic
    if (formData.serviceType === "DAY_CARE") {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      let basePrice = days * service.price;
      let surchargePrice = 0;
      
      if (days === 1 && totalHours > (service.maxHours || 10)) {
        surchargePrice = (totalHours - (service.maxHours || 10)) * (service.extraHourlyRate || 0);
      }
      
      const puppySurcharge = isPuppy ? days * puppyDailyRate : 0;
      
      return {
        ...defaultResult,
        baseNights: days,
        basePrice,
        surchargePrice,
        puppySurcharge,
        totalPrice: basePrice + surchargePrice + puppySurcharge,
      };
    }

    return defaultResult;
  };

  const calculatePrice = () => calculatePriceBreakdown().totalPrice || 0;

  const calculateDays = () => {
    if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
      return individualDates.filter(d => d.date !== "").length;
    }
    if (!formData.startDate || !formData.endDate) return 1;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays || 1;
  };

  const formatPrice = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
  };

  // API Calls
  const fetchAutoCoupon = async () => {
    try {
      const res = await fetch("/api/coupons/auto");
      if (res.ok) {
        const data = await res.json();
        if (data.autoCoupon) {
          setFormData(p => ({ ...p, promoCode: data.autoCoupon.code }));
          setCouponStatus(p => ({ ...p, isAuto: true }));
          const price = calculatePrice();
          if (price > 0) validateCoupon();
          else {
             setCouponStatus({ 
               applied: true, 
               loading: false, 
               isAuto: true, 
               data: { 
                 coupon: {
                   code: data.autoCoupon.code,
                   description: data.autoCoupon.description,
                   discountType: data.autoCoupon.discountType,
                   discountValue: data.autoCoupon.discountValue,
                 },
                 discountAmount: 0, 
                 finalAmount: 0, 
                 message: "Réduction VIP dispo" 
               }, 
               error: "" 
             });
          }
        }
      }
    } catch (e) {}
  };

  const validateCoupon = async () => {
    const price = calculatePrice();
    if (!formData.promoCode) return;
    if (price === 0) {
      setCouponStatus(p => ({ ...p, error: "Sélectionnez d'abord les dates" }));
      return;
    }
    setCouponStatus(p => ({ ...p, loading: true, error: "" }));
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: formData.promoCode, totalAmount: price, serviceType: formData.serviceType, duration: calculateDays() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCouponStatus({ applied: true, loading: false, isAuto: couponStatus.isAuto, data: data, error: "" });
      } else {
        console.error("Erreur coupon API:", data.error);
        setCouponStatus({ applied: false, loading: false, isAuto: false, data: null, error: data.error || "Code invalide" });
      }
    } catch (e) { setCouponStatus(p => ({ ...p, loading: false, error: "Erreur validation" })); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const price = couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculatePrice();
    
    // Dates calculation for Drop In
    let startDate = formData.startDate;
    let endDate = formData.endDate;
    let startTime = formData.startTime;
    let endTime = formData.endTime;

    if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
      const valid = individualDates.filter(d => d.date !== "").map(d => d.date).sort();
      if (valid.length > 0) { startDate = valid[0]; endDate = valid[valid.length - 1]; startTime = "09:00"; endTime = "18:00"; }
    }

    try {
      const resBooking = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, startDate, endDate, startTime, endTime, totalPrice: price, depositAmount: price }),
      });
      const dataBooking = await resBooking.json();
      if (!resBooking.ok) throw new Error(dataBooking.error);

      const resCheckout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: dataBooking.booking.id }),
      });
      const dataCheckout = await resCheckout.json();
      if (!resCheckout.ok) throw new Error(dataCheckout.error);

      window.location.href = dataCheckout.checkoutUrl;
    } catch (e: any) { setError(e.message); setIsLoading(false); }
  };

  // Get today's date for min attribute
  const today = new Date().toISOString().split("T")[0];

  // --- RENDER ---
  if (status === "loading") return <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">🐕</div>;

  const currentPetName = pets.find(p => p.id === formData.petId)?.name || "votre compagnon";

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />
      
      <div className="container mx-auto px-6 pt-32 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Nouvelle Réservation ✨</h1>
          <p className="text-gray-500">Quelques étapes pour des vacances de rêve.</p>
        </motion.div>

        {/* Steps */}
        <div className="flex justify-center mb-12">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <motion.div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? "bg-gray-900 text-white shadow-lg" : "bg-gray-200 text-gray-500"}`}
                animate={{ scale: step === s ? 1.2 : 1 }}
              >
                {s}
              </motion.div>
              {s < 4 && <div className={`w-16 h-1 rounded-full mx-2 ${step > s ? "bg-gray-900" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-center border border-red-100 font-medium">
            ❌ {error}
          </div>
        )}

        {/* Card Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-12"
        >
          <form 
            onSubmit={handleSubmit} 
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
            className="space-y-8"
          >
            
            {/* STEP 1: PET */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Pour qui est ce séjour ?</h2>
                {pets.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 mb-4">Vous n'avez pas encore de compagnon enregistré.</p>
                    <Link href="/pets/new" className="text-orange-600 font-bold hover:underline">Créer un profil →</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {pets.map((pet) => (
                      <div
                        key={pet.id}
                        onClick={() => setFormData({ ...formData, petId: pet.id })}
                        className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex items-center gap-4 ${formData.petId === pet.id ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200" : "border-gray-100 hover:border-gray-300"}`}
                      >
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">🐕</div>
                        <span className="font-bold text-gray-900">{pet.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" onClick={() => setStep(2)} disabled={!formData.petId} className="w-full h-14 rounded-xl text-lg bg-gray-900 hover:bg-orange-600">Continuer</Button>
              </div>
            )}

            {/* STEP 2: SERVICE & DATES */}
            {step === 2 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900">Programme pour {currentPetName}</h2>
                
                {/* Services Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  {serviceTypes.map((s) => (
                    <div
                      key={s.value}
                      onClick={() => setFormData({ ...formData, serviceType: s.value as any })}
                      className={`cursor-pointer p-6 rounded-2xl border-2 transition-all ${formData.serviceType === s.value ? "border-orange-500 bg-orange-50 shadow-md" : "border-gray-100 hover:border-gray-300"}`}
                    >
                      <div className="text-3xl mb-2">{s.icon}</div>
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-gray-900">{s.name}</h3>
                        <div className="font-bold text-orange-600">{s.price}€</div>
                      </div>
                      <p className="text-xs text-gray-500">{s.description.replace("Votre chien", currentPetName)}</p>
                    </div>
                  ))}
                </div>

                {/* Dates Inputs */}
                <div className="bg-gray-50 p-6 rounded-3xl space-y-4">
                  {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Début</Label>
                        <Input type="date" className="bg-white border-gray-200 h-12 rounded-xl" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} min={today} />
                        <Input type="time" className="bg-white border-gray-200 h-12 rounded-xl mt-2" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
                      </div>
                      <div>
                        <Label>Fin</Label>
                        <Input type="date" className="bg-white border-gray-200 h-12 rounded-xl" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} min={formData.startDate || today} />
                        <Input type="time" className="bg-white border-gray-200 h-12 rounded-xl mt-2" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
                      </div>
                    </div>
                  ) : (
                    // Drop In / Walking Logic (Simplified UI for brevity)
                    <div className="text-center p-4">
                      <p className="text-gray-500">Sélectionnez vos dates ci-dessous</p>
                      {individualDates.map((item, idx) => (
                        <div key={idx} className="flex gap-2 mt-2">
                          <Input type="date" className="bg-white rounded-xl" value={item.date} onChange={(e) => { const n = [...individualDates]; n[idx].date = e.target.value; setIndividualDates(n); }} />
                          <Button type="button" variant="outline" onClick={() => { const n = [...individualDates]; n.splice(idx, 1); setIndividualDates(n); }}>×</Button>
                        </div>
                      ))}
                      <Button type="button" variant="ghost" onClick={() => setIndividualDates([...individualDates, { date: "", duration: 30 }])} className="mt-2 text-orange-600">+ Ajouter une date</Button>
                    </div>
                  )}
                  
                  {/* Availability Message */}
                  {availabilityStatus.message && (
                    <div className={`text-center text-sm font-bold ${availabilityStatus.available ? "text-green-600" : "text-red-500"}`}>
                      {availabilityStatus.checking ? "Vérification..." : availabilityStatus.message}
                    </div>
                  )}
                </div>

                {/* Price Preview */}
                {calculatePrice() > 0 && availabilityStatus.available && (
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-3xl flex justify-between items-center shadow-lg">
                    <div>
                      <p className="text-gray-400 text-sm">Total estimé</p>
                      <div className="flex items-baseline gap-3">
                        {couponStatus.applied && couponStatus.data ? (
                          <>
                            <span className="text-lg text-gray-500 line-through decoration-red-500/50 decoration-2">
                              {formatPrice(calculatePrice())}€
                            </span>
                            <span className="text-3xl font-bold text-green-400">
                              {formatPrice(couponStatus.data.finalAmount)}€
                            </span>
                          </>
                        ) : (
                          <span className="text-3xl font-bold">
                            {formatPrice(calculatePrice())}€
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Promo Code Input (Mini) */}
                    {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                      <div className="flex flex-col items-end">
                        <div className="flex gap-2 items-center">
                          <Input 
                            placeholder="CODE PROMO" 
                            className="bg-white/10 border-none text-white placeholder:text-gray-500 w-28 uppercase text-sm h-10"
                            value={formData.promoCode}
                            onChange={(e) => setFormData({...formData, promoCode: e.target.value.toUpperCase()})} 
                          />
                          <Button 
                            type="button" 
                            size="sm" 
                            onClick={validateCoupon}
                            disabled={!formData.promoCode || couponStatus.loading}
                            className={`h-10 px-3 rounded-lg transition-all ${couponStatus.applied ? "bg-green-500 hover:bg-green-600" : "bg-white/20 hover:bg-white/30"}`}
                          >
                            {couponStatus.loading ? "..." : couponStatus.applied ? "✓" : "OK"}
                          </Button>
                        </div>
                        {couponStatus.error && (
                          <p className="text-red-400 text-xs font-bold mt-1 text-right max-w-[200px]">
                            {couponStatus.error}
                          </p>
                        )}
                        {couponStatus.applied && couponStatus.data && (
                           <p className="text-green-400 text-xs font-bold mt-1 text-right">
                             {couponStatus.data.coupon.discountType === "PERCENTAGE" ? `-${couponStatus.data.coupon.discountValue}%` : `-${couponStatus.data.coupon.discountValue}€`} économisés !
                           </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-14 rounded-xl">Retour</Button>
                  <Button type="button" onClick={() => setStep(3)} disabled={!availabilityStatus.available} className="flex-1 h-14 rounded-xl bg-gray-900 hover:bg-orange-600">Suivant</Button>
                </div>
              </div>
            )}

            {/* STEP 3 & 4: Same logic, modernized UI */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Derniers détails 📝</h2>
                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                  <h3 className="font-bold text-orange-900 mb-4">Récapitulatif</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between"><span>Compagnon</span> <strong>{currentPetName}</strong></div>
                    <div className="flex justify-between"><span>Service</span> <strong>{getSelectedService()?.name}</strong></div>
                    
                    {/* Affichage du supplément chiot si applicable */}
                    {(() => {
                      const breakdown = calculatePriceBreakdown();
                      if (breakdown.puppySurcharge > 0) {
                        return (
                          <div className="flex justify-between text-orange-600">
                            <span>Supplément Chiot (-1 an)</span>
                            <strong>+{formatPrice(breakdown.puppySurcharge)}€</strong>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {couponStatus.applied && couponStatus.data ? (
                      <>
                        <div className="flex justify-between pt-2 mt-2 border-t border-orange-200/50">
                          <span>Sous-total</span> 
                          <span className="text-gray-500 line-through">{formatPrice(calculatePrice())}€</span>
                        </div>
                        <div className="flex justify-between text-green-600 font-bold">
                          <span>Réduction ({couponStatus.data.coupon.code})</span> 
                          <span>-{formatPrice(calculatePrice() - couponStatus.data.finalAmount)}€</span>
                        </div>
                        <div className="flex justify-between border-t border-orange-200 pt-2 mt-2">
                          <span className="font-bold text-gray-900">Total à payer</span>
                          <strong className="text-xl text-green-600">{formatPrice(couponStatus.data.finalAmount)}€</strong>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between border-t border-orange-200 pt-2 mt-2">
                        <span>Total à payer</span>
                        <strong className="text-xl text-orange-700">{formatPrice(calculatePrice())}€</strong>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label>Instructions spéciales</Label>
                  <textarea 
                    className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl h-32 focus:ring-orange-500 focus:border-orange-500 mt-2" 
                    placeholder="Allergies, habitudes, jouet préféré..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 h-14 rounded-xl">Retour</Button>
                  <Button type="submit" className="flex-1 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30">Payer et Confirmer 💳</Button>
                </div>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}