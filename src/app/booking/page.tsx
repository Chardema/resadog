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
    price: 20,
    unit: "jour",
    description: "Votre chien vit avec nous, accès canapé et jardin inclus.",
    icon: "🏠",
    maxHours: 24,
    extraHourlyRate: 3,
    maxPets: 2,
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
    maxPets: 2,
  },
  {
    value: "DROP_IN",
    name: "Visite à domicile",
    price: 13,
    unit: "visite",
    description: "Visite de 30 min pour les chats et chiens indépendants.",
    icon: "🚪",
    baseDuration: 30,
    extraDurationRate: 15,
    durationIncrement: 30,
    maxPets: 99,
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
    maxPets: 99,
  },
];

interface Pet {
  id: string;
  name: string;
  breed: string;
  age?: number | null;
}

type DateConfig = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  // For Drop-In
  individualDates: { date: string; duration: number }[];
};

// --- COMPOSANT DATE SELECTOR EXTRAIT ---
const DateSelector = ({ config, onChange, serviceType }: { config: DateConfig, onChange: (c: DateConfig) => void, serviceType: string }) => {
    const isHourly = serviceType === "DROP_IN" || serviceType === "DOG_WALKING";
    const today = new Date().toISOString().split("T")[0];

    if (isHourly) {
        return (
           <div className="space-y-2">
               {config.individualDates.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                      <Input type="date" className="bg-white" value={item.date} onChange={(e) => {
                          const n = [...config.individualDates]; n[idx].date = e.target.value;
                          onChange({ ...config, individualDates: n });
                      }} />
                      <Button type="button" variant="outline" onClick={() => {
                           const n = [...config.individualDates]; n.splice(idx, 1);
                           onChange({ ...config, individualDates: n });
                      }}>×</Button>
                  </div>
               ))}
               <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...config, individualDates: [...config.individualDates, { date: "", duration: 30 }] })}>+ Date</Button>
           </div>
        );
    }

    return (
       <div className="grid md:grid-cols-2 gap-4">
           <div>
               <Label>Début</Label>
               <Input type="date" className="bg-white" value={config.startDate} onChange={(e) => onChange({...config, startDate: e.target.value})} min={today} />
               <Input type="time" className="bg-white mt-2" value={config.startTime} onChange={(e) => onChange({...config, startTime: e.target.value})} />
           </div>
           <div>
               <Label>Fin</Label>
               <Input type="date" className="bg-white" value={config.endDate} onChange={(e) => onChange({...config, endDate: e.target.value})} min={config.startDate || today} />
               <Input type="time" className="bg-white mt-2" value={config.endTime} onChange={(e) => onChange({...config, endTime: e.target.value})} />
           </div>
       </div>
    );
};

