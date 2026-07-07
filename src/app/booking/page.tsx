"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppNav } from "@/components/layout/AppNav";
import { calculateBookingPrice, getServiceDisplayPrice, EXTRA_DURATION, type Species, type PriceLine } from "@/lib/pricing";
import {
  calculateSubscriptionPlan,
  SUBSCRIPTION_SERVICES,
  type SubscriptionBillingCycle,
  type SubscriptionServiceType,
} from "@/lib/subscription-pricing";
import {
  isHourlyServiceType,
  isOvernightServiceType,
  type AppServiceType,
} from "@/lib/services";

type ServiceOption = {
  value: AppServiceType;
  name: string;
  unit: string;
  description: string;
  icon: string;
  maxHours?: number;
  maxPets: number;
};

const serviceTypes: ServiceOption[] = [
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
    value: "HOUSE_SITTING",
    name: "Garde au domicile",
    unit: "nuit",
    description: "Nous gardons votre compagnon chez vous, avec présence au domicile.",
    icon: "🛏️",
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

type DisplayPriceLine = PriceLine & {
  unitPrice?: number;
  quantity?: number;
  total?: number;
  dateKeys?: string[];
};

type DateConfig = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  visitSlots: VisitSlot[];
};

const isHourlyService = isHourlyServiceType;
const isSubscriptionService = (serviceType: string): serviceType is SubscriptionServiceType =>
  serviceType in SUBSCRIPTION_SERVICES;
const defaultVisitDuration = () => 30;
const defaultVisitTime = "09:00";
const boardingCheckoutTime = "10:00";

const serviceDefaultTimes: Record<string, { startTime: string; endTime: string }> = {
  BOARDING: { startTime: "18:00", endTime: boardingCheckoutTime },
  HOUSE_SITTING: { startTime: "18:00", endTime: boardingCheckoutTime },
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const dateKeyToLocalDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const localDateToDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatShortDate = (dateKey: string) =>
  dateKeyToLocalDate(dateKey).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });

