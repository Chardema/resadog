"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppNav } from "@/components/layout/AppNav";
import { getUnitPrice, getServiceDisplayPrice, isHighSeasonRange, EXTRA_DURATION, type Species, type PriceLine } from "@/lib/pricing";

const serviceTypes = [
  {
    value: "BOARDING",
    name: "Hébergement",
    unit: "nuit",
    description: "Votre compagnon vit avec nous, accès canapé et jardin inclus.",
    icon: "🏠",
    maxHours: 24,
    maxPets: 3,
  },
  {
    value: "DAY_CARE",
    name: "Garderie Jour",
    unit: "jour",
    description: "Déposez-le le matin, récupérez-le le soir.",
    icon: "☀️",
    maxHours: 10,
    maxPets: 3,
  },
  {
    value: "DROP_IN",
    name: "Visite à domicile",
    unit: "visite",
    description: "Visite de 30 min pour les chats et chiens indépendants.",
    icon: "🚪",
    maxPets: 99,
  },
  {
    value: "DOG_WALKING",
    name: "Promenade",
    unit: "promenade",
    description: "Balade de 30 min dans le quartier.",
    icon: "🐾",
    maxPets: 99,
  },
];

interface Pet {
  id: string;
  name: string;
  breed: string;
  species: Species;
  age?: number | null;
}

type VisitSlot = {
  date: string;
  startTime: string;
  duration: number;
};

type DateConfig = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  visitSlots: VisitSlot[];
};

const hourlyServiceTypes = ["DROP_IN", "DOG_WALKING"];
const isHourlyService = (serviceType: string) => hourlyServiceTypes.includes(serviceType);
const isSubscriptionService = (serviceType: string) => serviceType === "DOG_WALKING" || serviceType === "DAY_CARE";
const defaultVisitDuration = () => 30;
const defaultVisitTime = "09:00";
const boardingCheckoutTime = "10:00";

const serviceDefaultTimes: Record<string, { startTime: string; endTime: string }> = {
  BOARDING: { startTime: "18:00", endTime: boardingCheckoutTime },
  DAY_CARE: { startTime: "09:00", endTime: "18:00" },
  DROP_IN: { startTime: defaultVisitTime, endTime: defaultVisitTime },
  DOG_WALKING: { startTime: defaultVisitTime, endTime: defaultVisitTime },
};

const createEmptyVisitSlot = (): VisitSlot => ({
  date: "",
  startTime: defaultVisitTime,
  duration: defaultVisitDuration(),
});

const sortVisitSlots = (slots: VisitSlot[]) =>
  [...slots].sort((a, b) => `${a.date || "9999-99-99"}T${a.startTime || "99:99"}`.localeCompare(`${b.date || "9999-99-99"}T${b.startTime || "99:99"}`));

const getValidVisitSlots = (slots: VisitSlot[]) =>
  sortVisitSlots(slots.filter((slot) => slot.date));

const getUniqueVisitDates = (slots: VisitSlot[]) =>
  [...new Set(getValidVisitSlots(slots).map((slot) => slot.date))];

const buildDateRange = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return [];

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const getCalendarDayDifference = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const getInclusiveCalendarDayCount = (startDate: string, endDate: string) => {
  const diff = getCalendarDayDifference(startDate, endDate);
  return diff >= 0 ? diff + 1 : 0;
};

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
};