export default function BookingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // États
  const [step, setStep] = useState(1);
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Configuration dates
  const [useSameDates, setUseSameDates] = useState(true);
  
  // Disponibilités (Global status)
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

  // Formulaire Global (Default Config)
  const [formData, setFormData] = useState<{
    petIds: string[];
    serviceType: "BOARDING" | "DAY_CARE" | "DROP_IN" | "DOG_WALKING";
    notes: string;
    promoCode: string;
    // Default dates
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  }>({
    petIds: [],
    serviceType: "BOARDING",
    notes: "",
    promoCode: "",
    startDate: "",
    endDate: "",
    startTime: "18:00",
    endTime: "10:00",
  });

  // Dates individuelles pour Drop-In (Global)
  const [individualDates, setIndividualDates] = useState<Array<{ date: string; duration: number }>>([
    { date: "", duration: 30 },
  ]);

  // Configurations individuelles par animal (si useSameDates = false)
  const [petConfigs, setPetConfigs] = useState<Record<string, DateConfig>>({});

  // Initialize pet configs when pets change
  useEffect(() => {
    const initialConfig: Record<string, DateConfig> = {};
    formData.petIds.forEach(id => {
       if (!petConfigs[id]) {
           initialConfig[id] = {
               startDate: formData.startDate,
               endDate: formData.endDate,
               startTime: formData.startTime,
               endTime: formData.endTime,
               individualDates: [...individualDates]
           };
       } else {
           initialConfig[id] = petConfigs[id];
       }
    });
    setPetConfigs(initialConfig);
  }, [formData.petIds, useSameDates]); // Re-sync when switching mode

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

  // --- LOGIQUE ---
  
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

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
    
    // Reset configs
    const newConfigs = { ...petConfigs };
    Object.keys(newConfigs).forEach(k => {
        newConfigs[k].individualDates = [{ date: "", duration: defaultDuration }];
    });
    setPetConfigs(newConfigs);
  }, [formData.serviceType]);

  // Check Availability
  useEffect(() => {
    const check = async () => {
      const configsToCheck: {petIds: string[], config: DateConfig}[] = [];
      
      if (useSameDates) {
          configsToCheck.push({ 
              petIds: formData.petIds, 
              config: { 
                  startDate: formData.startDate, 
                  endDate: formData.endDate, 
                  startTime: formData.startTime, 
                  endTime: formData.endTime, 
                  individualDates 
              } 
          });
      } else {
          formData.petIds.forEach(id => {
              if (petConfigs[id]) {
                  configsToCheck.push({ petIds: [id], config: petConfigs[id] });
              }
          });
      }

      if (configsToCheck.length === 0) { resetAvailability(); return; }

      setAvailabilityStatus(p => ({ ...p, checking: true }));
      let allAvailable = true;
      let globalMessage = "";
      let allUnavailableDates: string[] = [];

      for (const item of configsToCheck) {
          const { config } = item;
          
          // Validation de base des dates
          if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
              if (config.individualDates.filter(d => d.date !== "").length === 0) {
                  // Pas bloquant si vide au début, mais bloquant pour la soumission
                  continue; 
              }
          } else {
              if (!config.startDate || !config.endDate) {
                  // Incomplet = pas prêt
                  continue; 
              }
              if (new Date(config.endDate) < new Date(config.startDate)) {
                  allAvailable = false; 
                  globalMessage = "Dates incorrectes (Fin avant Début)"; 
                  break; // Stop checking, strict fail
              }
          }

          try {
             // ... (API check logic remains)
             let datesToCheck: string[] = [];
             if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
                 datesToCheck = config.individualDates.filter(d => d.date !== "").map(d => d.date);
             } else {
                 datesToCheck = [config.startDate, config.endDate];
             }

             if (datesToCheck.length === 0) continue;

             const start = formData.serviceType === "DROP_IN" ? datesToCheck[0] : config.startDate;
             const end = formData.serviceType === "DROP_IN" ? datesToCheck[datesToCheck.length-1] : config.endDate;

             const res = await fetch(`/api/availability/check?startDate=${start}&endDate=${end}&serviceType=${formData.serviceType}`);
             if (res.ok) {
                 const data = await res.json();
                 if (!data.available) {
                     allAvailable = false;
                     allUnavailableDates.push(...data.unavailableDates);
                     globalMessage = "Certaines dates sont indisponibles";
                 }
             } else {
                 allAvailable = false;
                 globalMessage = "Erreur vérification";
             }
          } catch(e) { allAvailable = false; globalMessage = "Erreur connexion"; }
      }
      
      if (allAvailable && globalMessage === "") {
          setAvailabilityStatus({ checking: false, available: true, message: "✅ Disponible", unavailableDates: [] });
      } else {
          setAvailabilityStatus({ checking: false, available: false, message: globalMessage || "❌ Indisponible", unavailableDates: allUnavailableDates });
      }
    };

    const timer = setTimeout(check, 800);
    return () => clearTimeout(timer);
  }, [formData, individualDates, petConfigs, useSameDates]);

  const resetAvailability = () => setAvailabilityStatus({ checking: false, available: true, message: "", unavailableDates: [] });

  const getSelectedService = () => serviceTypes.find(s => s.value === formData.serviceType);
  
  const calculatePriceForConfig = (config: DateConfig, petList: Pet[]) => {
      const service = getSelectedService();
      if (!service) return 0;
      
      let totalPrice = 0;
      const puppyDailyRate = 2;

      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
          const validDates = config.individualDates.filter(d => d.date !== "");
          const days = validDates.length;
          
          let subTotal = 0;
          validDates.forEach(item => {
              subTotal += service.price;
              const extraDuration = item.duration - (service.baseDuration || 0);
              if (extraDuration > 0) {
                 const increment = service.durationIncrement || 1;
                 const extraIncrements = Math.ceil(extraDuration / increment);
                 subTotal += (extraIncrements * (service.extraDurationRate || 0));
              }
          });
          
          totalPrice = subTotal * petList.length;

          // Puppy surcharge
          petList.forEach(p => {
              if (p.age !== undefined && p.age !== null && p.age < 1) {
                  totalPrice += (days * puppyDailyRate);
              }
          });

      } else {
          if (!config.startDate || !config.endDate) return 0;
          const start = new Date(`${config.startDate}T${config.startTime}`);
          const end = new Date(`${config.endDate}T${config.endTime}`);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

          const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          if (totalHours <= 0) return 0;

          if (formData.serviceType === "BOARDING") {
              const baseNights = Math.floor(totalHours / 24);
              const extraHours = totalHours % 24;
              let base = baseNights * service.price;
              if (extraHours > 8) base += service.price;
              else if (extraHours > 2) base += (service.price * 0.5);
              
              totalPrice = base * petList.length;
               
              petList.forEach(p => {
                 if (p.age !== undefined && p.age !== null && p.age < 1) {
                     totalPrice += (baseNights * puppyDailyRate);
                 }
              });

          } else {
             const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
             let base = days * service.price;
             if (days === 1 && totalHours > (service.maxHours || 10)) {
                 base += ((totalHours - (service.maxHours || 10)) * (service.extraHourlyRate || 0));
             }
             
             totalPrice = base * petList.length;

             petList.forEach(p => {
                 if (p.age !== undefined && p.age !== null && p.age < 1) {
                     totalPrice += (days * puppyDailyRate);
                 }
              });
          }
      }
      return totalPrice;
  };

  const calculateTotalPrice = () => {
      if (useSameDates) {
          const selectedPets = pets.filter(p => formData.petIds.includes(p.id));
          return calculatePriceForConfig({
              startDate: formData.startDate,
              endDate: formData.endDate,
              startTime: formData.startTime,
              endTime: formData.endTime,
              individualDates: individualDates
          }, selectedPets);
      } else {
          let total = 0;
          formData.petIds.forEach(id => {
              const pet = pets.find(p => p.id === id);
              if (pet && petConfigs[id]) {
                  total += calculatePriceForConfig(petConfigs[id], [pet]);
              }
          });
          return total;
      }
  };

  // Helper pour calculer la durée (pour les coupons)
  const calculateMaxDuration = () => {
      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
          return useSameDates 
            ? individualDates.filter(d => d.date).length 
            : Math.max(...Object.values(petConfigs).map(c => c.individualDates.filter(d => d.date).length));
      }
      
      // Boarding/Daycare: Calculate nights/days
      const config = useSameDates 
        ? { startDate: formData.startDate, endDate: formData.endDate }
        : Object.values(petConfigs)[0]; // Take first as approx if varying

      if (!config?.startDate || !config?.endDate) return 1;
      
      const start = new Date(config.startDate);
      const end = new Date(config.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      return diffDays || 1;
  };

  const formatPrice = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
  };

  const togglePet = (id: string) => {
      setFormData(prev => {
          const exists = prev.petIds.includes(id);
          const newIds = exists 
              ? prev.petIds.filter(pid => pid !== id)
              : [...prev.petIds, id];
          return { ...prev, petIds: newIds };
      });
  };

  const validateCoupon = async () => {
      console.log("🖱️ Click validateCoupon");
      const price = calculateTotalPrice();
      console.log("💰 Prix calculé:", price);
      console.log("🎟️ Code:", formData.promoCode);
      
      if (!formData.promoCode) {
          console.log("❌ Code manquant");
          setCouponStatus(p => ({ ...p, error: "Code requis" }));
          return;
      }
      
      if (price === 0) {
          console.log("❌ Prix 0");
          setCouponStatus(p => ({ ...p, error: "Sélectionnez vos dates d'abord" }));
          return;
      }
      
      console.log("🚀 Envoi requête API...");
      setCouponStatus(p => ({ ...p, loading: true, error: "" }));
      const duration = calculateMaxDuration();

      try {
        const res = await fetch("/api/coupons/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: formData.promoCode, totalAmount: price, serviceType: formData.serviceType, duration }),
        });
        const data = await res.json();
        console.log("📥 Réponse API:", data);
        
        if (res.ok) {
            setCouponStatus({ applied: true, loading: false, isAuto: couponStatus.isAuto, data: data, error: "" });
        } else {
            setCouponStatus({ applied: false, loading: false, isAuto: false, data: null, error: data.error || "Code invalide" });
        }
      } catch (e) { 
          console.error("🔥 Erreur fetch:", e);
          setCouponStatus(p => ({ ...p, loading: false, error: "Erreur de connexion" })); 
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    let bookingsToCreate = [];

    if (useSameDates) {
        const price = couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice();
        
        let startDate = formData.startDate;
        let endDate = formData.endDate;
        if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
            const valid = individualDates.filter(d => d.date !== "").map(d => d.date).sort();
            if (valid.length > 0) { startDate = valid[0]; endDate = valid[valid.length - 1]; }
        }

        bookingsToCreate.push({
            petIds: formData.petIds,
            startDate,
            endDate,
            startTime: formData.startTime,
            endTime: formData.endTime,
            serviceType: formData.serviceType,
            totalPrice: price,
            depositAmount: price,
            notes: formData.notes
        });
    } else {
        const totalRaw = calculateTotalPrice();
        const discountRatio = (couponStatus.applied && couponStatus.data) ? (couponStatus.data.finalAmount / totalRaw) : 1;

        for (const petId of formData.petIds) {
            const config = petConfigs[petId];
            const pet = pets.find(p => p.id === petId);
            if (!pet || !config) continue;

            const rawPrice = calculatePriceForConfig(config, [pet]);
            const finalPrice = rawPrice * discountRatio;

            let startDate = config.startDate;
            let endDate = config.endDate;
            if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
                const valid = config.individualDates.filter(d => d.date !== "").map(d => d.date).sort();
                if (valid.length > 0) { startDate = valid[0]; endDate = valid[valid.length - 1]; }
            }

            bookingsToCreate.push({
                petIds: [petId],
                startDate,
                endDate,
                startTime: config.startTime,
                endTime: config.endTime,
                serviceType: formData.serviceType,
                totalPrice: finalPrice,
                depositAmount: finalPrice,
                notes: formData.notes
            });
        }
    }

    try {
        const createdBookingIds = [];
        for (const bookingData of bookingsToCreate) {
             const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bookingData),
             });
             const data = await res.json();
             if (!res.ok) throw new Error(data.error);
             createdBookingIds.push(data.booking.id);
        }

        const resCheckout = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingIds: createdBookingIds }),
        });
        const dataCheckout = await resCheckout.json();
        if (!resCheckout.ok) throw new Error(dataCheckout.error);

        window.location.href = dataCheckout.checkoutUrl;

    } catch (e: any) { setError(e.message); setIsLoading(false); }
  };

  const today = new Date().toISOString().split("T")[0];

  if (status === "loading") return <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">🐕</div>;
  
  const selectedPetsList = pets.filter(p => formData.petIds.includes(p.id));
  const currentPetName = selectedPetsList.length > 0 ? selectedPetsList.map(p => p.name).join(", ") : "votre compagnon";

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />
      
      <div className="container mx-auto px-6 pt-32 max-w-4xl">
        <div className="flex justify-center mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <motion.div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? "bg-gray-900 text-white shadow-lg" : "bg-gray-200 text-gray-500"}`}
                animate={{ scale: step === s ? 1.2 : 1 }}
              >
                {s}
              </motion.div>
              {s < 3 && <div className={`w-16 h-1 rounded-full mx-2 ${step > s ? "bg-gray-900" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-center border border-red-100 font-medium">
            ❌ {error}
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Qui gardons-nous ? 🐕</h2>
                  {pets.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-2xl border-dashed border-2 border-gray-200">
                      <Link href="/pets/new" className="text-orange-600 font-bold hover:underline">Créer un profil</Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {pets.map((pet) => {
                        const isSelected = formData.petIds.includes(pet.id);
                        return (
                        <div key={pet.id} onClick={() => togglePet(pet.id)}
                          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center gap-2 text-center ${isSelected ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-300"}`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${isSelected ? "bg-orange-100" : "bg-gray-100"}`}>{isSelected ? "✅" : "🐕"}</div>
                          <span className={`font-bold text-sm ${isSelected ? "text-gray-900" : "text-gray-500"}`}>{pet.name}</span>
                        </div>
                      )})}
                    </div>
                  )}
                </div>

                {formData.petIds.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Quel service ? 🏠</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {serviceTypes.map((s) => {
                        const isDisabled = s.maxPets < formData.petIds.length;
                        return (
                        <div key={s.value} onClick={() => !isDisabled && setFormData({ ...formData, serviceType: s.value as any })}
                          className={`relative p-6 rounded-2xl border-2 transition-all ${isDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:border-gray-300"} ${!isDisabled && formData.serviceType === s.value ? "border-orange-500 bg-orange-50" : "border-gray-100"}`}
                        >
                          {isDisabled && <div className="absolute top-2 right-2 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">Max {s.maxPets}</div>}
                          <div className="text-3xl mb-2">{s.icon}</div>
                          <div className="flex justify-between items-center"><h3 className="font-bold text-gray-900">{s.name}</h3><div className="font-bold text-orange-600">{s.price}€</div></div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
                
                <Button type="button" onClick={() => setStep(2)} disabled={formData.petIds.length === 0} className="w-full h-14 rounded-xl text-lg bg-gray-900 hover:bg-orange-600">Continuer vers les dates</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">3. Quand ? 📅</h2>
                    {formData.petIds.length > 1 && (
                        <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                            <label htmlFor="same-dates" className="text-sm font-medium cursor-pointer text-gray-900">Mêmes dates</label>
                            <input id="same-dates" type="checkbox" checked={useSameDates} onChange={(e) => setUseSameDates(e.target.checked)} className="w-5 h-5 accent-orange-600" />
                        </div>
                    )}
                 </div>

                 <div className="bg-gray-50 p-6 rounded-3xl space-y-6">
                     {useSameDates ? (
                         <DateSelector 
                            config={{ startDate: formData.startDate, endDate: formData.endDate, startTime: formData.startTime, endTime: formData.endTime, individualDates }} 
                            onChange={(c) => {
                                setFormData(p => ({ ...p, startDate: c.startDate, endDate: c.endDate, startTime: c.startTime, endTime: c.endTime }));
                                setIndividualDates(c.individualDates);
                            }} 
                            serviceType={formData.serviceType}
                         />
                     ) : (
                         <div className="space-y-6">
                             {formData.petIds.map(id => {
                                 const pet = pets.find(p => p.id === id);
                                 const config = petConfigs[id];
                                 if (!pet || !config) return null;
                                 return (
                                     <div key={id} className="bg-white p-4 rounded-2xl border border-gray-200">
                                         <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">🐕 Dates pour {pet.name}</h4>
                                         <DateSelector 
                                            config={config} 
                                            onChange={(c) => setPetConfigs(p => ({...p, [id]: c}))} 
                                            serviceType={formData.serviceType}
                                         />
                                     </div>
                                 );
                             })}
                         </div>
                     )}

                     {availabilityStatus.message && (
                        <div className={`text-center text-sm font-bold ${availabilityStatus.available ? "text-green-600" : "text-red-500"}`}>
                          {availabilityStatus.checking ? "Vérification..." : availabilityStatus.message}
                        </div>
                      )}
                 </div>

                 {calculateTotalPrice() > 0 && (
                     <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-3xl flex justify-between items-center">
                         <div>
                             <p className="text-gray-400 text-sm">Total estimé</p>
                             <div className="text-3xl font-bold">{formatPrice(calculateTotalPrice())}€</div>
                         </div>
                         {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                             <div className="flex flex-col items-end">
                                 <div className="flex gap-2">
                                     <Input 
                                        placeholder="PROMO" 
                                        className="w-24 bg-white/10 border-none text-white placeholder:text-gray-500 uppercase" 
                                        value={formData.promoCode} 
                                        onChange={(e) => setFormData({...formData, promoCode: e.target.value.toUpperCase()})}
                                        onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); validateCoupon(); } }} 
                                     />
                                     <Button type="button" size="sm" onClick={validateCoupon} className="bg-white/20 text-white hover:bg-white/30">
                                        {couponStatus.loading ? "..." : "OK"}
                                     </Button>
                                 </div>
                                 {couponStatus.error && (
                                    <p className="text-red-400 text-xs font-bold mt-1 text-right">{couponStatus.error}</p>
                                 )}
                             </div>
                         )}
                     </div>
                 )}

                 <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-14 rounded-xl">Retour</Button>
                  <Button type="button" onClick={() => setStep(3)} disabled={!availabilityStatus.available || calculateTotalPrice() === 0} className="flex-1 h-14 rounded-xl bg-gray-900 hover:bg-orange-600">Récapitulatif</Button>
                </div>
              </div>
            )}

            {step === 3 && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">Derniers détails 📝</h2>
                    <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                        <h3 className="font-bold text-orange-900 mb-4">Récapitulatif</h3>
                        <div className="space-y-4 text-sm text-gray-700">
                            {useSameDates ? (
                                <div className="border-b border-orange-200 pb-2">
                                    <div className="font-bold">{currentPetName}</div>
                                    <div className="text-xs text-gray-500">Mêmes dates pour tous</div>
                                </div>
                            ) : (
                                formData.petIds.map(id => {
                                    const pet = pets.find(p => p.id === id);
                                    const config = petConfigs[id];
                                    if(!pet || !config) return null;
                                    return (
                                        <div key={id} className="border-b border-orange-200 pb-2">
                                            <div className="font-bold">{pet.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {formData.serviceType === "DROP_IN" 
                                                    ? `${config.individualDates.length} visites`
                                                    : `Du ${config.startDate} au ${config.endDate}`
                                                }
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            
                            <div className="flex justify-between pt-2">
                                <span className="font-bold text-xl">Total à payer</span>
                                <strong className="text-xl text-green-600">{formatPrice(couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice())}€</strong>
                            </div>
                        </div>
                    </div>

                    <div>
                      <Label>Instructions spéciales</Label>
                      <textarea className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl h-32 mt-2" placeholder="Allergies, habitudes..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                    </div>

                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 h-14 rounded-xl">Retour</Button>
                      <Button type="submit" disabled={isLoading} className="flex-1 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg">
                          {isLoading ? "Chargement..." : "Payer et Confirmer 💳"}
                      </Button>
                    </div>
                </div>
            )}

          </form>
        </motion.div>
      </div>
    </div>
  );
}