const formatDateKeyRanges = (dateKeys?: string[]) => {
  const sortedKeys = [...new Set(dateKeys || [])].sort();
  if (sortedKeys.length === 0) return "";

  const ranges: string[] = [];
  let start = sortedKeys[0];
  let previous = sortedKeys[0];

  sortedKeys.slice(1).forEach((key) => {
    const expectedNext = new Date(dateKeyToLocalDate(previous));
    expectedNext.setDate(expectedNext.getDate() + 1);

    if (key === localDateToDateKey(expectedNext)) {
      previous = key;
      return;
    }

    ranges.push(start === previous ? formatShortDate(start) : `${formatShortDate(start)} au ${formatShortDate(previous)}`);
    start = key;
    previous = key;
  });

  ranges.push(start === previous ? formatShortDate(start) : `${formatShortDate(start)} au ${formatShortDate(previous)}`);
  return ranges.join(", ");
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
    const [batchMode, setBatchMode] = useState<"REPLACE" | "APPEND">("REPLACE");

    const selectedSlotItems = config.visitSlots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.date)
      .sort((a, b) => `${a.slot.date}T${a.slot.startTime}`.localeCompare(`${b.slot.date}T${b.slot.startTime}`));
    const selectedDateCount = new Set(selectedSlotItems.map(({ slot }) => slot.date)).size;
    const groupedSlots = selectedSlotItems.reduce<Record<string, typeof selectedSlotItems>>((acc, item) => {
      acc[item.slot.date] = acc[item.slot.date] || [];
      acc[item.slot.date].push(item);
      return acc;
    }, {});

    const quickPresets = [
      { label: "Matin", visits: 1, times: ["09:00"] },
      { label: "Matin + midi", visits: 2, times: ["09:00", "13:00"] },
      { label: "Matin + midi + soir", visits: 3, times: ["09:00", "13:00", "18:00"] },
    ];

    const updateVisitSlot = (idx: number, changes: Partial<VisitSlot>) => {
      onChange({
        ...config,
        visitSlots: config.visitSlots.map((slot, i) => i === idx ? { ...slot, ...changes } : slot),
      });
    };

    const removeVisitSlot = (idx: number) => {
      const nextSlots = config.visitSlots.filter((_, i) => i !== idx);
      onChange({ ...config, visitSlots: nextSlots });
    };

    const normalizeVisitSlots = (slots: VisitSlot[]) => {
      const byKey = new Map<string, VisitSlot>();
      slots
        .filter((slot) => slot.date)
        .forEach((slot) => byKey.set(`${slot.date}-${slot.startTime}`, slot));
      return sortVisitSlots([...byKey.values()]);
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
      onChange({
        ...config,
        visitSlots: normalizeVisitSlots(batchMode === "APPEND" ? [...existingSlots, ...newSlots] : newSlots),
      });
    };

    const addSingleSlot = (date?: string) => {
      const slotDate = date || batchStartDate || today;
      onChange({
        ...config,
        visitSlots: normalizeVisitSlots([
          ...config.visitSlots,
          {
            date: slotDate,
            startTime: batchTimes[0] || defaultVisitTime,
            duration: batchDuration,
          },
        ]),
      });
    };

    const updateAllDurations = (duration: number) => {
      onChange({
        ...config,
        visitSlots: config.visitSlots.map((slot) => ({ ...slot, duration })),
      });
    };

    const applyPreset = (preset: { visits: number; times: string[] }) => {
      setBatchVisitsPerDay(preset.visits);
      setBatchTimes((times) => {
        const next = [...times];
        preset.times.forEach((time, index) => {
          next[index] = time;
        });
        return next;
      });
    };

    if (isHourly) {
        return (
           <div className="space-y-5">
               <div className="rounded-2xl border border-orange-100 bg-white p-4 space-y-4 shadow-sm">
                   <div>
                     <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                       <div>
                         <p className="text-sm font-bold text-gray-950">Planning rapide</p>
                         <p className="mt-1 text-xs leading-5 text-gray-500">
                           Choisissez une période et un rythme, le site crée tous les passages.
                         </p>
                       </div>
                       <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-bold">
                         <button
                           type="button"
                           onClick={() => setBatchMode("REPLACE")}
                           className={`rounded-md px-3 py-2 ${batchMode === "REPLACE" ? "bg-gray-950 text-white" : "text-gray-600"}`}
                         >
                           Remplacer
                         </button>
                         <button
                           type="button"
                           onClick={() => setBatchMode("APPEND")}
                           className={`rounded-md px-3 py-2 ${batchMode === "APPEND" ? "bg-gray-950 text-white" : "text-gray-600"}`}
                         >
                           Ajouter
                         </button>
                       </div>
                     </div>

                     <div className="mt-4 grid gap-2 sm:grid-cols-3">
                       {quickPresets.map((preset) => (
                         <button
                           key={preset.label}
                           type="button"
                           onClick={() => applyPreset(preset)}
                           className={`rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                             batchVisitsPerDay === preset.visits
                               ? "border-orange-500 bg-orange-50 text-orange-800"
                               : "border-gray-200 text-gray-700 hover:border-gray-300"
                           }`}
                         >
                           {preset.label}
                         </button>
                       ))}
                     </div>
                   </div>

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

                   <div className="grid md:grid-cols-[1fr_1fr_1.1fr] gap-3">
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
                             {batchMode === "REPLACE" ? "Générer le planning" : "Ajouter à la sélection"}
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

               <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                       <div>
                         <p className="text-sm font-bold text-gray-950">Passages sélectionnés</p>
                         <p className="mt-1 text-xs text-gray-500">
                           {selectedSlotItems.length > 0
                             ? `${selectedSlotItems.length} passage${selectedSlotItems.length > 1 ? "s" : ""} sur ${selectedDateCount} jour${selectedDateCount > 1 ? "s" : ""}`
                             : "Aucun passage généré pour le moment."}
                         </p>
                       </div>
                       <div className="flex flex-wrap gap-2">
                         <Button type="button" variant="outline" size="sm" onClick={() => updateAllDurations(30)} disabled={selectedSlotItems.length === 0}>
                           Tout 30 min
                         </Button>
                         <Button type="button" variant="outline" size="sm" onClick={() => updateAllDurations(60)} disabled={selectedSlotItems.length === 0}>
                           Tout 1 h
                         </Button>
                         <Button type="button" variant="outline" size="sm" onClick={() => addSingleSlot()}>
                           + Passage
                         </Button>
                         <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...config, visitSlots: [] })} disabled={selectedSlotItems.length === 0}>
                           Vider
                         </Button>
                       </div>
                   </div>

                   {selectedSlotItems.length === 0 ? (
                     <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-600">
                       Choisissez une période puis cliquez sur “Générer le planning”.
                     </div>
                   ) : (
                     <div className="mt-4 space-y-3">
                       {Object.entries(groupedSlots).map(([date, items]) => (
                         <div key={date} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                           <div className="mb-3 flex items-center justify-between gap-3">
                             <p className="font-bold text-gray-950">{formatShortDate(date)}</p>
                             <Button type="button" variant="ghost" size="sm" onClick={() => addSingleSlot(date)}>
                               + ce jour
                             </Button>
                           </div>
                           <div className="grid gap-2 sm:grid-cols-2">
                             {items.map(({ slot, index }) => (
                               <div key={`${slot.date}-${slot.startTime}-${index}`} className="grid grid-cols-[1fr_92px_40px] gap-2">
                                 <Input
                                   type="time"
                                   className="bg-white"
                                   value={slot.startTime}
                                   onChange={(e) => updateVisitSlot(index, { startTime: e.target.value })}
                                 />
                                 <select
                                   className="h-10 rounded-md border border-gray-200 bg-white px-2 text-sm"
                                   value={slot.duration}
                                   onChange={(e) => updateVisitSlot(index, { duration: Number(e.target.value) })}
                                 >
                                   <option value={30}>30 min</option>
                                   <option value={60}>1 h</option>
                                 </select>
                                 <Button type="button" variant="outline" size="icon" onClick={() => removeVisitSlot(index)} aria-label="Supprimer ce passage">
                                   ×
                                 </Button>
                               </div>
                             ))}
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
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
  const [priceIssueOpen, setPriceIssueOpen] = useState(false);
  const [priceIssueDescription, setPriceIssueDescription] = useState("");
  const [priceIssueSending, setPriceIssueSending] = useState(false);
  const [priceIssueSent, setPriceIssueSent] = useState(false);
  const [priceIssueError, setPriceIssueError] = useState("");

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
    serviceType: AppServiceType;
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
      if (isHourlyService(formData.serviceType)) {
          return useSameDates
            ? getValidVisitSlots(visitSlots).length * formData.petIds.length
            : Object.values(petConfigs).reduce((sum, c) => sum + getValidVisitSlots(c.visitSlots).length, 0);
      }
      // Services à la date = 1 crédit par unité tarifée et par animal.
      const duration = calculateMaxDuration();
      return duration * formData.petIds.length;
  };

  const getSubscriptionComparison = () => {
      if (!isSubscriptionService(formData.serviceType)) return null;
      if (formData.petIds.length === 0 || formData.petIds.length > 3) return null;

      const creditCost = calculateCreditCost();
      const cashTotal = couponStatus.applied && couponStatus.data
        ? couponStatus.data.finalAmount
        : calculateTotalPrice();

      if (creditCost <= 0 || cashTotal <= 0) return null;

      const petCount = formData.petIds.length;
      const serviceType = formData.serviceType as SubscriptionServiceType;
      const recommendedDaysPerWeek = clamp(Math.ceil(creditCost / (4 * petCount)), 1, 5);
      const buildPlan = (billingCycle: SubscriptionBillingCycle) => {
        const plan = calculateSubscriptionPlan({
          serviceType,
          daysPerWeek: recommendedDaysPerWeek,
          petCount,
          billingCycle,
        });
        const equivalentReservationCost = plan.effectiveCreditPrice * creditCost;
        return {
          ...plan,
          equivalentReservationCost,
          savingsOnReservation: Math.max(0, cashTotal - equivalentReservationCost),
        };
      };

      const monthly = buildPlan("MONTHLY");
      const yearly = buildPlan("YEARLY");

      return {
        creditCost,
        cashTotal,
        petCount,
        serviceType,
        serviceLabel: SUBSCRIPTION_SERVICES[serviceType].creditLabel,
        recommendedDaysPerWeek,
        monthly,
        yearly,
      };
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
      const allUnavailableDates: string[] = [];

      for (const item of configsToCheck) {
          const { config } = item;

          // Validation de base des dates
          if (isHourlyService(formData.serviceType)) {
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
             if (isHourlyService(formData.serviceType)) {
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

  const getPrimarySelectedPetId = () => {
    return formData.petIds[0] || null;
  };

  // Retourne le détail du prix pour UN animal donné
  const calculatePriceDetailForPet = (config: DateConfig, pet: Pet) => {
      const service = getSelectedService();
      const emptyDetail = {
        total: 0,
        breakdown: service?.unit || "unité",
        isPuppy: false,
        surchargeTotal: 0,
        quantity: 0,
        unitPrice: 0,
        priceLines: [] as DisplayPriceLine[],
      };
      if (!service) return emptyDetail;

      const isYoung = pet.age !== undefined && pet.age !== null && pet.age < 1;

      let breakdown = "";
      const validSlots = getValidVisitSlots(config.visitSlots);
      let startDate = config.startDate;
      let endDate = config.endDate;

      if (isHourlyService(formData.serviceType)) {
          if (validSlots.length === 0) return { ...emptyDetail, isPuppy: isYoung };
          const dates = getUniqueVisitDates(validSlots);
          startDate = dates[0];
          endDate = dates[dates.length - 1];
          breakdown = formData.serviceType === "DOG_WALKING" ? "promenades" : "visites";
      } else {
          if (!config.startDate || !config.endDate) return { ...emptyDetail, isPuppy: isYoung };

          const start = new Date(`${config.startDate}T${config.startTime}`);
          const end = new Date(`${config.endDate}T${config.endTime}`);

          if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ...emptyDetail, isPuppy: isYoung };

          const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          if (totalHours <= 0) return { ...emptyDetail, isPuppy: isYoung };

          if (isOvernightServiceType(formData.serviceType)) {
              if (getCalendarDayDifference(config.startDate, config.endDate) <= 0) return { ...emptyDetail, isPuppy: isYoung };
              breakdown = "nuits";
          } else {
              if (getInclusiveCalendarDayCount(config.startDate, config.endDate) <= 0) return { ...emptyDetail, isPuppy: isYoung };
              breakdown = "jours";
          }
      }

      const pricingContextPets = pets
        .filter((candidate) => formData.petIds.includes(candidate.id))
        .map((candidate) => ({
          id: candidate.id,
          species: candidate.species || "DOG",
          age: candidate.age,
        }));
      const priceResult = calculateBookingPrice({
        serviceType: formData.serviceType,
        pets: [{
          id: pet.id,
          species: pet.species || "DOG",
          age: pet.age,
        }],
        pricingContextPets,
        startDate,
        endDate,
        startTime: config.startTime,
        endTime: config.endTime,
        visitSlots: validSlots,
      });
      const petPrice = priceResult.pets[0];
      if (!petPrice) return { ...emptyDetail, isPuppy: isYoung };

      const appliesSharedDurationExtra = !isHourlyService(formData.serviceType) ||
        !useSameDates ||
        getPrimarySelectedPetId() === pet.id;
      const durationExtraTotal = isHourlyService(formData.serviceType) && appliesSharedDurationExtra
        ? priceResult.durationExtra
        : 0;
      const priceLines: DisplayPriceLine[] = [
        ...(petPrice.rateGroups || []).map((group) => ({
          label: group.label,
          amount: group.total,
          type: group.type,
          unitPrice: group.unitPrice,
          quantity: group.quantity,
          total: group.total,
          dateKeys: group.dateKeys,
        })),
      ];

      if (durationExtraTotal > 0) {
        priceLines.push({ label: "Durée prolongée", amount: durationExtraTotal, type: "surcharge", total: durationExtraTotal });
      }

      return {
        total: petPrice.total + durationExtraTotal,
        breakdown,
        isPuppy: isYoung,
        surchargeTotal: 0,
        quantity: petPrice.quantity,
        unitPrice: petPrice.unitPrice,
        priceLines,
      };
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
      if (isHourlyService(formData.serviceType)) {
          return useSameDates
            ? getValidVisitSlots(visitSlots).length
            : Math.max(0, ...Object.values(petConfigs).map(c => getValidVisitSlots(c.visitSlots).length));
      }

      // Services à la date : nuits pour l'hébergement/garde au domicile, jours pour la garderie.
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

  const getBookingDateSummary = () => {
      if (isHourlyService(formData.serviceType)) {
          const dates = getUniqueVisitDates(visitSlots);
          if (dates.length === 0) return "Dates non renseignées";
          return dates.length === 1 ? dates[0] : `${dates[0]} au ${dates[dates.length - 1]}`;
      }

      if (!formData.startDate || !formData.endDate) return "Dates non renseignées";
      return `${formData.startDate} au ${formData.endDate}`;
  };

  const buildPriceIssueDescription = () => {
      const selectedService = getSelectedService();
      const selectedPets = pets
        .filter((pet) => formData.petIds.includes(pet.id))
        .map((pet) => `${pet.name} (${pet.species === "CAT" ? "chat" : "chien"})`)
        .join(", ") || "Aucun animal sélectionné";
      const total = couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice();
      const slotSummary = isHourlyService(formData.serviceType)
        ? `\nPassages: ${getValidVisitSlots(visitSlots).map((slot) => `${slot.date} ${slot.startTime} ${slot.duration}min`).join(", ")}`
        : "";

      return [
        "Question client sur le tarif affiché.",
        `Service: ${selectedService?.name || formData.serviceType}`,
        `Animaux: ${selectedPets}`,
        `Dates: ${getBookingDateSummary()}`,
        `Total affiché: ${formatPrice(total)}€`,
        couponStatus.applied && couponStatus.data ? `Code promo: ${couponStatus.data.coupon.code}` : "Code promo: aucun",
        slotSummary.trim(),
        priceIssueDescription.trim() ? `Message client: ${priceIssueDescription.trim()}` : "Message client: non renseigné",
      ].filter(Boolean).join("\n");
  };

  const submitPriceIssue = async () => {
      setPriceIssueSending(true);
      setPriceIssueError("");

      try {
        const res = await fetch("/api/report-bug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: buildPriceIssueDescription(),
            path: "/booking#pricing-question",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Le message n'a pas pu être envoyé.");
        }

        setPriceIssueSent(true);
        setPriceIssueDescription("");
      } catch (error) {
        setPriceIssueError(error instanceof Error ? error.message : "Le message n'a pas pu être envoyé.");
      } finally {
        setPriceIssueSending(false);
      }
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

    const bookingsToCreate = [];

    if (useSameDates) {
        const price = couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice();

        let startDate = formData.startDate;
        let endDate = formData.endDate;
        if (isHourlyService(formData.serviceType)) {
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
            if (isHourlyService(formData.serviceType)) {
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

    } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur de connexion");
        setIsLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  if (status === "loading" || status === "unauthenticated") return <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">🐾</div>;

  const selectedPetsList = pets.filter(p => formData.petIds.includes(p.id));
  const currentPetName = selectedPetsList.length > 0 ? selectedPetsList.map(p => p.name).join(", ") : "votre compagnon";
  const subscriptionComparison = getSubscriptionComparison();

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

                        {subscriptionComparison ? (
                          <>
                        <div className="grid grid-cols-2 gap-4 text-center mb-8">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-sm text-gray-500 mb-1">Paiement direct</p>
                                <p className="text-xl font-bold text-gray-900">{formatPrice(subscriptionComparison.cashTotal)}€</p>
                                <p className="mt-1 text-[10px] text-gray-500">Cette réservation seule</p>
                            </div>
                            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                                <p className="text-sm text-orange-600 font-bold mb-1">Avec abonnement</p>
                                <p className="text-2xl font-bold text-orange-700">{formatPrice(subscriptionComparison.monthly.equivalentReservationCost)}€</p>
                                <p className="mt-1 text-[10px] text-orange-600">
                                  {subscriptionComparison.creditCost} crédits x {formatPrice(subscriptionComparison.monthly.effectiveCreditPrice)}€
                                </p>
                            </div>
                        </div>

                        <div className="mb-8 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-sm text-gray-700">
                          <div className="flex justify-between gap-4">
                            <span>Formule conseillée</span>
                            <strong className="text-right text-gray-950">
                              {subscriptionComparison.recommendedDaysPerWeek} jour{subscriptionComparison.recommendedDaysPerWeek > 1 ? "s" : ""}/semaine
                            </strong>
                          </div>
                          <div className="mt-2 flex justify-between gap-4">
                            <span>Coût de la formule</span>
                            <strong className="text-right text-gray-950">
                              {formatPrice(subscriptionComparison.monthly.monthlyPrice)}€/mois
                            </strong>
                          </div>
                          <div className="mt-2 flex justify-between gap-4 text-green-700">
                            <span>Économie sur cette réservation</span>
                            <strong className="text-right">
                              {formatPrice(subscriptionComparison.monthly.savingsOnReservation)}€
                            </strong>
                          </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>{subscriptionComparison.monthly.creditsPerMonth} crédits inclus chaque mois</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Prix par crédit : {formatPrice(subscriptionComparison.monthly.effectiveCreditPrice)}€ au lieu du tarif à la carte</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Option annuelle : {formatPrice(subscriptionComparison.yearly.amountDueNow)}€ pour {subscriptionComparison.yearly.creditsPerMonth * 12} crédits</span>
                            </div>
                        </div>
                          </>
                        ) : (
                          <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                            Finalisez vos dates pour comparer le paiement direct avec les formules Club La Meute.
                          </div>
                        )}

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
                        <div key={s.value} onClick={() => !isDisabled && setFormData({ ...formData, serviceType: s.value })}
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
                         {(isOvernightServiceType(formData.serviceType) || formData.serviceType === "DAY_CARE") && (
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
                                const rateLines = details.priceLines?.filter((line) => line.type === "base") || [];
                                const durationExtraTotal = details.priceLines?.find((line) => line.label === "Durée prolongée")?.amount || 0;
                                const otherSurchargeLines = details.priceLines?.filter((line) =>
                                  line.type === "surcharge" &&
                                  line.label !== "Durée prolongée"
                                ) || [];

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

                                          {rateLines.map((line, idx) => {
                                            const dateSummary = formatDateKeyRanges(line.dateKeys);
                                            return (
                                              <div key={`${line.label}-${idx}`} className="flex items-start justify-between gap-4 text-xs text-gray-700">
                                                <div className="min-w-0">
                                                  <p className="font-semibold text-gray-900">{line.label}</p>
                                                  <p className="mt-0.5 text-gray-500">
                                                    {line.quantity || 1} {details.breakdown} x {formatPrice(line.unitPrice || 0)}€
                                                  </p>
                                                  {dateSummary && (
                                                    <p className="mt-0.5 text-orange-700">
                                                      Dates concernées : {dateSummary}
                                                    </p>
                                                  )}
                                                </div>
                                                <span className="shrink-0 font-semibold text-gray-900">{formatPrice(line.total || line.amount)}€</span>
                                              </div>
                                            );
                                          })}

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
                                            <span>{formatPrice(details.total)}€</span>
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

                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-bold">Un doute sur ce tarif ?</p>
                                        <p className="mt-1 text-xs leading-5 text-amber-800">
                                            Envoyez le récapitulatif à l&apos;équipe avant de payer. La réservation ne sera pas validée tant que vous ne cliquez pas sur le paiement.
                                        </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setPriceIssueOpen(true);
                                        setPriceIssueSent(false);
                                        setPriceIssueError("");
                                      }}
                                      className="h-11 shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                                    >
                                      <MessageCircleQuestion className="h-4 w-4" />
                                      Question tarif
                                    </Button>
                                </div>
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
                    {subscriptionComparison && userCredits < calculateCreditCost() && (
                        <div className="relative overflow-hidden rounded-2xl bg-gray-950 p-6 text-white shadow-lg">
                            <div className="relative z-10 space-y-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-400">Bon plan</p>
                                    <h4 className="text-lg font-bold">Comparer avant de payer</h4>
                                    <p className="text-sm text-gray-300 mt-1">
                                        Cette réservation coûte {formatPrice(subscriptionComparison.cashTotal)}€ en paiement direct. Avec une formule, elle consommerait {subscriptionComparison.creditCost} crédits.
                                    </p>
                                  </div>
                                  <Button size="sm" onClick={() => setShowUpsellModal(true)} className="whitespace-nowrap bg-white text-gray-900 hover:bg-orange-50">
                                      Détail
                                  </Button>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                                    <p className="text-xs text-gray-300">Paiement direct</p>
                                    <p className="mt-1 text-2xl font-bold">{formatPrice(subscriptionComparison.cashTotal)}€</p>
                                    {couponStatus.applied && (
                                      <p className="mt-1 text-xs text-gray-400">Code promo inclus</p>
                                    )}
                                  </div>
                                  <div className="rounded-xl border border-orange-300/40 bg-orange-300/10 p-4">
                                    <p className="text-xs text-orange-200">Équivalent abonnement</p>
                                    <p className="mt-1 text-2xl font-bold text-orange-100">
                                      {formatPrice(subscriptionComparison.monthly.equivalentReservationCost)}€
                                    </p>
                                    <p className="mt-1 text-xs text-orange-100">
                                      soit {formatPrice(subscriptionComparison.monthly.savingsOnReservation)}€ d&apos;économie
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 sm:flex-row sm:items-center sm:justify-between">
                                  <span>
                                    Formule conseillée : {subscriptionComparison.recommendedDaysPerWeek} jour{subscriptionComparison.recommendedDaysPerWeek > 1 ? "s" : ""}/semaine, {subscriptionComparison.monthly.creditsPerMonth} crédits/mois.
                                  </span>
                                  <Link href="/subscriptions" className="shrink-0 rounded-lg bg-white px-4 py-2 text-center text-sm font-bold text-gray-950 hover:bg-orange-50">
                                    Voir les abonnements
                                  </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {!subscriptionComparison && calculateTotalPrice() > 0 && formData.petIds.length > 3 && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Abonnement</p>
                                <h4 className="mt-1 text-lg font-bold text-gray-950">
                                  Formule personnalisée à demander
                                </h4>
                                <p className="mt-1 text-sm leading-6 text-gray-600">
                                  Les abonnements standards couvrent jusqu&apos;à 3 animaux. Pour cette réservation, demandez une vérification avant de payer.
                                </p>
                              </div>
                              <Link href="/subscriptions" className="shrink-0 rounded-lg border border-gray-300 px-4 py-3 text-center text-sm font-bold text-gray-900 hover:bg-gray-50">
                                Voir les formules
                              </Link>
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
                            J&apos;accepte les <Link href="/legal/cgv" target="_blank" className="underline text-orange-600 hover:text-orange-800">Conditions Générales de Vente</Link> et la <Link href="/legal/confidentialite" target="_blank" className="underline text-orange-600 hover:text-orange-800">Politique de Confidentialité</Link>. Je reconnais que l&apos;annulation est gratuite jusqu&apos;à 48h avant le début de la garde.
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

      <AnimatePresence>
        {priceIssueOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-orange-700">Question tarif</p>
                  <h3 className="mt-1 text-xl font-bold text-gray-950">Le total semble incorrect ?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPriceIssueOpen(false)}
                  aria-label="Fermer"
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {priceIssueSent ? (
                <div className="py-8 text-center text-green-700">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10" />
                  <p className="font-bold">Message envoyé.</p>
                  <p className="mt-2 text-sm text-gray-600">
                    L&apos;équipe pourra vérifier le calcul avec le détail de votre réservation.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setPriceIssueOpen(false)}
                    className="mt-5 bg-gray-900 text-white hover:bg-orange-600"
                  >
                    Fermer
                  </Button>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="flex justify-between gap-3">
                      <span>Service</span>
                      <strong className="text-right text-gray-950">{getSelectedService()?.name}</strong>
                    </div>
                    <div className="mt-2 flex justify-between gap-3">
                      <span>Dates</span>
                      <strong className="text-right text-gray-950">{getBookingDateSummary()}</strong>
                    </div>
                    <div className="mt-2 flex justify-between gap-3">
                      <span>Total affiché</span>
                      <strong className="text-right text-green-700">
                        {formatPrice(couponStatus.applied && couponStatus.data ? couponStatus.data.finalAmount : calculateTotalPrice())}€
                      </strong>
                    </div>
                  </div>

                  <div>
                    <Label>Ce qui vous semble incorrect</Label>
                    <textarea
                      className="mt-2 h-28 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Exemple : j'ai choisi une date hors haute saison, ou le supplément 1h me semble doublé..."
                      value={priceIssueDescription}
                      onChange={(event) => setPriceIssueDescription(event.target.value)}
                    />
                  </div>

                  {priceIssueError && (
                    <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{priceIssueError}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPriceIssueOpen(false)}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      onClick={submitPriceIssue}
                      disabled={priceIssueSending}
                      className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                    >
                      {priceIssueSending ? "Envoi..." : "Envoyer"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
