"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  MessageCircleQuestion,
  MoonStar,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { calculatePawsEarned } from "@/lib/loyalty";
import { selectBestBookingDiscount } from "@/lib/booking-discounts";
import {
  calculateBookingPrice,
  LAST_MINUTE_LABEL,
  LAST_MINUTE_DESCRIPTION,
  CAT_VISIT_PRICING_DESCRIPTION,
  calculateSameDayDurationMinutes,
  calculateServiceDurationMinutes,
  DOG_DAY_CARE_MAX_MINUTES,
  DOG_CARE_PERIOD_MINUTES,
  getHouseSittingDurationTier,
  getServiceDisplayPrice,
  getServiceDisplayPriceForDuration,
  isValidDayCareSchedule,
  EXTRA_DURATION,
  HOUSE_SITTING_DURATION_TIERS,
  LONG_BOARDING_DISCOUNT_RATE,
  LONG_BOARDING_MIN_PERIODS,
  YOUNG_ANIMAL_SURCHARGE,
  type Species,
  type PriceLine,
} from "@/lib/pricing";
import {
  isHourlyServiceType,
  isOvernightServiceType,
  type AppServiceType,
} from "@/lib/services";
import { ATTENDANCE_SUMMARY } from "@/lib/booking-attendance";
import { LEGAL_DOCUMENT_VERSION, LEGAL_DOCUMENT_VERSION_LABEL, LEGAL_INFORMATION } from "@/lib/legal";
import {
  formatPetAge,
  getPetProfileCompletion,
  isPetBirthDateVerified,
  isPetUnderOneYearOn,
} from "@/lib/pets";
import {
  addCalendarDays,
  buildDateRange,
  dateKeyToLocalDate,
  getCalendarDayDifference,
  getInclusiveCalendarDayCount,
  getNextWeekendRange,
  getTodayDateKey,
  isPositiveSameDayTimeRange,
  localDateToDateKey,
} from "@/lib/booking-dates";

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
    unit: "période de 24 h",
    description: "Votre compagnon vit avec nous, avec nuit, accès canapé et jardin inclus. Le tarif suit des périodes réelles de 24 h à partir de l’arrivée.",
    icon: "🏠",
    maxHours: 24,
    maxPets: 3,
  },
  {
    value: "HOUSE_SITTING",
    name: "Garde à votre domicile",
    unit: "garde",
    description: "Une présence prolongée chez vous, sur une ou plusieurs journées sans nuitée : repas, sorties, compagnie, surveillance et respect de la routine habituelle.",
    icon: "🛏️",
    maxHours: 24,
    maxPets: 3,
  },
  {
    value: "DAY_CARE",
    name: "Garderie de jour au domicile du pet-sitter",
    unit: "jour",
    description: "Déposez votre compagnon le matin et récupérez-le le soir. Repas, jeux, repos et promenades selon ses habitudes. Soumise à disponibilité et à compatibilité avec les animaux déjà présents.",
    icon: "☀️",
    maxHours: 10,
    maxPets: 3,
  },
  {
    value: "DROP_IN",
    name: "Visite à votre domicile",
    unit: "visite",
    description: "Un passage ponctuel chez vous pour les repas, la litière, les soins simples, les sorties et un moment de présence.",
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
  breed: string | null;
  species: Species;
  age?: number | null;
  birthDate?: string | null;
  birthDateProofUrl?: string | null;
  birthDateVerifiedAt?: string | null;
  weight?: number | null;
  gender?: string | null;
  spayedNeutered?: boolean | null;
  medicalInfo?: string | null;
  behaviorNotes?: string | null;
  feedingSchedule?: string | null;
  medications?: string | null;
  vetInfo?: string | null;
  emergencyContact?: string | null;
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
const defaultVisitDuration = () => 30;
const defaultVisitTime = "09:00";
const boardingDefaultTime = "18:00";

const serviceDefaultTimes: Record<string, { startTime: string; endTime: string }> = {
  BOARDING: { startTime: boardingDefaultTime, endTime: boardingDefaultTime },
  HOUSE_SITTING: { startTime: "09:30", endTime: "19:30" },
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

const formatShortDate = (dateKey: string) =>
  dateKeyToLocalDate(dateKey).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });

const formatVisitDuration = (duration: number) => {
  if (duration === 60) return "1 h";
  if (duration === 90) return "1 h 30";
  if (duration === 120) return "2 h";
  return `${duration} min`;
};

const formatElapsedDuration = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
};

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

const localeCodes = { fr: "fr-FR", en: "en-GB", es: "es-ES" } as const;