// --- COMPOSANT DATE SELECTOR EXTRAIT ---
const DateSelector = ({ config, onChange, serviceType }: { config: DateConfig, onChange: (c: DateConfig) => void, serviceType: string }) => {
    const isHourly = isHourlyService(serviceType);
    const today = new Date().toISOString().split("T")[0];
    const [batchStartDate, setBatchStartDate] = useState("");
    const [batchEndDate, setBatchEndDate] = useState("");
    const [batchVisitsPerDay, setBatchVisitsPerDay] = useState(1);
    const [batchDuration, setBatchDuration] = useState(defaultVisitDuration());
    const [batchTimes, setBatchTimes] = useState<string[]>([defaultVisitTime, "13:00", "18:00"]);

    const updateVisitSlot = (idx: number, changes: Partial<VisitSlot>) => {
      onChange({
        ...config,
        visitSlots: config.visitSlots.map((slot, i) => i === idx ? { ...slot, ...changes } : slot),
      });
    };

    const removeVisitSlot = (idx: number) => {
      const nextSlots = config.visitSlots.filter((_, i) => i !== idx);
      onChange({ ...config, visitSlots: nextSlots.length > 0 ? nextSlots : [createEmptyVisitSlot()] });
    };

    const addRangeSlots = () => {
      const dates = buildDateRange(batchStartDate, batchEndDate || batchStartDate);
      if (dates.length === 0) return;

      const newSlots = dates.flatMap((date) =>
        Array.from({ length: batchVisitsPerDay }, (_, i) => ({
          date,
          startTime: batchTimes[i] || defaultVisitTime,
          duration: batchDuration,
        }))
      );

      const existingSlots = config.visitSlots.filter((slot) => slot.date);
      onChange({ ...config, visitSlots: sortVisitSlots([...existingSlots, ...newSlots]) });
    };

    if (isHourly) {
        return (
           <div className="space-y-5">
               <div className="rounded-2xl border border-orange-100 bg-white p-4 space-y-4">
                   <div className="grid md:grid-cols-2 gap-3">
                       <div>
                           <Label>Du</Label>
                           <Input type="date" min={today} className="bg-white" value={batchStartDate} onChange={(e) => {
                             setBatchStartDate(e.target.value);
                             if (!batchEndDate || batchEndDate < e.target.value) setBatchEndDate(e.target.value);
                           }} />
                       </div>
                       <div>
                           <Label>Au</Label>
                           <Input type="date" min={batchStartDate || today} className="bg-white" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} />
                       </div>
                   </div>

                   <div className="grid md:grid-cols-3 gap-3">
                       <div>
                           <Label>Passages / jour</Label>
                           <select
                             className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                             value={batchVisitsPerDay}
                             onChange={(e) => setBatchVisitsPerDay(Number(e.target.value))}
                           >
                             <option value={1}>1 passage</option>
                             <option value={2}>2 passages</option>
                             <option value={3}>3 passages</option>
                           </select>
                       </div>
                       <div>
                           <Label>Durée</Label>
                           <select
                             className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                             value={batchDuration}
                             onChange={(e) => setBatchDuration(Number(e.target.value))}
                           >
                             <option value={30}>30 min</option>
                             <option value={60}>1 h</option>
                           </select>
                       </div>
                       <div className="flex items-end">
                           <Button type="button" className="w-full bg-orange-500 hover:bg-orange-600" onClick={addRangeSlots} disabled={!batchStartDate}>
                             Ajouter
                           </Button>
                       </div>
                   </div>

                   <div className="grid md:grid-cols-3 gap-3">
                       {Array.from({ length: batchVisitsPerDay }, (_, i) => (
                         <div key={i}>
                           <Label>Heure {i + 1}</Label>
                           <Input
                             type="time"
                             className="bg-white"
                             value={batchTimes[i] || defaultVisitTime}
                             onChange={(e) => setBatchTimes((times) => {
                               const next = [...times];
                               next[i] = e.target.value;
                               return next;
                             })}
                           />
                         </div>
                       ))}
                   </div>
               </div>

               <div className="space-y-2">
                   <div className="flex items-center justify-between">
                       <Label>Passages sélectionnés</Label>
                       <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...config, visitSlots: [...config.visitSlots, createEmptyVisitSlot()] })}>
                         + Passage
                       </Button>
                   </div>

                   {config.visitSlots.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-2 md:grid-cols-[1fr_92px_92px_44px] gap-2 items-center">
                          <Input type="date" min={today} className="bg-white col-span-2 md:col-span-1" value={item.date} onChange={(e) => updateVisitSlot(idx, { date: e.target.value })} />
                          <Input type="time" className="bg-white" value={item.startTime} onChange={(e) => updateVisitSlot(idx, { startTime: e.target.value })} />
                          <select
                            className="h-10 rounded-md border border-gray-200 bg-white px-2 text-sm"
                            value={item.duration}
                            onChange={(e) => updateVisitSlot(idx, { duration: Number(e.target.value) })}
                          >
                            <option value={30}>30 min</option>
                            <option value={60}>1 h</option>
                          </select>
                          <Button type="button" variant="outline" className="col-span-2 md:col-span-1" onClick={() => removeVisitSlot(idx)}>×</Button>
                      </div>
                   ))}
               </div>
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
  // Direction de l'animation : 1 = avant, -1 = arrière
  const [direction, setDirection] = useState(0);

  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Configuration dates
  // Une réservation multi-animaux utilise un planning commun afin qu'un paiement
  // corresponde toujours à une seule réservation atomique.
  const useSameDates = true;

  // Validation légale
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Modale Upsell
  const [showUpsellModal, setShowUpsellModal] = useState(false);

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
    serviceAddress: string;
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
    serviceAddress: "",
    startDate: "",
    endDate: "",
    startTime: "18:00",
    endTime: "10:00",
  });

  // Passages individuels pour visites/promenades (Global)
  const [visitSlots, setVisitSlots] = useState<VisitSlot[]>([
    createEmptyVisitSlot(),
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
               visitSlots: [...visitSlots]
           };
       } else {
           initialConfig[id] = petConfigs[id];
       }
    });
    setPetConfigs(initialConfig);
  }, [formData.petIds, useSameDates]); // Re-sync when switching mode

  // Crédits utilisateur
  const [creditBalances, setCreditBalances] = useState<Record<string, number>>({});
  const userCredits = creditBalances[formData.serviceType] || 0;

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/user/credits");
        if (res.ok) {
          const data = await res.json();
          setCreditBalances(data.byService || {});
        }
      } catch (e) {}
    };
    if (session?.user) fetchCredits();
  }, [session]);

  const calculateCreditCost = () => {
      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
          return useSameDates
            ? getValidVisitSlots(visitSlots).length * formData.petIds.length
            : Object.values(petConfigs).reduce((sum, c) => sum + getValidVisitSlots(c.visitSlots).length, 0);
      }
      // Boarding/Daycare = 1 credit per day per pet
      const duration = calculateMaxDuration();
      return duration * formData.petIds.length;
  };

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
    if (session?.user) fetchPets();
  }, [session]);

  // Reset visit slots when service changes
  useEffect(() => {
    const defaultTimes = serviceDefaultTimes[formData.serviceType];
    if (defaultTimes) {
      setFormData((prev) => ({
        ...prev,
        startTime: defaultTimes.startTime,
        endTime: defaultTimes.endTime,
      }));
    }

    setVisitSlots([createEmptyVisitSlot()]);

    // Reset configs
    const newConfigs = { ...petConfigs };
    Object.keys(newConfigs).forEach(k => {
        if (defaultTimes) {
          newConfigs[k].startTime = defaultTimes.startTime;
          newConfigs[k].endTime = defaultTimes.endTime;
        }
        newConfigs[k].visitSlots = [createEmptyVisitSlot()];
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
                  visitSlots
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
              if (getValidVisitSlots(config.visitSlots).length === 0) {
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
             let datesToCheck: string[] = [];
             if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
                 datesToCheck = getUniqueVisitDates(config.visitSlots);
             } else {
                 datesToCheck = [config.startDate, config.endDate];
             }

             if (datesToCheck.length === 0) continue;

             const start = isHourlyService(formData.serviceType) ? datesToCheck[0] : config.startDate;
             const end = isHourlyService(formData.serviceType) ? datesToCheck[datesToCheck.length-1] : config.endDate;
             const datesParam = isHourlyService(formData.serviceType) ? `&dates=${datesToCheck.join(",")}` : "";

             const res = await fetch(`/api/availability/check?startDate=${start}&endDate=${end}&serviceType=${formData.serviceType}${datesParam}`);
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
  }, [formData, visitSlots, petConfigs, useSameDates]);

  const resetAvailability = () => setAvailabilityStatus({ checking: false, available: true, message: "", unavailableDates: [] });

  const getSelectedService = () => serviceTypes.find(s => s.value === formData.serviceType);

  // Détermine si un animal est "supplémentaire" (pas le premier de son espèce)
  const getAdditionalStatus = (petId: string): boolean => {
    const selectedPets = pets.filter(p => formData.petIds.includes(p.id));
    const pet = selectedPets.find(p => p.id === petId);
    if (!pet) return false;
    const sameSpecies = selectedPets.filter(p => p.species === pet.species);
    return sameSpecies.indexOf(pet) > 0;
  };

  const getPrimarySelectedPetId = () => {
    return formData.petIds[0] || null;
  };

  // Retourne le détail du prix pour UN animal donné
  const calculatePriceDetailForPet = (config: DateConfig, pet: Pet) => {
      const service = getSelectedService();
      if (!service) return { total: 0, breakdown: "Service inconnu", isPuppy: false, surchargeTotal: 0, quantity: 0, unitPrice: 0, priceLines: [] as PriceLine[] };

      const isYoung = pet.age !== undefined && pet.age !== null && pet.age < 1;
      const isAdditional = getAdditionalStatus(pet.id);

      // Déterminer si haute saison
      let highSeason = false;
      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
        const validSlots = getValidVisitSlots(config.visitSlots);
        highSeason = validSlots.some(d => isHighSeasonRange(d.date, d.date));
      } else if (config.startDate && config.endDate) {
        highSeason = isHighSeasonRange(config.startDate, config.endDate);
      }

      const { price: unitPrice, lines: priceLines } = getUnitPrice(formData.serviceType, {
        species: pet.species || "DOG",
        isYoung,
        isAdditional,
        isHighSeason: highSeason,
      });

      let total = 0;
      let breakdown = "";
      let quantity = 0;

      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
          const validSlots = getValidVisitSlots(config.visitSlots);
          const visits = validSlots.length;
          const extra = EXTRA_DURATION[formData.serviceType as "DROP_IN" | "DOG_WALKING"];
          const appliesSharedDurationExtra = !useSameDates || getPrimarySelectedPetId() === pet.id;

          let subTotal = 0;
          let extraDurationTotal = 0;
          validSlots.forEach(item => {
              subTotal += unitPrice;
              if (extra && appliesSharedDurationExtra) {
                const extraTime = item.duration - extra.baseDuration;
                if (extraTime > 0) {
                  const extraIncrements = Math.ceil(extraTime / extra.increment);
                  extraDurationTotal += extraIncrements * extra.extraRate;
                }
              }
          });

          total = subTotal + extraDurationTotal;
          if (extraDurationTotal > 0) {
            priceLines.push({ label: "Durée prolongée", amount: extraDurationTotal, type: "surcharge" });
          }
          breakdown = "visites";
          quantity = visits;

      } else {
          if (!config.startDate || !config.endDate) return { total: 0, breakdown: "", isPuppy: isYoung, surchargeTotal: 0, quantity: 0, unitPrice, priceLines };

          const start = new Date(`${config.startDate}T${config.startTime}`);
          const end = new Date(`${config.endDate}T${config.endTime}`);

          if (isNaN(start.getTime()) || isNaN(end.getTime())) return { total: 0, breakdown: "", isPuppy: isYoung, surchargeTotal: 0, quantity: 0, unitPrice, priceLines };

          const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          if (totalHours <= 0) return { total: 0, breakdown: "", isPuppy: isYoung, surchargeTotal: 0, quantity: 0, unitPrice, priceLines };

          if (formData.serviceType === "BOARDING") {
              const baseNights = getCalendarDayDifference(config.startDate, config.endDate);
              if (baseNights <= 0) return { total: 0, breakdown: "", isPuppy: isYoung, surchargeTotal: 0, quantity: 0, unitPrice, priceLines };

              total = baseNights * unitPrice;
              const checkoutOverrunHours = (timeToMinutes(config.endTime) - timeToMinutes(boardingCheckoutTime)) / 60;

              if (checkoutOverrunHours > 8) {
                total += unitPrice;
                priceLines.push({ label: `Journée supplémentaire (> 8h après ${boardingCheckoutTime})`, amount: unitPrice, type: "surcharge" });
              } else if (checkoutOverrunHours > 2) {
                const half = Math.round(unitPrice * 0.5);
                total += half;
                priceLines.push({ label: `Demi-journée (2-8h après ${boardingCheckoutTime})`, amount: half, type: "surcharge" });
              }
              breakdown = "nuits";
              quantity = baseNights;
          } else {
              // DAY_CARE
              const days = getInclusiveCalendarDayCount(config.startDate, config.endDate);
              if (days <= 0) return { total: 0, breakdown: "", isPuppy: isYoung, surchargeTotal: 0, quantity: 0, unitPrice, priceLines };

              total = days * unitPrice;
              breakdown = "jours";
              quantity = days;
          }
      }

      return { total, breakdown, isPuppy: isYoung, surchargeTotal: 0, quantity, unitPrice, priceLines };
  };

  const calculateTotalPrice = () => {
      let total = 0;
      formData.petIds.forEach(id => {
          const pet = pets.find(p => p.id === id);
          const config = useSameDates
            ? { startDate: formData.startDate, endDate: formData.endDate, startTime: formData.startTime, endTime: formData.endTime, visitSlots }
            : petConfigs[id];

          if (pet && config) {
              total += calculatePriceDetailForPet(config, pet).total;
          }
      });
      return total;
  };

  // Helper pour calculer la durée (pour les coupons)
  const calculateMaxDuration = () => {
      if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
          return useSameDates
            ? getValidVisitSlots(visitSlots).length
            : Math.max(0, ...Object.values(petConfigs).map(c => getValidVisitSlots(c.visitSlots).length));
      }

      // Boarding/Daycare: Calculate nights/days
      const config = useSameDates
        ? { startDate: formData.startDate, endDate: formData.endDate }
        : Object.values(petConfigs)[0]; // Take first as approx if varying

      if (!config?.startDate || !config?.endDate) return 1;

      if (formData.serviceType === "DAY_CARE") {
        return getInclusiveCalendarDayCount(config.startDate, config.endDate) || 1;
      }

      return getCalendarDayDifference(config.startDate, config.endDate) || 1;
  };

  const formatPrice = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
  };

  const getHourlyDurationSummary = () => {
      const extra = EXTRA_DURATION[formData.serviceType as "DROP_IN" | "DOG_WALKING"];
      return extra
        ? `${extra.baseDuration} min inclus, +${extra.extraRate}€ par ${extra.increment} min supplémentaire`
        : "";
  };

  const getDurationCounts = (slots: VisitSlot[]) => {
      const counts = slots.reduce<Record<number, number>>((acc, slot) => {
        acc[slot.duration] = (acc[slot.duration] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([duration, count]) => `${count} x ${duration} min`)
        .join(" · ");
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
      const price = calculateTotalPrice();

      if (!useSameDates) {
          setCouponStatus(p => ({ ...p, error: "Un code promo nécessite des dates communes à tous les animaux" }));
          return;
      }

      if (!formData.promoCode) {
          setCouponStatus(p => ({ ...p, error: "Code requis" }));
          return;
      }

      if (price === 0) {
          setCouponStatus(p => ({ ...p, error: "Sélectionnez vos dates d'abord" }));
          return;
      }

      setCouponStatus(p => ({ ...p, loading: true, error: "" }));
      const duration = calculateMaxDuration();

      try {
        const res = await fetch("/api/coupons/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: formData.promoCode, totalAmount: price, serviceType: formData.serviceType, duration }),
        });
        const data = await res.json();

        if (res.ok) {
            setCouponStatus({ applied: true, loading: false, isAuto: couponStatus.isAuto, data: data, error: "" });
        } else {
            setCouponStatus({ applied: false, loading: false, isAuto: false, data: null, error: data.error || "Code invalide" });
        }
      } catch (e) {
          setCouponStatus(p => ({ ...p, loading: false, error: "Erreur de connexion" }));
      }
  };

  const handleSubmit = async (e?: React.FormEvent, payWithCredits = false) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError("");

    let bookingsToCreate = [];

    if (useSameDates) {
        const price = couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice();

        let startDate = formData.startDate;
        let endDate = formData.endDate;
        if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
            const valid = getUniqueVisitDates(visitSlots);
            if (valid.length > 0) { startDate = valid[0]; endDate = valid[valid.length - 1]; }
        }

        bookingsToCreate.push({
            petIds: formData.petIds,
            pricingPetIds: formData.petIds,
            startDate,
            endDate,
            startTime: formData.startTime,
            endTime: formData.endTime,
            serviceType: formData.serviceType,
            totalPrice: price,
            depositAmount: price,
            notes: formData.notes,
            useCredits: payWithCredits,
            promoCode: formData.promoCode,
            serviceDetails: isHourlyService(formData.serviceType)
              ? { visitSlots: getValidVisitSlots(visitSlots), serviceAddress: formData.serviceAddress }
              : undefined,
        });
    } else {
        const totalRaw = calculateTotalPrice();
        const discountRatio = (couponStatus.applied && couponStatus.data) ? (couponStatus.data.finalAmount / totalRaw) : 1;

        for (const petId of formData.petIds) {
            const config = petConfigs[petId];
            const pet = pets.find(p => p.id === petId);
            if (!pet || !config) continue;

            const details = calculatePriceDetailForPet(config, pet);
            const finalPrice = payWithCredits ? 0 : details.total * discountRatio;

            let startDate = config.startDate;
            let endDate = config.endDate;
            if (formData.serviceType === "DROP_IN" || formData.serviceType === "DOG_WALKING") {
                const valid = getUniqueVisitDates(config.visitSlots);
                if (valid.length > 0) { startDate = valid[0]; endDate = valid[valid.length - 1]; }
            }

            bookingsToCreate.push({
                petIds: [petId],
                pricingPetIds: formData.petIds,
                startDate,
                endDate,
                startTime: config.startTime,
                endTime: config.endTime,
                serviceType: formData.serviceType,
                totalPrice: finalPrice,
                depositAmount: finalPrice,
                notes: formData.notes,
                useCredits: payWithCredits,
                promoCode: formData.promoCode,
                serviceDetails: isHourlyService(formData.serviceType)
                  ? { visitSlots: getValidVisitSlots(config.visitSlots), serviceAddress: formData.serviceAddress }
                  : undefined,
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

        if (payWithCredits) {
            window.location.href = `/booking/success?bookingId=${createdBookingIds[0]}`;
        } else {
            const resCheckout = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingIds: createdBookingIds, promoCode: formData.promoCode || undefined }),
            });
            const dataCheckout = await resCheckout.json();
            if (!resCheckout.ok) throw new Error(dataCheckout.error);
            window.location.href = dataCheckout.checkoutUrl;
        }

    } catch (e: any) { setError(e.message); setIsLoading(false); }
  };

  const today = new Date().toISOString().split("T")[0];

  if (status === "loading" || status === "unauthenticated") return <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">🐾</div>;

  const selectedPetsList = pets.filter(p => formData.petIds.includes(p.id));
  const currentPetName = selectedPetsList.length > 0 ? selectedPetsList.map(p => p.name).join(", ") : "votre compagnon";

  // Navigation helpers
  const goNext = () => { setDirection(1); setStep(step + 1); };
  const goBack = () => { setDirection(-1); setStep(step - 1); };

  // Animation variants
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };

  return (
    <div className="min-h-screen bg-[#FDFbf7] pb-24">
      <AppNav userName={session?.user?.name} />

      <div className="container mx-auto px-6 pt-32 max-w-4xl overflow-hidden">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Nouvelle Réservation ✨</h1>
          <p className="text-gray-500">Quelques étapes pour des vacances de rêve.</p>
        </motion.div>

        {/* Steps */}
        <div className="flex justify-center mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${step >= s ? "bg-gray-900 text-white shadow-lg" : "bg-gray-200 text-gray-500"}`}
                animate={{ scale: step === s ? 1.2 : 1 }}
              >
                {s}
              </motion.div>
              {s < 3 && <div className={`w-16 h-1 rounded-full mx-2 transition-colors duration-300 ${step > s ? "bg-gray-900" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-center border border-red-100 font-medium">
            ❌ {error}
          </div>
        )}

        {/* Upsell Modal */}
        <AnimatePresence>
            {showUpsellModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowUpsellModal(false)}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative z-10 bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl"
                    >
                        <button type="button" onClick={() => setShowUpsellModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>

                        <div className="text-center mb-6">
                            <span className="text-4xl">🐺</span>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">Le Club La Meute</h3>
                            <p className="text-gray-500">Comparez et économisez sur cette réservation</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center mb-8">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-sm text-gray-500 mb-1">Prix Standard</p>
                                <p className="text-xl font-bold text-gray-900 line-through decoration-red-400 decoration-2">{formatPrice(calculateTotalPrice())}€</p>
                            </div>
                            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                                <p className="text-sm text-orange-600 font-bold mb-1">Prix Abonné</p>
                                <p className="text-2xl font-bold text-orange-700">{formatPrice(calculateTotalPrice() * 0.8)}€</p>
                                <p className="text-[10px] text-orange-600 mt-1">Soit 20% d'économie</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Paiement par crédits simplifié</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Supplément jeune animal OFFERT 🐾</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Validité des crédits illimitée</span>
                            </div>
                        </div>

                        <Link href="/subscriptions">
                            <Button className="w-full h-12 bg-gray-900 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg">
                                Voir les abonnements
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Card Form */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-12 relative"
        >
          <form onSubmit={handleSubmit} className="space-y-8" onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}>
            <AnimatePresence mode="wait" custom={direction}>

            {step === 1 && (
              <motion.div
                key={1}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Qui gardons-nous ? 🐾</h2>
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
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${isSelected ? "bg-orange-100" : "bg-gray-100"}`}>{isSelected ? "✅" : "🐾"}</div>
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
                          <div>
                            <h3 className="font-bold text-gray-900">{s.name}</h3>
                            <div className="flex gap-3 mt-1 text-sm">
                              <span className="text-orange-600 font-bold">🐕 {getServiceDisplayPrice(s.value).dogPrice}€</span>
                              <span className="text-blue-600 font-bold">🐈 {getServiceDisplayPrice(s.value).catPrice}€</span>
                              <span className="text-gray-400">/ {getServiceDisplayPrice(s.value).unit}</span>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                    <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')} className="flex-1 h-14 rounded-xl text-gray-500">Annuler</Button>
                    <Button type="button" onClick={goNext} disabled={formData.petIds.length === 0} className="flex-[2] h-14 rounded-xl text-lg bg-gray-900 hover:bg-orange-600">Continuer vers les dates</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key={2}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                 <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">3. Quand ? 📅</h2>
                 </div>

                 <div className="bg-gray-50 p-6 rounded-3xl space-y-6">
                     {useSameDates ? (
                         <DateSelector
                            config={{ startDate: formData.startDate, endDate: formData.endDate, startTime: formData.startTime, endTime: formData.endTime, visitSlots }}
                            onChange={(c) => {
                                setFormData(p => ({ ...p, startDate: c.startDate, endDate: c.endDate, startTime: c.startTime, endTime: c.endTime }));
                                setVisitSlots(c.visitSlots);
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
                                         <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">🐾 Dates pour {pet.name}</h4>
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

                     {isHourlyService(formData.serviceType) && (
                       <div className="space-y-2">
                         <Label htmlFor="service-address">Adresse de la prestation</Label>
                         <Input
                           id="service-address"
                           autoComplete="street-address"
                           value={formData.serviceAddress}
                           onChange={(e) => setFormData({ ...formData, serviceAddress: e.target.value })}
                           placeholder="Numéro, rue, code postal et ville"
                           className="h-12 bg-white"
                         />
                         <p className="text-xs text-gray-500">Utilisée uniquement pour organiser cette visite ou promenade.</p>
                       </div>
                     )}

                     {availabilityStatus.message && (
                        <div className={`text-center text-sm font-bold ${availabilityStatus.available ? "text-green-600" : "text-red-500"}`}>
                          {availabilityStatus.checking ? "Vérification..." : availabilityStatus.message}
                        </div>
                      )}
                 </div>

                 {/* Total Price Bar */}
                 {calculateTotalPrice() > 0 && (
                     <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-3xl flex justify-between items-center">
                         <div>
                             <p className="text-gray-400 text-sm">Total estimé</p>
                             <div className="flex items-baseline gap-3">
                                {couponStatus.applied && couponStatus.data ? (
                                  <>
                                    <span className="text-lg text-gray-500 line-through decoration-red-500/50 decoration-2">
                                      {formatPrice(calculateTotalPrice())}€
                                    </span>
                                    <span className="text-3xl font-bold text-green-400">
                                      {formatPrice(couponStatus.data.finalAmount)}€
                                    </span>
                                  </>
                                ) : (
                                  <div className="text-3xl font-bold">{formatPrice(calculateTotalPrice())}€</div>
                                )}
                             </div>
                         </div>
                         {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                             <div className="flex flex-col items-end gap-1">
                                 <div className="flex gap-2">
                                     <Input
                                        placeholder="PROMO"
                                        className="w-24 bg-white/10 border-none text-white placeholder:text-gray-500 uppercase"
                                        value={formData.promoCode}
                                        onChange={(e) => setFormData({...formData, promoCode: e.target.value.toUpperCase()})}
                                        onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); validateCoupon(); } }}
                                     />
                                     <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); validateCoupon(); }}
                                        className="bg-white/20 text-white hover:bg-white/30 cursor-pointer z-50 relative h-10 px-4 rounded-md font-bold text-sm border border-white/10"
                                     >
                                        {couponStatus.loading ? "..." : "OK"}
                                     </button>
                                 </div>
                                 {couponStatus.applied && couponStatus.data && (
                                   <p className="text-green-400 text-xs font-bold">
                                     -{formatPrice(couponStatus.data.discountAmount)}€
                                   </p>
                                 )}
                                 {couponStatus.error && (
                                    <p className="text-red-400 text-xs font-bold">{couponStatus.error}</p>
                                 )}
                             </div>
                         )}
                     </div>
                 )}

                 <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1 h-14 rounded-xl">Retour</Button>
                  <Button type="button" onClick={goNext} disabled={!availabilityStatus.available || calculateTotalPrice() === 0 || (isHourlyService(formData.serviceType) && formData.serviceAddress.trim().length < 8)} className="flex-1 h-14 rounded-xl bg-gray-900 hover:bg-orange-600">Récapitulatif</Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key={3}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                    <h2 className="text-2xl font-bold text-gray-900">Derniers détails 📝</h2>
                    <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                        <h3 className="font-bold text-orange-900 mb-4">Récapitulatif</h3>
                        {isHourlyService(formData.serviceType) && (
                          <div className="mb-4 rounded-xl border border-orange-200 bg-white/80 px-4 py-3 text-sm text-gray-700">
                            <span className="font-bold text-gray-900">Adresse : </span>
                            {formData.serviceAddress}
                          </div>
                        )}
                        <div className="space-y-4 text-sm text-gray-700">
                            {formData.petIds.map(id => {
                                const pet = pets.find(p => p.id === id);
                                const config = useSameDates
                                    ? { startDate: formData.startDate, endDate: formData.endDate, startTime: formData.startTime, endTime: formData.endTime, visitSlots }
                                    : petConfigs[id];
                                if(!pet || !config) return null;

                                const details = calculatePriceDetailForPet(config, pet);
                                const selectedSlots = getValidVisitSlots(config.visitSlots);
                                const baseTotal = details.unitPrice * details.quantity;
                                const durationExtraTotal = details.priceLines?.find((line) => line.label === "Durée prolongée")?.amount || 0;
                                const otherSurchargeLines = details.priceLines?.filter((line) =>
                                  line.type === "surcharge" &&
                                  line.label !== "Durée prolongée" &&
                                  line.label !== "Majoration haute saison"
                                ) || [];
                                const baseLine = details.priceLines?.find((line) => line.type === "base" || line.label.includes("haute saison"));

                                return (
                                    <div key={id} className="border-b border-orange-200 pb-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="font-bold text-gray-900">🐾 {pet.name}</div>
                                            <div className="font-bold text-gray-900">{formatPrice(details.total)}€</div>
                                        </div>

                                        <div className="rounded-2xl bg-white/80 border border-orange-100 p-4 space-y-2">
                                          <div className="flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-wide text-orange-800">
                                            <span>Détail du prix</span>
                                            {isHourlyService(formData.serviceType) && selectedSlots.length > 0 && (
                                              <span className="text-xs font-semibold normal-case tracking-normal text-gray-500">{getDurationCounts(selectedSlots)}</span>
                                            )}
                                          </div>

                                          {baseLine && (
                                            <div className="flex justify-between gap-4 text-xs text-gray-600">
                                              <span>{baseLine.label}</span>
                                              <span>{formatPrice(details.unitPrice)}€ / {getSelectedService()?.unit}</span>
                                            </div>
                                          )}

                                          {details.priceLines?.some((line) => line.label === "Majoration haute saison") && (
                                            <div className="text-xs text-orange-600">
                                              Majoration haute saison incluse dans le prix unitaire.
                                            </div>
                                          )}

                                          <div className="flex justify-between gap-4 text-xs text-gray-700">
                                            <span>{details.quantity} {details.breakdown} x {formatPrice(details.unitPrice)}€</span>
                                            <span>{formatPrice(details.unitPrice * details.quantity)}€</span>
                                          </div>

                                          {isHourlyService(formData.serviceType) && getHourlyDurationSummary() && (
                                            <div className="text-xs text-gray-500">
                                              {getHourlyDurationSummary()}
                                            </div>
                                          )}

                                          {durationExtraTotal > 0 && (
                                            <div className="flex justify-between gap-4 text-xs text-orange-600">
                                              <span>Supplément durée prolongée</span>
                                              <span>+{formatPrice(durationExtraTotal)}€</span>
                                            </div>
                                          )}

                                          {otherSurchargeLines.map((line, idx) => (
                                            <div key={idx} className="flex justify-between gap-4 text-xs text-orange-600">
                                              <span>{line.label}</span>
                                              <span>+{formatPrice(line.amount)}€</span>
                                            </div>
                                          ))}

                                          <div className="flex justify-between gap-4 pt-2 border-t border-orange-100 text-sm font-bold text-gray-900">
                                            <span>Sous-total {pet.name}</span>
                                            <span>{formatPrice(baseTotal + durationExtraTotal + otherSurchargeLines.reduce((sum, line) => sum + line.amount, 0))}€</span>
                                          </div>
                                        </div>

                                        {isHourlyService(formData.serviceType) && selectedSlots.length > 0 && (
                                          <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs text-gray-600 space-y-1">
                                            {selectedSlots.slice(0, 6).map((slot, idx) => (
                                              <div key={`${slot.date}-${slot.startTime}-${idx}`} className="flex justify-between gap-3">
                                                <span>{new Date(slot.date).toLocaleDateString("fr-FR")} à {slot.startTime}</span>
                                                <span className="font-medium">{slot.duration} min</span>
                                              </div>
                                            ))}
                                            {selectedSlots.length > 6 && (
                                              <div className="font-medium text-gray-500">+ {selectedSlots.length - 6} autre{selectedSlots.length - 6 > 1 ? "s" : ""}</div>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                )
                            })}

                            {/* Sous-total si coupon appliqué */}
                            {couponStatus.applied && couponStatus.data && (
                                <div className="flex justify-between pt-2 text-gray-500">
                                    <span>Sous-total</span>
                                    <span className="line-through">{formatPrice(calculateTotalPrice())}€</span>
                                </div>
                            )}

                            {/* Réduction si coupon appliqué */}
                            {couponStatus.applied && couponStatus.data && (
                                <div className="flex justify-between text-green-600 font-bold">
                                    <span>Réduction ({couponStatus.data.coupon.code})</span>
                                    <span>-{formatPrice(calculateTotalPrice() - couponStatus.data.finalAmount)}€</span>
                                </div>
                            )}

                            <div className="flex justify-between pt-2 border-t border-orange-200 mt-2">
                                <span className="font-bold text-xl text-gray-900">Total à payer</span>
                                <strong className="text-xl text-green-600">{formatPrice(couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice())}€</strong>
                            </div>

                            {/* Crédits */}
                            {isSubscriptionService(formData.serviceType) && userCredits > 0 && (
                                <div className="mt-4 p-4 bg-gray-900 rounded-xl text-white">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold">Vos crédits : {userCredits}</span>
                                        <span className="text-xs bg-white/20 px-2 py-1 rounded">Coût : {calculateCreditCost()} crédits</span>
                                    </div>
                                    {userCredits >= calculateCreditCost() ? (
                                        <Button
                                            type="button"
                                            onClick={() => handleSubmit(undefined, true)} // Pass true for credit payment
                                            className="w-full bg-white text-gray-900 hover:bg-gray-200 font-bold"
                                        >
                                            Utiliser mes crédits (0€)
                                        </Button>
                                    ) : (
                                        <p className="text-xs text-gray-400">Solde insuffisant pour payer en crédits.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upsell Abonnement */}
                    {isSubscriptionService(formData.serviceType) && !couponStatus.applied && userCredits < calculateCreditCost() && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shadow-lg">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />

                            <div className="relative z-10 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-400">Bon plan</p>
                                    <h4 className="text-lg font-bold">Payer moins cher ?</h4>
                                    <p className="text-sm text-gray-300 mt-1">
                                        Les crédits du service choisi offrent jusqu'à 20% de réduction sur le tarif public.
                                    </p>
                                </div>
                                <Button size="sm" onClick={() => setShowUpsellModal(true)} className="whitespace-nowrap bg-white text-gray-900 hover:bg-orange-50">
                                    Voir les offres →
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Validation légale */}
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <input
                            type="checkbox"
                            id="legal-checkbox"
                            checked={legalAccepted}
                            onChange={(e) => setLegalAccepted(e.target.checked)}
                            className="mt-1 w-5 h-5 accent-orange-600 rounded cursor-pointer"
                        />
                        <label htmlFor="legal-checkbox" className="text-sm text-gray-600 cursor-pointer">
                            J'accepte les <Link href="/legal/cgv" target="_blank" className="underline text-orange-600 hover:text-orange-800">Conditions Générales de Vente</Link> et la <Link href="/legal/confidentialite" target="_blank" className="underline text-orange-600 hover:text-orange-800">Politique de Confidentialité</Link>. Je reconnais que l'annulation est gratuite jusqu'à 48h avant le début de la garde.
                        </label>
                    </div>

                    <div>
                      <Label>Instructions spéciales</Label>
                      <textarea className="w-full p-4 bg-gray-50 border-gray-200 rounded-2xl h-32 mt-2" placeholder="Allergies, habitudes..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                    </div>

                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={goBack} className="flex-1 h-14 rounded-xl">Retour</Button>
                      <Button type="submit" disabled={isLoading || !legalAccepted} className="flex-1 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg">
                          {isLoading ? "Chargement..." : "Payer et Confirmer 💳"}
                      </Button>
                    </div>
              </motion.div>
            )}

            </AnimatePresence>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