const ResidentCatsNotice = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useLanguage();

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-950 ${compact ? "px-4 py-3" : "p-5"}`}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm" aria-hidden="true">
        🐈
      </div>
      <div>
        <p className="font-bold">{t("Deux chats vivent à la maison")}</p>
        <p className="mt-1 text-sm leading-6 text-sky-900">
          {t("Pour la garderie et l'hébergement, la compatibilité est prise en compte. Si la cohabitation avec votre animal n'est pas sereine, nos chats restent dans un espace séparé.")}
        </p>
      </div>
    </div>
  );
};

const DateSelector = ({ config, onChange, serviceType }: { config: DateConfig; onChange: (c: DateConfig) => void; serviceType: string }) => {
  const { t, locale } = useLanguage();
  const today = getTodayDateKey();
  const tomorrow = addCalendarDays(today, 1);
  const weekend = getNextWeekendRange(today);
  const localeCode = localeCodes[locale];
  const isHourly = isHourlyService(serviceType);
  const isHouseSitting = serviceType === "HOUSE_SITTING";
  const [batchStartDate, setBatchStartDate] = useState("");
  const [batchEndDate, setBatchEndDate] = useState("");
  const [batchVisitsPerDay, setBatchVisitsPerDay] = useState(1);
  const [batchDuration, setBatchDuration] = useState(defaultVisitDuration());
  const [batchTimes, setBatchTimes] = useState<string[]>([defaultVisitTime, "13:00", "18:00"]);

  const formatDate = (dateKey: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
    dateKeyToLocalDate(dateKey).toLocaleDateString(localeCode, options);

  const shortcutClass = (selected: boolean) =>
    `min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${selected
      ? "border-orange-500 bg-orange-50 text-orange-900 shadow-sm"
      : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/50"}`;

  const renderDateShortcuts = (selectedDate: string, setDate: (date: string) => void, setWeekendRange?: () => void) => (
    <div className="grid grid-cols-3 gap-2" aria-label={t("Dates rapides")}>
      <button type="button" className={shortcutClass(selectedDate === today)} aria-pressed={selectedDate === today} onClick={() => setDate(today)}>
        <span className="block">{t("Aujourd’hui")}</span>
        <span className="block text-xs font-normal text-gray-500">{formatDate(today, { day: "numeric", month: "short" })}</span>
      </button>
      <button type="button" className={shortcutClass(selectedDate === tomorrow)} aria-pressed={selectedDate === tomorrow} onClick={() => setDate(tomorrow)}>
        <span className="block">{t("Demain")}</span>
        <span className="block text-xs font-normal text-gray-500">{formatDate(tomorrow, { day: "numeric", month: "short" })}</span>
      </button>
      <button type="button" className={shortcutClass(selectedDate === weekend.startDate && selectedDate !== today && selectedDate !== tomorrow)} aria-pressed={selectedDate === weekend.startDate && selectedDate !== today && selectedDate !== tomorrow} onClick={() => {
        if (setWeekendRange) setWeekendRange();
        else setDate(weekend.startDate);
      }}>
        <span className="block">{t("Ce week-end")}</span>
        <span className="block text-xs font-normal text-gray-500">{formatDate(weekend.startDate, { day: "numeric", month: "short" })}</span>
      </button>
    </div>
  );

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

  const normalizeVisitSlots = (slots: VisitSlot[]) => {
    const byKey = new Map<string, VisitSlot>();
    slots.filter((slot) => slot.date).forEach((slot) => byKey.set(`${slot.date}-${slot.startTime}`, slot));
    return sortVisitSlots([...byKey.values()]);
  };
  const updateVisitSlot = (index: number, changes: Partial<VisitSlot>) => onChange({
    ...config,
    visitSlots: config.visitSlots.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...changes } : slot),
  });
  const removeVisitSlot = (index: number) => onChange({ ...config, visitSlots: config.visitSlots.filter((_, slotIndex) => slotIndex !== index) });
  const addSingleSlot = (date?: string) => {
    const slotDate = date || batchStartDate || today;
    onChange({
      ...config,
      startDate: config.startDate || slotDate,
      endDate: slotDate > config.endDate ? slotDate : (config.endDate || slotDate),
      visitSlots: normalizeVisitSlots([...config.visitSlots, { date: slotDate, startTime: batchTimes[0] || defaultVisitTime, duration: batchDuration }]),
    });
  };
  const addRangeSlots = () => {
    const endDate = batchEndDate || batchStartDate;
    const dates = buildDateRange(batchStartDate, endDate);
    if (dates.length === 0) return;
    const newSlots = dates.flatMap((date) => Array.from({ length: batchVisitsPerDay }, (_, index) => ({
      date,
      startTime: batchTimes[index] || defaultVisitTime,
      duration: batchDuration,
    })));
    onChange({
      ...config,
      startDate: config.startDate && config.startDate < batchStartDate ? config.startDate : batchStartDate,
      endDate: config.endDate && config.endDate > endDate ? config.endDate : endDate,
      visitSlots: normalizeVisitSlots([...config.visitSlots, ...newSlots]),
    });
  };
  const batchDayCount = getInclusiveCalendarDayCount(batchStartDate, batchEndDate || batchStartDate);
  const batchSlotCount = batchDayCount * batchVisitsPerDay;

  if (isHourly) {
    const quickPresets = [
      { label: "1 passage", helper: "Matin", visits: 1, times: ["09:00"] },
      { label: "2 passages", helper: "Matin et midi", visits: 2, times: ["09:00", "13:00"] },
      { label: "3 passages", helper: "Matin, midi et soir", visits: 3, times: ["09:00", "13:00", "18:00"] },
    ];
    const setBatchDate = (date: string) => {
      setBatchStartDate(date);
      setBatchEndDate(date);
    };
    return (
      <div data-no-translate className="space-y-5">
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex gap-3 border-b border-gray-100 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Sparkles className="size-5" /></div>
            <div>
              <h3 className="font-bold text-gray-950">{t("Composer le planning")}</h3>
              <p className="mt-1 text-sm leading-5 text-gray-500">{t("Ajoutez un jour ponctuel ou plusieurs jours d’un coup. Vous pourrez ensuite ajuster chaque passage.")}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="mb-2 block">{t("Choisir rapidement")}</Label>
              {renderDateShortcuts(batchStartDate, setBatchDate, () => {
                setBatchStartDate(weekend.startDate);
                setBatchEndDate(weekend.endDate);
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="batch-start-date">{t("Date de début")}</Label>
                <Input id="batch-start-date" type="date" min={today} className="bg-white" value={batchStartDate} onChange={(event) => {
                  setBatchStartDate(event.target.value);
                  if (!batchEndDate || batchEndDate < event.target.value) setBatchEndDate(event.target.value);
                }} />
              </div>
              <div>
                <Label htmlFor="batch-end-date">{t("Date de fin")}</Label>
                <Input id="batch-end-date" type="date" min={batchStartDate || today} className="bg-white" value={batchEndDate} onChange={(event) => setBatchEndDate(event.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">{t("Rythme souhaité")}</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {quickPresets.map((preset) => (
                  <button key={preset.label} type="button" aria-pressed={batchVisitsPerDay === preset.visits} onClick={() => {
                    setBatchVisitsPerDay(preset.visits);
                    setBatchTimes((times) => times.map((time, index) => preset.times[index] || time));
                  }} className={shortcutClass(batchVisitsPerDay === preset.visits)}>
                    <span className="block">{t(preset.label)}</span>
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">{t(preset.helper)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="batch-duration">{t("Durée de chaque passage")}</Label>
                <select id="batch-duration" className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm" value={batchDuration} onChange={(event) => setBatchDuration(Number(event.target.value))}>
                  <option value={30}>30 min</option><option value={60}>1 h</option><option value={90}>1 h 30</option><option value={120}>2 h</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: batchVisitsPerDay }, (_, index) => (
                  <div key={index} className={batchVisitsPerDay === 1 ? "col-span-3" : ""}>
                    <Label htmlFor={`batch-time-${index}`}>{batchVisitsPerDay === 1 ? t("Heure") : `${index + 1}`}</Label>
                    <Input id={`batch-time-${index}`} type="time" className="bg-white" value={batchTimes[index] || defaultVisitTime} onChange={(event) => setBatchTimes((times) => {
                      const next = [...times]; next[index] = event.target.value; return next;
                    })} />
                  </div>
                ))}
              </div>
            </div>
            {batchSlotCount > 0 && (
              <p className="rounded-xl bg-orange-50 px-3 py-2 text-center text-sm font-medium text-orange-900">
                {batchSlotCount} {t(batchSlotCount > 1 ? "passages prêts à être ajoutés" : "passage prêt à être ajouté")} · {batchDayCount} {t(batchDayCount > 1 ? "jours" : "jour")}
              </p>
            )}
            <Button type="button" className="h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600" onClick={addRangeSlots} disabled={!batchStartDate || batchDayCount === 0}>
              <Plus className="mr-2 size-4" />{t(config.visitSlots.length > 0 ? "Ajouter au planning" : "Créer le planning")}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-bold text-gray-950">{t("Planning sélectionné")}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {selectedSlotItems.length > 0
                  ? `${selectedSlotItems.length} ${t(selectedSlotItems.length > 1 ? "passages" : "passage")} · ${selectedDateCount} ${t(selectedDateCount > 1 ? "jours" : "jour")}`
                  : t("Aucun passage ajouté pour le moment.")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addSingleSlot()}><Plus className="mr-1 size-4" />{t("Passage")}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...config, startDate: "", endDate: "", visitSlots: [] })} disabled={selectedSlotItems.length === 0}><RotateCcw className="mr-1 size-4" />{t("Vider")}</Button>
            </div>
          </div>
          {selectedSlotItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-600">{t("Choisissez une date et ajoutez-la au planning.")}</div>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(groupedSlots).map(([date, items]) => (
                <div key={date} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-bold capitalize text-gray-950">{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => addSingleSlot(date)} aria-label={t("Ajouter un passage ce jour")}><Plus className="size-4" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map(({ slot, index }) => (
                      <div key={`${slot.date}-${slot.startTime}-${index}`} className="grid grid-cols-[1fr_1fr_40px] gap-2">
                        <Input type="time" aria-label={t("Heure du passage")} className="bg-white" value={slot.startTime} onChange={(event) => updateVisitSlot(index, { startTime: event.target.value })} />
                        <select aria-label={t("Durée du passage")} className="h-10 rounded-md border border-gray-200 bg-white px-2 text-sm" value={slot.duration} onChange={(event) => updateVisitSlot(index, { duration: Number(event.target.value) })}>
                          <option value={30}>30 min</option><option value={60}>1 h</option><option value={90}>1 h 30</option><option value={120}>2 h</option>
                        </select>
                        <Button type="button" variant="outline" size="icon" onClick={() => removeVisitSlot(index)} aria-label={t("Supprimer ce passage")}><Trash2 className="size-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (isHouseSitting) {
    const dayCount = getInclusiveCalendarDayCount(config.startDate, config.endDate);
    const dailyDurationMinutes = calculateSameDayDurationMinutes(config);
    const durationTier = getHouseSittingDurationTier(dailyDurationMinutes);
    const datesValid = dayCount > 0;
    const timeRangeValid = isPositiveSameDayTimeRange(config.startTime, config.endTime);
    const schedulePresets = [
      { label: "Demi-journée", helper: "08:00–13:00", startTime: "08:00", endTime: "13:00" },
      { label: "Journée Disneyland", helper: "09:30–19:30", startTime: "09:30", endTime: "19:30" },
      { label: "Soirée au parc", helper: "18:00–22:30", startTime: "18:00", endTime: "22:30" },
      { label: "Disney + soirée", helper: "09:30–23:30", startTime: "09:30", endTime: "23:30" },
    ];
    const setHouseStartDate = (date: string) => onChange({
      ...config,
      startDate: date,
      endDate: !config.endDate || config.endDate < date ? date : config.endDate,
    });
    const setSingleHouseDate = (date: string) => onChange({ ...config, startDate: date, endDate: date });
    const setHouseDayCount = (days: number) => {
      const startDate = config.startDate || today;
      onChange({ ...config, startDate, endDate: addCalendarDays(startDate, days - 1) });
    };

    return (
      <div data-no-translate className="space-y-5">
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex gap-3 border-b border-gray-100 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><CalendarDays className="size-5" /></div>
            <div>
              <h3 className="font-bold text-gray-950">{t("Planifier les journées de garde")}</h3>
              <p className="mt-1 text-sm text-gray-500">{t("Choisissez une ou plusieurs journées. Les mêmes horaires seront appliqués chaque jour, sans nuitée.")}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="mb-2 block">{t("Dates rapides")}</Label>
              {renderDateShortcuts(config.startDate, setSingleHouseDate, () => onChange({ ...config, startDate: weekend.startDate, endDate: weekend.endDate }))}
            </div>
            <div>
              <Label className="mb-2 block">{t("Nombre de journées")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((days) => (
                  <button key={days} type="button" className={shortcutClass(dayCount === days)} aria-pressed={dayCount === days} onClick={() => setHouseDayCount(days)}>
                    {days} {t(days > 1 ? "journées" : "journée")}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="house-start-date">{t("Première journée")}</Label>
                <Input id="house-start-date" type="date" min={today} className="bg-white" value={config.startDate} onChange={(event) => setHouseStartDate(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="house-end-date">{t("Dernière journée")}</Label>
                <Input id="house-end-date" type="date" min={config.startDate || today} className="bg-white" value={config.endDate} onChange={(event) => onChange({ ...config, endDate: event.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">{t("Horaires pratiques")}</Label>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {schedulePresets.map((preset) => {
                  const selected = config.startTime === preset.startTime && config.endTime === preset.endTime;
                  return (
                    <button key={preset.label} type="button" aria-pressed={selected} className={shortcutClass(selected)} onClick={() => onChange({ ...config, startTime: preset.startTime, endTime: preset.endTime })}>
                      <span className="block">{t(preset.label)}</span>
                      <span className="block text-xs font-normal text-gray-500">{preset.helper}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="house-start-time">{t("Début chaque jour")}</Label><Input id="house-start-time" type="time" className="bg-white" value={config.startTime} onChange={(event) => onChange({ ...config, startTime: event.target.value })} /></div>
              <div><Label htmlFor="house-end-time">{t("Fin chaque jour")}</Label><Input id="house-end-time" type="time" className="bg-white" value={config.endTime} onChange={(event) => onChange({ ...config, endTime: event.target.value })} /></div>
            </div>
          </div>
        </section>

        {datesValid && timeRangeValid && durationTier ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0" /><strong>{dayCount} {t(dayCount > 1 ? "journées sélectionnées" : "journée sélectionnée")}</strong></span>
              <span className="font-semibold">{formatElapsedDuration(dailyDurationMinutes)} {t("par jour")} · {t(durationTier.label)}</span>
            </div>
            <p className="mt-2 capitalize">{formatDate(config.startDate, { weekday: "long", day: "numeric", month: "long" })}{dayCount > 1 ? ` → ${formatDate(config.endDate, { weekday: "long", day: "numeric", month: "long" })}` : ""} · {config.startTime}–{config.endTime}</p>
          </div>
        ) : (config.startDate || config.endDate) && !timeRangeValid ? (
          <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{t("La fin doit être après le début le même jour. Les créneaux de nuit ne sont pas acceptés.")}</span></div>
        ) : null}

        <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {t("Chaque date correspond à une garde en journée aux horaires choisis. Pour une présence pendant la nuit, choisissez l’hébergement.")}
        </div>
      </div>
    );
  }

  if (serviceType === "DAY_CARE") {
    const dayCount = getInclusiveCalendarDayCount(config.startDate, config.endDate);
    const durationMinutes = calculateSameDayDurationMinutes(config);
    const timeRangeValid = isPositiveSameDayTimeRange(config.startTime, config.endTime);
    const datesValid = dayCount > 0;
    const dayCareTooLong = durationMinutes > DOG_DAY_CARE_MAX_MINUTES;
    const schedulePresets = [
      { label: "Dépose tôt", helper: "08:00–18:00", startTime: "08:00", endTime: "18:00" },
      { label: "Journée standard", helper: "09:00–18:00", startTime: "09:00", endTime: "18:00" },
      { label: "Dépose tard", helper: "10:00–18:00", startTime: "10:00", endTime: "18:00" },
    ];
    const setDayCareStartDate = (date: string) => onChange({
      ...config,
      startDate: date,
      endDate: !config.endDate || config.endDate < date ? date : config.endDate,
    });
    const setSingleDayCareDate = (date: string) => onChange({ ...config, startDate: date, endDate: date });
    const setDayCareDayCount = (days: number) => {
      const startDate = config.startDate || today;
      onChange({ ...config, startDate, endDate: addCalendarDays(startDate, days - 1) });
    };

    return (
      <div data-no-translate className="space-y-5">
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex gap-3 border-b border-gray-100 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><CalendarDays className="size-5" /></div>
            <div><h3 className="font-bold text-gray-950">{t("Planifier les journées de garde")}</h3><p className="mt-1 text-sm text-gray-500">{t("Choisissez une ou plusieurs journées. Les mêmes horaires seront appliqués chaque jour, sans nuitée.")}</p></div>
          </div>
          <div className="space-y-5">
            {renderDateShortcuts(config.startDate, setSingleDayCareDate, () => onChange({ ...config, startDate: weekend.startDate, endDate: weekend.endDate }))}
            <div>
              <Label className="mb-2 block">{t("Nombre de journées")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((days) => (
                  <button key={days} type="button" className={shortcutClass(dayCount === days)} aria-pressed={dayCount === days} onClick={() => setDayCareDayCount(days)}>
                    {days} {t(days > 1 ? "journées" : "journée")}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="day-care-start-date">{t("Première journée")}</Label>
                <Input id="day-care-start-date" type="date" className="bg-white" value={config.startDate} onChange={(event) => setDayCareStartDate(event.target.value)} min={today} />
              </div>
              <div>
                <Label htmlFor="day-care-end-date">{t("Dernière journée")}</Label>
                <Input id="day-care-end-date" type="date" className="bg-white" value={config.endDate} onChange={(event) => onChange({ ...config, endDate: event.target.value })} min={config.startDate || today} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">{t("Horaires pratiques")}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {schedulePresets.map((preset) => {
                  const selected = config.startTime === preset.startTime && config.endTime === preset.endTime;
                  return <button key={preset.label} type="button" aria-pressed={selected} className={shortcutClass(selected)} onClick={() => onChange({ ...config, startTime: preset.startTime, endTime: preset.endTime })}><span className="block">{t(preset.label)}</span><span className="block text-xs font-normal text-gray-500">{preset.helper}</span></button>;
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="day-care-start-time">{t("Début chaque jour")}</Label><Input id="day-care-start-time" type="time" className="bg-white" value={config.startTime} onChange={(event) => onChange({ ...config, startTime: event.target.value })} /></div>
              <div><Label htmlFor="day-care-end-time">{t("Fin chaque jour")}</Label><Input id="day-care-end-time" type="time" className="bg-white" value={config.endTime} onChange={(event) => onChange({ ...config, endTime: event.target.value })} /></div>
            </div>
          </div>
        </section>
        {datesValid && timeRangeValid && !dayCareTooLong ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><CheckCircle2 className="size-4" /><strong>{dayCount} {t(dayCount > 1 ? "journées sélectionnées" : "journée sélectionnée")}</strong></span>
            <span className="font-semibold">{formatElapsedDuration(durationMinutes)} {t("par jour")}</span>
          </div>
        ) : (config.startDate || config.endDate) && (!timeRangeValid || dayCareTooLong) ? (
          <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{t(dayCareTooLong ? "La garderie est limitée à 10 heures par jour. Ajustez l’heure de début ou de fin." : "L’heure de fin doit être postérieure à l’heure de début.")}</span></div>
        ) : null}
        <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {t("Chaque date correspond à une garde en journée aux horaires choisis. Pour une présence pendant la nuit, choisissez l’hébergement.")}
        </div>
      </div>
    );
  }

  const stayDurationMinutes = calculateServiceDurationMinutes(config);
  const stayPeriods = stayDurationMinutes > 0
    ? Math.ceil(stayDurationMinutes / DOG_CARE_PERIOD_MINUTES)
    : 0;
  const stayValid = getCalendarDayDifference(config.startDate, config.endDate) > 0 && stayPeriods > 0;
  const hasPartialPeriod = stayDurationMinutes % DOG_CARE_PERIOD_MINUTES !== 0;
  const setBoardingStart = (date: string) => onChange({
    ...config,
    startDate: date,
    endDate: !config.endDate || config.endDate <= date ? addCalendarDays(date, 1) : config.endDate,
  });
  const setStayLength = (periods: number) => {
    const startDate = config.startDate || today;
    const startTime = config.startTime || boardingDefaultTime;
    onChange({ ...config, startDate, endDate: addCalendarDays(startDate, periods), startTime, endTime: startTime });
  };
  return (
    <div data-no-translate className="space-y-5">
      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex gap-3 border-b border-gray-100 pb-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><MoonStar className="size-5" /></div>
          <div><h3 className="font-bold text-gray-950">{t("Planifier le séjour")}</h3><p className="mt-1 text-sm text-gray-500">{t("Choisissez l’arrivée et le départ. Le tarif est calculé depuis l’heure d’arrivée, par période de 24 h commencée.")}</p></div>
        </div>
        <div className="space-y-5">
          <div><Label className="mb-2 block">{t("Arrivée rapide")}</Label>{renderDateShortcuts(config.startDate, setBoardingStart, () => onChange({ ...config, startDate: weekend.startDate, endDate: weekend.endDate, startTime: boardingDefaultTime, endTime: boardingDefaultTime }))}</div>
          <div>
            <Label className="mb-2 block">{t("Durée du séjour")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 7].map((periods) => <button key={periods} type="button" className={shortcutClass(stayPeriods === periods && !hasPartialPeriod)} aria-pressed={stayPeriods === periods && !hasPartialPeriod} onClick={() => setStayLength(periods)}>{periods} {t(periods > 1 ? "périodes de 24 h" : "période de 24 h")}</button>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <Label htmlFor="boarding-start-date">{t("Arrivée")}</Label>
              <Input id="boarding-start-date" type="date" className="mt-1 bg-white" value={config.startDate} onChange={(event) => setBoardingStart(event.target.value)} min={today} />
              <Label htmlFor="boarding-start-time" className="mt-3">{t("Heure d’arrivée")}</Label>
              <Input id="boarding-start-time" type="time" className="mt-1 bg-white" value={config.startTime} onChange={(event) => onChange({ ...config, startTime: event.target.value })} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <Label htmlFor="boarding-end-date">{t("Départ")}</Label>
              <Input id="boarding-end-date" type="date" className="mt-1 bg-white" value={config.endDate} onChange={(event) => onChange({ ...config, endDate: event.target.value })} min={config.startDate ? addCalendarDays(config.startDate, 1) : tomorrow} />
              <Label htmlFor="boarding-end-time" className="mt-3">{t("Heure de départ")}</Label>
              <Input id="boarding-end-time" type="time" className="mt-1 bg-white" value={config.endTime} onChange={(event) => onChange({ ...config, endTime: event.target.value })} />
            </div>
          </div>
        </div>
      </section>
      {stayValid && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
          <div className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="size-4" />{stayPeriods} {t(stayPeriods > 1 ? "périodes de 24 h facturées" : "période de 24 h facturée")}</div>
          <p className="mt-1 text-sm capitalize">{formatDate(config.startDate, { weekday: "long", day: "numeric", month: "long" })} {t("à")} {config.startTime} → {formatDate(config.endDate, { weekday: "long", day: "numeric", month: "long" })} {t("à")} {config.endTime}</p>
          <p className="mt-1 text-xs text-emerald-800">{formatElapsedDuration(stayDurationMinutes)} · {hasPartialPeriod ? t("La dernière période est entamée et facturée en entier.") : t("Durée exacte, sans dépassement.")}</p>
        </div>
      )}
    </div>
  );
};

export default function BookingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useLanguage();

  // États
  const [step, setStep] = useState(1);
  // Direction de l'animation : 1 = avant, -1 = arrière
  const [direction, setDirection] = useState(0);

  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pricingNow, setPricingNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setPricingNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

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

  const [isPremium, setIsPremium] = useState(false);

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
    setPetConfigs((currentConfigs) => {
      const initialConfig: Record<string, DateConfig> = {};
      formData.petIds.forEach((id) => {
        initialConfig[id] = currentConfigs[id] || {
          startDate: formData.startDate,
          endDate: formData.endDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          visitSlots: [...visitSlots],
        };
      });
      return initialConfig;
    });
  }, [
    formData.endDate,
    formData.endTime,
    formData.petIds,
    formData.startDate,
    formData.startTime,
    useSameDates,
    visitSlots,
  ]); // Re-sync when switching mode

  useEffect(() => {
    const fetchPremiumStatus = async () => {
      try {
        const res = await fetch("/api/user/subscription");
        if (res.ok) {
          const data = await res.json();
          setIsPremium(Boolean(data.premium?.isPremium));
        }
      } catch {}
    };
    if (session?.user) fetchPremiumStatus();
  }, [session]);

  // Coupons
  const [couponStatus, setCouponStatus] = useState<{
    applied: boolean;
    loading: boolean;
    isAuto: boolean;
    data: null | {
      coupon: {
        code: string;
        description?: string | null;
        discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TOTAL";
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
  const autoCouponAppliedRef = useRef("");

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

  useEffect(() => {
    const fetchAutoCoupon = async () => {
      try {
        const res = await fetch("/api/coupons/auto");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.autoCoupon?.code) return;

        setFormData((prev) => prev.promoCode ? prev : { ...prev, promoCode: data.autoCoupon.code });
        setCouponStatus((prev) => ({ ...prev, isAuto: true }));
      } catch {}
    };

    if (session?.user) fetchAutoCoupon();
  }, [session]);

  useEffect(() => {
    const hasSelectedCat = pets.some((pet) => formData.petIds.includes(pet.id) && pet.species === "CAT");
    if (formData.serviceType === "DOG_WALKING" && hasSelectedCat) {
      setFormData((prev) => ({ ...prev, serviceType: "BOARDING" }));
    }
  }, [formData.petIds, formData.serviceType, pets]);

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
    setPetConfigs((currentConfigs) => {
      const newConfigs = { ...currentConfigs };
      Object.keys(newConfigs).forEach((key) => {
        newConfigs[key] = {
          ...newConfigs[key],
          ...(defaultTimes
            ? { startTime: defaultTimes.startTime, endTime: defaultTimes.endTime }
            : {}),
          visitSlots: [createEmptyVisitSlot()],
        };
      });
      return newConfigs;
    });
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

      const selectionIsComplete = configsToCheck.every(({ config }) => {
        if (isHourlyService(formData.serviceType)) return getValidVisitSlots(config.visitSlots).length > 0;
        if (!config.startDate || !config.endDate) return false;
        if (formData.serviceType === "HOUSE_SITTING") {
          return getInclusiveCalendarDayCount(config.startDate, config.endDate) > 0
            && calculateSameDayDurationMinutes(config) > 0;
        }
        if (formData.serviceType === "DAY_CARE") {
          return isValidDayCareSchedule(config);
        }
        const durationMinutes = calculateServiceDurationMinutes(config);
        if (isOvernightServiceType(formData.serviceType)) {
          return getCalendarDayDifference(config.startDate, config.endDate) > 0 && durationMinutes > 0;
        }
        return durationMinutes > 0;
      });
      if (!selectionIsComplete) { resetAvailability(); return; }

      setAvailabilityStatus(p => ({ ...p, checking: true }));
      let allAvailable = true;
      let globalMessage = "";
      const allUnavailableDates: string[] = [];

      for (const item of configsToCheck) {
          const { config } = item;

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
             const params = new URLSearchParams({
               startDate: start,
               endDate: end,
               serviceType: formData.serviceType,
             });
             if (isHourlyService(formData.serviceType)) {
               params.set("dates", datesToCheck.join(","));
               params.set("slots", JSON.stringify(getValidVisitSlots(config.visitSlots)));
             }

             const res = await fetch(`/api/availability/check?${params.toString()}`);
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
          } catch { allAvailable = false; globalMessage = "Erreur connexion"; }
      }

      if (allAvailable && globalMessage === "") {
          setAvailabilityStatus({ checking: false, available: true, message: "Créneau disponible", unavailableDates: [] });
      } else {
          setAvailabilityStatus({ checking: false, available: false, message: globalMessage || "Créneau indisponible", unavailableDates: allUnavailableDates });
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

      const isYoung = pet.birthDate
        ? isPetUnderOneYearOn(pet.birthDate, config.startDate ? `${config.startDate}T12:00:00.000Z` : undefined)
        : pet.age !== undefined && pet.age !== null && pet.age < 1;

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

          if (formData.serviceType === "HOUSE_SITTING") {
              if (calculateSameDayDurationMinutes(config) <= 0 || getInclusiveCalendarDayCount(config.startDate, config.endDate) <= 0) {
                  return { ...emptyDetail, isPuppy: isYoung };
              }
              breakdown = "jours";
          } else if (formData.serviceType === "DAY_CARE") {
              if (!isValidDayCareSchedule(config)) {
                  return { ...emptyDetail, isPuppy: isYoung };
              }
              breakdown = "jours";
          } else {

              const start = new Date(`${config.startDate}T${config.startTime}`);
              const end = new Date(`${config.endDate}T${config.endTime}`);

              if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ...emptyDetail, isPuppy: isYoung };

              const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              if (totalHours <= 0) return { ...emptyDetail, isPuppy: isYoung };

              if (isOvernightServiceType(formData.serviceType)) {
                  if (getCalendarDayDifference(config.startDate, config.endDate) <= 0) return { ...emptyDetail, isPuppy: isYoung };
                  breakdown = "périodes de 24 h";
              } else {
                  if (getInclusiveCalendarDayCount(config.startDate, config.endDate) <= 0) return { ...emptyDetail, isPuppy: isYoung };
                  breakdown = "jours";
              }
          }
      }

      const pricingContextPets = pets
        .filter((candidate) => formData.petIds.includes(candidate.id))
        .map((candidate) => ({
          id: candidate.id,
          species: candidate.species || "DOG",
          age: candidate.age,
          birthDate: candidate.birthDate,
        }));
      const priceResult = calculateBookingPrice({
        serviceType: formData.serviceType,
        pets: useSameDates && isHourlyService(formData.serviceType) ? pricingContextPets : [{
          id: pet.id,
          species: pet.species || "DOG",
          age: pet.age,
          birthDate: pet.birthDate,
        }],
        pricingContextPets,
        startDate,
        endDate,
        startTime: config.startTime,
        endTime: config.endTime,
        visitSlots: validSlots,
        requestedAt: pricingNow,
      });
      const petPrice = priceResult.pets.find((pricedPet) => pricedPet.petId === pet.id);
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

      const lastMinuteFee = (!useSameDates || getPrimarySelectedPetId() === pet.id)
        ? priceResult.lastMinuteFee : 0;
      if (lastMinuteFee > 0) {
        priceLines.push({ label: LAST_MINUTE_LABEL, amount: lastMinuteFee, type: "surcharge", total: lastMinuteFee });
      }
      return {
        total: petPrice.total + durationExtraTotal + lastMinuteFee,
        breakdown,
        isPuppy: isYoung,
        surchargeTotal: lastMinuteFee,
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
              const details = calculatePriceDetailForPet(config, pet);
              total += details.total - details.surchargeTotal;
          }
      });
      return total;
  };

  const calculateLastMinuteTotal = () => formData.petIds.reduce((sum, id) => {
    const pet = pets.find(p => p.id === id);
    const config = useSameDates
      ? { startDate: formData.startDate, endDate: formData.endDate, startTime: formData.startTime, endTime: formData.endTime, visitSlots }
      : petConfigs[id];
    return sum + (pet && config ? calculatePriceDetailForPet(config, pet).surchargeTotal : 0);
  }, 0);

  const calculateTotalBeforeDiscounts = () => {
      let total = 0;
      formData.petIds.forEach(id => {
          const pet = pets.find(p => p.id === id);
          const config = useSameDates
            ? { startDate: formData.startDate, endDate: formData.endDate, startTime: formData.startTime, endTime: formData.endTime, visitSlots }
            : petConfigs[id];

          if (pet && config) {
              const details = calculatePriceDetailForPet(config, pet);
              const automaticDiscount = details.priceLines
                .filter((line) => line.type === "discount" && line.amount < 0)
                .reduce((sum, line) => sum + Math.abs(line.amount), 0);
              total += details.total - details.surchargeTotal + automaticDiscount;
          }
      });
      return Math.round(total * 100) / 100;
  };

  // Helper pour calculer la durée (pour les coupons)
  const calculateMaxDuration = () => {
      if (isHourlyService(formData.serviceType)) {
          return useSameDates
            ? getValidVisitSlots(visitSlots).length
            : Math.max(0, ...Object.values(petConfigs).map(c => getValidVisitSlots(c.visitSlots).length));
      }

      // Services à la date : périodes réelles de 24 h pour l'hébergement, jours pour les autres services.
      const config = useSameDates
        ? { startDate: formData.startDate, endDate: formData.endDate }
        : Object.values(petConfigs)[0]; // Take first as approx if varying

      if (!config?.startDate || !config?.endDate) return 1;

      if (isOvernightServiceType(formData.serviceType)) {
        const durationMinutes = calculateServiceDurationMinutes({
          startDate: config.startDate,
          endDate: config.endDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
        });
        return Math.ceil(durationMinutes / DOG_CARE_PERIOD_MINUTES) || 1;
      }

      return getInclusiveCalendarDayCount(config.startDate, config.endDate) || 1;
  };

  const formatPrice = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
  };

  const getHourlyDurationSummary = () => {
      if (formData.serviceType === "DROP_IN") {
        return `${EXTRA_DURATION.DROP_IN.baseDuration} min au tarif de base, puis +${EXTRA_DURATION.DROP_IN.extraRate}€ par tranche de ${EXTRA_DURATION.DROP_IN.increment} min supplémentaire`;
      }

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
        .map(([duration, count]) => `${count} x ${formatVisitDuration(Number(duration))}`)
        .join(" · ");
  };

  const getBookingDateSummary = () => {
      if (isHourlyService(formData.serviceType)) {
          const dates = getUniqueVisitDates(visitSlots);
          if (dates.length === 0) return "Dates non renseignées";
          return dates.length === 1 ? dates[0] : `${dates[0]} au ${dates[dates.length - 1]}`;
      }

      if (!formData.startDate || !formData.endDate) return "Dates non renseignées";
      if (formData.startDate === formData.endDate) return formData.startDate;
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
      const pet = pets.find((candidate) => candidate.id === id);
      if (!pet || !getPetProfileCompletion(pet).isComplete || !isPetBirthDateVerified(pet)) return;

      setFormData(prev => {
          const exists = prev.petIds.includes(id);
          const newIds = exists
              ? prev.petIds.filter(pid => pid !== id)
              : [...prev.petIds, id];
          const hasSelectedCat = newIds.some((petId) => pets.find((pet) => pet.id === petId)?.species === "CAT");
          return {
            ...prev,
            petIds: newIds,
            serviceType: prev.serviceType === "DOG_WALKING" && hasSelectedCat ? "BOARDING" : prev.serviceType,
          };
      });
  };

  const validateCoupon = async (codeOverride?: string, isAuto = false) => {
      const price = calculateTotalBeforeDiscounts();

      if (!useSameDates) {
          setCouponStatus(p => ({ ...p, error: "Un code promo nécessite des dates communes à tous les animaux" }));
          return;
      }

      const codeToValidate = (codeOverride || formData.promoCode).trim().toUpperCase();

      if (!codeToValidate) {
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
            body: JSON.stringify({ code: codeToValidate, totalAmount: price, serviceType: formData.serviceType, duration }),
        });
        const data = await res.json();

        if (res.ok) {
            setFormData((prev) => ({ ...prev, promoCode: codeToValidate }));
            setCouponStatus({ applied: true, loading: false, isAuto, data: data, error: "" });
        } else {
            setCouponStatus({ applied: false, loading: false, isAuto: false, data: null, error: data.error || "Code invalide" });
        }
      } catch {
          setCouponStatus(p => ({ ...p, loading: false, error: "Erreur de connexion" }));
      }
  };

  useEffect(() => {
    if (!couponStatus.isAuto || couponStatus.applied || couponStatus.loading || !formData.promoCode) return;
    if (autoCouponAppliedRef.current === formData.promoCode) return;
    if (calculateTotalPrice() <= 0) return;

    autoCouponAppliedRef.current = formData.promoCode;
    void validateCoupon(formData.promoCode, true);
    // The dependency list intentionally follows only inputs that change the coupon price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    couponStatus.applied,
    couponStatus.isAuto,
    couponStatus.loading,
    formData.promoCode,
    formData.serviceType,
    formData.startDate,
    formData.endDate,
    formData.startTime,
    formData.endTime,
    formData.petIds,
    visitSlots,
  ]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!legalAccepted) {
      setError("Vous devez accepter les conditions contractuelles avant de continuer.");
      return;
    }
    setIsLoading(true);
    setError("");

    const bookingsToCreate = [];

    if (useSameDates) {
        const price = finalDisplayedTotal;

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
            expectedLastMinuteFee: calculateLastMinuteTotal(),
            totalPrice: price,
            depositAmount: price,
            notes: formData.notes,
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
            const finalPrice = details.total * discountRatio;

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
                expectedLastMinuteFee: details.surchargeTotal,
                totalPrice: finalPrice,
                depositAmount: finalPrice,
                notes: formData.notes,
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

        const resCheckout = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingIds: createdBookingIds,
              promoCode: formData.promoCode || undefined,
              legalAccepted: true,
              legalVersion: LEGAL_DOCUMENT_VERSION,
            }),
        });
        const dataCheckout = await resCheckout.json();
        if (!resCheckout.ok) throw new Error(dataCheckout.error);
        window.location.href = dataCheckout.checkoutUrl;

    } catch (e: unknown) {
        setPricingNow(new Date());
        setError(e instanceof Error ? e.message : "Erreur de connexion");
        setIsLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") return <div className="min-h-screen bg-[#FDFbf7] flex items-center justify-center text-6xl animate-bounce">🐾</div>;

  const originalDisplayedTotal = calculateTotalBeforeDiscounts();
  const automaticDisplayedTotal = calculateTotalPrice();
  const hasCustomTotalCoupon = couponStatus.applied && couponStatus.data?.coupon.discountType === "CUSTOM_TOTAL";
  const couponCandidate = couponStatus.applied && couponStatus.data
    ? {
        code: couponStatus.data.coupon.code,
        discountType: couponStatus.data.coupon.discountType,
        finalAmount: couponStatus.data.finalAmount,
      }
    : null;
  const standardPricing = selectBestBookingDiscount({
    originalAmount: originalDisplayedTotal,
    automaticFinalAmount: automaticDisplayedTotal,
    coupon: couponCandidate,
    isPremium: false,
  });
  const premiumPreviewPricing = selectBestBookingDiscount({
    originalAmount: originalDisplayedTotal,
    automaticFinalAmount: automaticDisplayedTotal,
    coupon: couponCandidate,
    isPremium: true,
  });
  const selectedPricing = isPremium ? premiumPreviewPricing : standardPricing;
  const premiumPricing = selectedPricing.source === "PREMIUM" ? selectedPricing.premiumDiscount : null;
  const couponIsSelected = selectedPricing.source === "COUPON";
  const lastMinuteTotal = calculateLastMinuteTotal();
  const finalDisplayedTotal = selectedPricing.finalAmount + lastMinuteTotal;
  const estimatedPaws = calculatePawsEarned(finalDisplayedTotal, isPremium);
  const standardPaws = calculatePawsEarned(standardPricing.finalAmount + lastMinuteTotal, false);
  const premiumPreviewTotal = premiumPreviewPricing.finalAmount + lastMinuteTotal;
  const premiumPreviewSavings = Math.round(
    Math.max(0, standardPricing.finalAmount + lastMinuteTotal - premiumPreviewTotal) * 100
  ) / 100;
  const premiumPreviewPaws = calculatePawsEarned(premiumPreviewTotal, true);

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

      <div className="container mx-auto px-6 pt-32 max-w-4xl overflow-hidden">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Nouvelle Réservation ✨</h1>
          <p className="text-gray-500">Quelques étapes pour des vacances de rêve.</p>
          <p data-no-translate className="mt-4 text-sm leading-6 text-gray-600">{t(LAST_MINUTE_DESCRIPTION)}</p>
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
                    <>
                      {pets.some((pet) => !getPetProfileCompletion(pet).isComplete || !isPetBirthDateVerified(pet)) && (
                        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <p className="font-bold">Réservation impossible pour un animal non validé</p>
                          <p className="mt-1">Chaque animal doit avoir un profil complet et une date de naissance validée par notre équipe. Tant que la validation n’est pas terminée, l’animal ne peut pas être sélectionné et aucune réservation ne peut être créée.</p>
                          <p className="mt-1 font-semibold">Vous recevrez un e-mail dès que votre animal sera validé et que vous pourrez réserver.</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {pets.map((pet) => {
                          const isSelected = formData.petIds.includes(pet.id);
                          const completion = getPetProfileCompletion(pet);
                          const ageVerified = isPetBirthDateVerified(pet);
                          const canBook = completion.isComplete && ageVerified;
                          return (
                          <div
                            key={pet.id}
                            onClick={() => togglePet(pet.id)}
                            aria-disabled={!canBook}
                            className={`rounded-2xl p-4 border-2 transition-all flex flex-col items-center gap-2 text-center ${
                              !canBook
                                ? "cursor-not-allowed border-amber-200 bg-amber-50/60"
                                : isSelected
                                  ? "cursor-pointer border-orange-500 bg-orange-50"
                                  : "cursor-pointer border-gray-100 hover:border-gray-300"
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${isSelected ? "bg-orange-100" : "bg-gray-100"}`}>{isSelected ? "✅" : canBook ? "🐾" : "🔒"}</div>
                            <span className={`font-bold text-sm ${isSelected ? "text-gray-900" : "text-gray-500"}`}>{pet.name}</span>
                            <span className="text-xs text-gray-500 leading-tight">
                              {pet.breed || "Race inconnue"} · {formatPetAge(pet.age)}
                            </span>
                            {!canBook && (
                              <>
                                <span className="text-xs font-bold text-amber-800">
                                  {!completion.isComplete
                                    ? `${completion.percentage} % complété — réservation bloquée`
                                    : "Réservation bloquée — validation de l’âge en attente"}
                                </span>
                                <Link
                                  href={`/pets/${pet.id}/edit`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200"
                                >
                                  {completion.isComplete ? "Voir le profil" : "Compléter le profil"}
                                </Link>
                              </>
                            )}
                          </div>
                        )})}
                      </div>
                    </>
                  )}
                </div>

                {formData.petIds.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Quel service ? 🏠</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {serviceTypes.map((s) => {
                        const displayPrice = getServiceDisplayPrice(s.value);
                        const selectedPets = pets.filter((pet) => formData.petIds.includes(pet.id));
                        const hasSelectedCat = selectedPets.some((pet) => pet.species === "CAT");
                        const isCatWalkRequestOnly = s.value === "DOG_WALKING" && hasSelectedCat;
                        const isMaxPetsDisabled = s.maxPets < formData.petIds.length;
                        const isDisabled = isMaxPetsDisabled || isCatWalkRequestOnly;
                        return (
                        <div key={s.value} onClick={() => !isDisabled && setFormData({ ...formData, serviceType: s.value })}
                          className={`relative p-6 rounded-2xl border-2 transition-all ${isDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:border-gray-300"} ${!isDisabled && formData.serviceType === s.value ? "border-orange-500 bg-orange-50" : "border-gray-100"}`}
                        >
                          {isMaxPetsDisabled && <div className="absolute top-2 right-2 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">Max {s.maxPets}</div>}
                          {isCatWalkRequestOnly && <div className="absolute top-2 right-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">Chat sur demande</div>}
                          <div className="text-3xl mb-2">{s.icon}</div>
                          <div>
                            <h3 className="font-bold text-gray-900">{s.name}</h3>
                            {s.value === "HOUSE_SITTING" ? (
                              <div className="mt-1 space-y-2 text-sm">
                                <p data-no-translate className="font-bold text-emerald-700">{t("À partir de")} {displayPrice.dogPrice} €</p>
                                <div className="grid gap-1 text-xs text-gray-600 sm:grid-cols-3">
                                  {HOUSE_SITTING_DURATION_TIERS.map((tier) => (
                                    <span data-no-translate key={tier.label}>{t(tier.label)} : 🐕 {tier.prices.DOG} € · 🐈 {tier.prices.CAT} €</span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div data-no-translate className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
                                <span className="text-orange-600 font-bold">🐕 {displayPrice.dogPrice}€</span>
                                <span className="text-blue-600 font-bold">
                                  🐈 {displayPrice.catRequestOnly ? t("sur demande") : `${displayPrice.catPrice}€`}
                                </span>
                                <span className="text-gray-400">/ {t(displayPrice.unit)}</span>
                                {displayPrice.durationMinutes && (
                                  <span className="text-gray-500">{displayPrice.durationMinutes} min</span>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="mt-3 text-sm leading-5 text-gray-500">{s.description}</p>
                          {s.value === "BOARDING" && (
                            <p className="mt-2 text-xs leading-5 text-gray-600">
                              Toute période de 24 h commencée est due : 24 h 01 compte deux périodes. Chiot de moins d’un an : +{YOUNG_ANIMAL_SURCHARGE} € par période. Remise de {LONG_BOARDING_DISCOUNT_RATE * 100} % dès {LONG_BOARDING_MIN_PERIODS} périodes.
                            </p>
                          )}
                          {s.value === "DAY_CARE" && (
                            <p className="mt-2 text-xs leading-5 text-gray-600">
                              Maximum {DOG_DAY_CARE_MAX_MINUTES / 60} h par journée. Chiot de moins d’un an : +{YOUNG_ANIMAL_SURCHARGE} € par jour. Au-delà de 10 h, choisissez l’hébergement.
                            </p>
                          )}
                          {s.value === "DROP_IN" && (
                            <p className="mt-2 text-xs leading-5 text-gray-600">
                              Puis +{EXTRA_DURATION.DROP_IN.extraRate} € par tranche de {EXTRA_DURATION.DROP_IN.increment} min : chien {getServiceDisplayPriceForDuration("DROP_IN", "DOG", 60)} / {getServiceDisplayPriceForDuration("DROP_IN", "DOG", 90)} / {getServiceDisplayPriceForDuration("DROP_IN", "DOG", 120)} € et chat {getServiceDisplayPriceForDuration("DROP_IN", "CAT", 60)} / {getServiceDisplayPriceForDuration("DROP_IN", "CAT", 90)} / {getServiceDisplayPriceForDuration("DROP_IN", "CAT", 120)} € pour 60 / 90 / 120 min.
                            </p>
                          )}
                          {s.value === "DOG_WALKING" && (
                            <p className="mt-2 text-xs leading-5 text-gray-600">
                              30 min incluses, puis +{EXTRA_DURATION.DOG_WALKING.extraRate} € par tranche de 30 min commencée : {getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 60)} € / 60 min, {getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 90)} € / 90 min, {getServiceDisplayPriceForDuration("DOG_WALKING", "DOG", 120)} € / 120 min.
                            </p>
                          )}
                        </div>
                      )})}
                    </div>
                    {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                      <div className="mt-4">
                        <ResidentCatsNotice />
                      </div>
                    )}
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-xs leading-5 text-gray-600">
                      Chaque animal est facturé au tarif complet correspondant à son espèce et au service choisi. Pour une visite ou promenade partagée, le supplément de durée n’est compté qu’une fois. <Link href="/tarifs" target="_blank" className="font-bold text-orange-700 underline underline-offset-4">Voir tous les tarifs et conditions.</Link>
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
                         {formData.serviceType === "DROP_IN" && (
                           <p className="text-sm leading-6 text-orange-800">{CAT_VISIT_PRICING_DESCRIPTION} Choisissez un planning commun pour les passages partagés.</p>
                         )}
                       </div>
                     )}

                     {(availabilityStatus.checking || availabilityStatus.message) && (
                       <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${availabilityStatus.checking
                         ? "border-blue-200 bg-blue-50 text-blue-900"
                         : availabilityStatus.available
                           ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                           : "border-red-200 bg-red-50 text-red-800"}`}>
                         {availabilityStatus.checking
                           ? <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin" />
                           : availabilityStatus.available
                             ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                             : <AlertCircle className="mt-0.5 size-5 shrink-0" />}
                         <div>
                           <p className="font-bold">{t(availabilityStatus.checking ? "Vérification des disponibilités…" : availabilityStatus.message)}</p>
                           {!availabilityStatus.checking && availabilityStatus.unavailableDates.length > 0 && (
                             <p className="mt-1 font-normal">{t("Dates concernées")} : {availabilityStatus.unavailableDates.map((date) => formatShortDate(date)).join(", ")}</p>
                           )}
                         </div>
                       </div>
                     )}
                 </div>

                 {/* Total Price Bar */}
                 {calculateTotalPrice() > 0 && (
                     <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-3xl flex justify-between items-center">
                         <div>
                             <p className="text-gray-400 text-sm">Total estimé</p>
                             <div className="flex items-baseline gap-3">
                                {selectedPricing.discountAmount > 0 ? (
                                  <>
                                    <span className="text-lg text-gray-500 line-through decoration-red-500/50 decoration-2">
                                      {formatPrice(originalDisplayedTotal + lastMinuteTotal)}€
                                    </span>
                                    <span className="text-3xl font-bold text-green-400">
                                      {formatPrice(finalDisplayedTotal)}€
                                    </span>
                                  </>
                                ) : (
                                  <div className="text-3xl font-bold">{formatPrice(finalDisplayedTotal)}€</div>
                                )}
                             </div>
                         </div>
                             <div className="flex flex-col items-end gap-1">
                                 <p className="max-w-56 text-right text-[11px] leading-4 text-orange-200">
                                   5 premiers nouveaux clients : <strong>BIENVENUE10</strong> (-10 %). Les remises ne se cumulent pas : la plus avantageuse est retenue.
                                 </p>
                                 <div className="flex gap-2">
                                     <Input
                                        placeholder="PROMO"
                                        className="w-24 bg-white/10 border-none text-white placeholder:text-gray-500 uppercase"
                                        value={formData.promoCode}
                                        onChange={(e) => {
                                          setFormData({...formData, promoCode: e.target.value.toUpperCase()});
                                          setCouponStatus({ applied: false, loading: false, isAuto: false, data: null, error: "" });
                                        }}
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
                                     {couponIsSelected
                                       ? (couponStatus.data.message || `-${formatPrice(couponStatus.data.discountAmount)}€`)
                                       : "Code valide, mais une remise plus avantageuse est conservée."}
                                   </p>
                                 )}
                                 {couponStatus.error && (
                                    <p className="text-red-400 text-xs font-bold">{couponStatus.error}</p>
                                 )}
                             </div>
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
                        {formData.serviceType === "HOUSE_SITTING" && (() => {
                          const durationMinutes = calculateSameDayDurationMinutes(formData);
                          const durationTier = getHouseSittingDurationTier(durationMinutes);
                          const dayCount = getInclusiveCalendarDayCount(formData.startDate, formData.endDate);
                          if (!durationTier) return null;
                          return (
                            <div className="mb-4 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-sm text-gray-700">
                              <p><span className="font-bold text-gray-900">Journées : </span>{dayCount} · {formData.startDate}{dayCount > 1 ? ` au ${formData.endDate}` : ""}</p>
                              <p className="mt-1"><span className="font-bold text-gray-900">Horaires quotidiens : </span>{formData.startTime}–{formData.endTime} · {formatElapsedDuration(durationMinutes)} · <span data-no-translate>{t(durationTier.label)}</span></p>
                              <p className="mt-1 text-xs text-gray-500">Aucune nuitée incluse.</p>
                            </div>
                          );
                        })()}
                        {formData.serviceType === "DAY_CARE" && (() => {
                          const durationMinutes = calculateSameDayDurationMinutes(formData);
                          const dayCount = getInclusiveCalendarDayCount(formData.startDate, formData.endDate);
                          if (!isValidDayCareSchedule(formData)) return null;
                          return (
                            <div className="mb-4 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-sm text-gray-700">
                              <p><span className="font-bold text-gray-900">{t("Journées :")}</span> {dayCount} · {formData.startDate}{dayCount > 1 ? ` au ${formData.endDate}` : ""}</p>
                              <p className="mt-1"><span className="font-bold text-gray-900">{t("Horaires quotidiens :")}</span> {formData.startTime}–{formData.endTime} · {formatElapsedDuration(durationMinutes)}</p>
                              <p className="mt-1 text-xs text-gray-500">{t("Aucune nuitée incluse.")}</p>
                            </div>
                          );
                        })()}
                        {(formData.serviceType === "BOARDING" || formData.serviceType === "DAY_CARE") && (
                          <div className="mb-4">
                            <ResidentCatsNotice compact />
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
                                const uniformVisitDuration = isHourlyService(formData.serviceType) && selectedSlots.length > 0
                                  ? selectedSlots.every((slot) => slot.duration === selectedSlots[0].duration)
                                  : false;
                                const mergedHourlyUnitPrice = uniformVisitDuration
                                  ? details.total / selectedSlots.length
                                  : 0;
                                const mergedHourlyDateSummary = uniformVisitDuration
                                  ? formatDateKeyRanges(selectedSlots.map((slot) => slot.date))
                                  : "";

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

                                          {uniformVisitDuration ? (
                                            <div className="flex items-start justify-between gap-4 text-xs text-gray-700">
                                              <div className="min-w-0">
                                                <p className="font-semibold text-gray-900">
                                                  Visite {pet.species === "CAT" ? "chat" : "chien"} de {formatVisitDuration(selectedSlots[0].duration)}
                                                </p>
                                                <p className="mt-0.5 text-gray-500">
                                                  {selectedSlots.length} visite{selectedSlots.length > 1 ? "s" : ""} x {formatPrice(mergedHourlyUnitPrice)}€
                                                </p>
                                                {mergedHourlyDateSummary && (
                                                  <p className="mt-0.5 text-orange-700">
                                                    Dates concernées : {mergedHourlyDateSummary}
                                                  </p>
                                                )}
                                              </div>
                                              <span className="shrink-0 font-semibold text-gray-900">{formatPrice(details.total)}€</span>
                                            </div>
                                          ) : rateLines.map((line, idx) => {
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

                                          {!uniformVisitDuration && durationExtraTotal > 0 && (
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
                            {selectedPricing.discountAmount > 0 && (
                                <div className="flex justify-between pt-2 text-gray-500">
                                    <span>Prix avant remise</span>
                                    <span className="line-through">{formatPrice(originalDisplayedTotal + lastMinuteTotal)}€</span>
                                </div>
                            )}

                            {/* Réduction si coupon appliqué */}
                            {couponIsSelected && couponStatus.data && (
                                <div className="flex justify-between text-green-600 font-bold">
                                    <span>Réduction ({couponStatus.data.coupon.code})</span>
                                    <span>-{formatPrice(selectedPricing.discountAmount)}€</span>
                                </div>
                            )}

                            {selectedPricing.source === "AUTOMATIC" && selectedPricing.discountAmount > 0 && (
                                <div className="flex justify-between text-green-600 font-bold">
                                    <span>Remise automatique la plus avantageuse</span>
                                    <span>-{formatPrice(selectedPricing.discountAmount)}€</span>
                                </div>
                            )}

                            {premiumPricing && premiumPricing.discountAmount > 0 && (
                                <div className="flex justify-between text-orange-700 font-bold">
                                    <span>Avantage Premium (-10%)</span>
                                    <span>-{formatPrice(premiumPricing.discountAmount)}€</span>
                                </div>
                            )}

                            {couponStatus.applied && couponStatus.data && !couponIsSelected && (
                                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                                  Le code {couponStatus.data.coupon.code} ne sera pas consommé : une autre remise est plus avantageuse.
                                </p>
                            )}

                            <p data-no-translate className="text-xs leading-5 text-gray-600">{t(LAST_MINUTE_DESCRIPTION)} {t("Le supplément de dernière minute est ajouté après les remises.")}</p>

                            <div className="flex justify-between pt-2 border-t border-orange-200 mt-2">
                                <span className="font-bold text-xl text-gray-900">Total à payer</span>
                                <strong className="text-xl text-green-600">{formatPrice(finalDisplayedTotal)}€</strong>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-white via-orange-50 to-amber-50 text-sm text-gray-800 shadow-sm">
                                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                                          {isPremium ? "Premium actif" : "Fidélité & Premium"}
                                        </p>
                                        <p className="mt-1 text-lg font-extrabold text-gray-950">
                                          {estimatedPaws} Pattes sur cette réservation
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-gray-600">
                                            {isPremium
                                              ? premiumPricing
                                                ? `Votre remise Premium est de ${formatPrice(premiumPricing.discountAmount)}€ et vos Pattes sont doublées.`
                                                : "La remise la plus avantageuse est conservée et vos Pattes restent doublées."
                                              : hasCustomTotalCoupon
                                                ? `Avec Premium : ${premiumPreviewPaws} Pattes. Le tarif personnalisé reste à ${formatPrice(standardPricing.finalAmount + lastMinuteTotal)}€.`
                                                : premiumPreviewSavings > 0
                                                  ? `Avec Premium : ${formatPrice(premiumPreviewSavings)}€ économisés et ${premiumPreviewPaws} Pattes.`
                                                  : `Avec Premium : la meilleure remise reste inchangée et vous gagnez ${premiumPreviewPaws} Pattes.`}
                                        </p>
                                    </div>

                                    {!isPremium && (
                                      <Link href="/subscriptions" className="shrink-0 rounded-xl bg-gray-950 px-4 py-3 text-center text-sm font-bold text-white shadow-sm hover:bg-orange-600">
                                        Passer Premium
                                      </Link>
                                    )}
                                </div>

                                <div className="grid border-t border-amber-200/70 bg-white/70 text-xs sm:grid-cols-2">
                                  <div className="p-4">
                                    <p className="font-bold text-gray-500">Sans Premium</p>
                                    <p className="mt-1 text-base font-extrabold text-gray-950">{formatPrice(standardPricing.finalAmount + lastMinuteTotal)}€</p>
                                    <p className="mt-1 text-gray-600">{standardPaws} Pattes</p>
                                  </div>
                                  <div className="border-t border-amber-200/70 p-4 sm:border-l sm:border-t-0">
                                    <p className="font-bold text-orange-700">Avec Premium</p>
                                    <p className="mt-1 text-base font-extrabold text-gray-950">
                                      {formatPrice(premiumPreviewTotal)}€
                                      {!hasCustomTotalCoupon && premiumPreviewSavings > 0 && (
                                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                                          -{formatPrice(premiumPreviewSavings)}€
                                        </span>
                                      )}
                                    </p>
                                    <p className="mt-1 text-gray-600">{premiumPreviewPaws} Pattes</p>
                                  </div>
                                </div>
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

                        </div>
                    </div>

                    {/* Validation légale */}
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <input
                            type="checkbox"
                            id="legal-checkbox"
                            checked={legalAccepted}
                            onChange={(e) => setLegalAccepted(e.target.checked)}
                            className="mt-1 w-5 h-5 accent-orange-600 rounded cursor-pointer"
                        />
                        <label data-no-translate htmlFor="legal-checkbox" className="text-sm text-gray-600 cursor-pointer">
                            J&apos;accepte les <Link href="/legal/cgv" target="_blank" className="underline text-orange-600 hover:text-orange-800">Conditions générales de vente de {LEGAL_INFORMATION.commercialName}</Link> dans leur version du {LEGAL_DOCUMENT_VERSION_LABEL}, et je reconnais avoir pris connaissance de la <Link href="/legal/confidentialite" target="_blank" className="underline text-orange-600 hover:text-orange-800">Politique de confidentialité</Link>. L&apos;annulation est gratuite au moins 48 h avant le début de la garde. Passé ce délai, 50 % du montant est retenu, sous réserve des droits légaux. {ATTENDANCE_SUMMARY} Premium permet de demander en priorité un report, au moins 24 h avant, sous réserve de disponibilité.
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
                      placeholder="Exemple : le supplément 1h me semble doublé, ou je souhaite vérifier le total affiché..."
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
