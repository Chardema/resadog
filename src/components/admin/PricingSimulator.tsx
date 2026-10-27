"use client";

import { useState } from "react";
import { Calculator, CheckCircle2, Clock3, MoonStar, PawPrint } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateBookingPrice,
  calculateSameDayDurationMinutes,
  calculateServiceDurationMinutes,
  DOG_24_HOUR_RATE,
  DOG_CARE_PERIOD_MINUTES,
  DOG_DAY_CARE_MAX_MINUTES,
  DOG_DAY_CARE_RATE,
  isValidDayCareSchedule,
  YOUNG_ANIMAL_SURCHARGE,
} from "@/lib/pricing";
import { isPetUnderOneYearOn, isValidPetBirthDate } from "@/lib/pets";
import { CatVisitSimulator } from "@/components/admin/CatVisitSimulator";

type SimulatorServiceType = "DAY_CARE" | "BOARDING";

type SimulatorExample = {
  label: string;
  serviceType: SimulatorServiceType;
  birthDate: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

function formatDuration(durationMinutes: number) {
  const days = Math.floor(durationMinutes / DOG_CARE_PERIOD_MINUTES);
  const hours = Math.floor((durationMinutes % DOG_CARE_PERIOD_MINUTES) / 60);
  const minutes = durationMinutes % 60;
  const parts = [];

  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);

  return parts.join(" ") || "0 min";
}

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? amount.toString() : amount.toFixed(2).replace(".", ",");
}

const simulatorExamples: readonly SimulatorExample[] = [
  {
    label: "3 jours adulte · 105 €",
    serviceType: "DAY_CARE",
    birthDate: "2020-05-10",
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    startTime: "08:00",
    endTime: "18:00",
  },
  {
    label: "3 jours chiot · 120 €",
    serviceType: "DAY_CARE",
    birthDate: "2026-03-15",
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    startTime: "08:00",
    endTime: "18:00",
  },
  {
    label: "10 h 01 · refusé",
    serviceType: "DAY_CARE",
    birthDate: "2020-05-10",
    startDate: "2026-09-29",
    endDate: "2026-09-29",
    startTime: "08:00",
    endTime: "18:01",
  },
  {
    label: "24 h adulte · 45 €",
    serviceType: "BOARDING",
    birthDate: "2020-05-10",
    startDate: "2026-09-11",
    endDate: "2026-09-12",
    startTime: "18:00",
    endTime: "18:00",
  },
  {
    label: "24 h 01 chiot · 100 €",
    serviceType: "BOARDING",
    birthDate: "2026-03-15",
    startDate: "2026-09-11",
    endDate: "2026-09-12",
    startTime: "18:00",
    endTime: "18:01",
  },
] as const;

export function PricingSimulator() {
  const [mode, setMode] = useState<"DOG_CARE" | "CAT_VISITS">("DOG_CARE");
  const [serviceType, setServiceType] = useState<SimulatorServiceType>("DAY_CARE");
  const [birthDate, setBirthDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const hasAllValues = Boolean(birthDate && startDate && endDate && startTime && endTime);
  const birthDateIsValid = Boolean(
    birthDate
    && isValidPetBirthDate(`${birthDate}T00:00:00.000Z`)
    && (!startDate || birthDate <= startDate)
  );
  const dateRangeIsValid = Boolean(startDate && endDate && endDate >= startDate);
  const dayCareDurationMinutes = calculateSameDayDurationMinutes({ startTime, endTime });
  const boardingDurationMinutes = calculateServiceDurationMinutes({ startDate, endDate, startTime, endTime });
  const scheduleIsValid = serviceType === "DAY_CARE"
    ? isValidDayCareSchedule({ startDate, endDate, startTime, endTime })
    : boardingDurationMinutes > 0;
  const canCalculate = hasAllValues && birthDateIsValid && dateRangeIsValid && scheduleIsValid;
  const quote = canCalculate
    ? calculateBookingPrice({
        serviceType,
        pets: [{ id: "pricing-simulator-dog", species: "DOG", birthDate }],
        startDate,
        endDate,
        startTime,
        endTime,
      })
    : null;
  const isPuppy = canCalculate
    ? isPetUnderOneYearOn(birthDate, `${startDate}T12:00:00.000Z`)
    : false;
  const unitBasePrice = serviceType === "DAY_CARE" ? DOG_DAY_CARE_RATE : DOG_24_HOUR_RATE;
  const billedQuantity = quote?.quantity || 0;
  const discountTotal = quote?.pets[0]?.rateGroups
    .filter((group) => group.type === "discount")
    .reduce((total, group) => total + Math.abs(group.total), 0) || 0;
  const durationMinutes = serviceType === "DAY_CARE" ? dayCareDurationMinutes : boardingDurationMinutes;
  const hasPartialLastPeriod = serviceType === "BOARDING"
    && boardingDurationMinutes > 0
    && boardingDurationMinutes % DOG_CARE_PERIOD_MINUTES !== 0;

  let invalidMessage = "";
  if (hasAllValues && !birthDateIsValid) {
    invalidMessage = "La date de naissance doit être valide et antérieure au début de la garde.";
  } else if (hasAllValues && !dateRangeIsValid) {
    invalidMessage = "La dernière date doit être identique ou postérieure à la première.";
  } else if (hasAllValues && serviceType === "DAY_CARE" && dayCareDurationMinutes <= 0) {
    invalidMessage = "L’heure de départ quotidienne doit être postérieure à l’heure d’arrivée.";
  } else if (hasAllValues && serviceType === "DAY_CARE" && dayCareDurationMinutes > DOG_DAY_CARE_MAX_MINUTES) {
    invalidMessage = `Une journée de garde ne peut pas dépasser ${DOG_DAY_CARE_MAX_MINUTES / 60} h.`;
  } else if (hasAllValues && serviceType === "BOARDING" && boardingDurationMinutes <= 0) {
    invalidMessage = "La reprise doit être postérieure au dépôt.";
  }

  const applyExample = (example: SimulatorExample) => {
    setServiceType(example.serviceType);
    setBirthDate(example.birthDate);
    setStartDate(example.startDate);
    setEndDate(example.endDate);
    setStartTime(example.startTime);
    setEndTime(example.endTime);
  };

  return (
    <div data-no-translate className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-orange-700">Outil interne administrateur</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Simulateur de tarif</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Simulez une garde de chien ou préparez un devis pour des visites de chats à domicile.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800 ring-1 ring-orange-200">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            Calcul centralisé
          </span>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Type de simulation">
        {([
          ["DOG_CARE", "Garde de chien"],
          ["CAT_VISITS", "Visites de chats à domicile"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
            className={`min-h-12 rounded-lg border px-4 py-3 text-sm font-bold ${mode === value ? "border-orange-500 bg-orange-50 text-orange-900" : "border-gray-300 bg-white text-gray-700 hover:border-orange-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "CAT_VISITS" ? <CatVisitSimulator /> : <>
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <Clock3 className="h-5 w-5 text-amber-700" aria-hidden="true" />
          <p className="mt-3 text-2xl font-extrabold">{DOG_DAY_CARE_RATE} €</p>
          <p className="mt-1 font-bold">Par journée de garde</p>
          <p className="mt-1 text-sm leading-5 text-amber-900">
            Jusqu’à {DOG_DAY_CARE_MAX_MINUTES / 60} h par jour, avec les mêmes horaires sur toute la plage.
          </p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
          <MoonStar className="h-5 w-5 text-indigo-700" aria-hidden="true" />
          <p className="mt-3 text-2xl font-extrabold">{DOG_24_HOUR_RATE} €</p>
          <p className="mt-1 font-bold">Par période de 24 h / avec nuit</p>
          <p className="mt-1 text-sm leading-5 text-indigo-900">Toute période commencée est facturée en entier.</p>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-orange-950">
        <PawPrint className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" aria-hidden="true" />
        <p className="text-sm leading-6">
          <span className="font-bold">Moins d’un an au premier jour :</span> +{YOUNG_ANIMAL_SURCHARGE} € par journée ou période facturée. La catégorie est calculée depuis la date de naissance.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-gray-950">Service, âge et planning</h2>
          <p className="mt-1 text-sm text-gray-600">Le résultat utilise le même moteur que la réservation.</p>

          <div className="mt-6 grid grid-cols-2 gap-2" role="group" aria-label="Type de garde">
            <button
              type="button"
              aria-pressed={serviceType === "DAY_CARE"}
              onClick={() => setServiceType("DAY_CARE")}
              className={`min-h-12 rounded-md border px-3 py-2 text-sm font-bold transition ${
                serviceType === "DAY_CARE"
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : "border-gray-300 bg-white text-gray-700 hover:border-amber-300"
              }`}
            >
              Garde de jour
            </button>
            <button
              type="button"
              aria-pressed={serviceType === "BOARDING"}
              onClick={() => setServiceType("BOARDING")}
              className={`min-h-12 rounded-md border px-3 py-2 text-sm font-bold transition ${
                serviceType === "BOARDING"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                  : "border-gray-300 bg-white text-gray-700 hover:border-indigo-300"
              }`}
            >
              Hébergement / nuit
            </button>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pricing-birth-date">Date de naissance du chien</Label>
              <Input
                id="pricing-birth-date"
                type="date"
                value={birthDate}
                max={startDate || undefined}
                onChange={(event) => setBirthDate(event.target.value)}
                className="mt-2 h-11"
              />
              <p className="mt-2 text-xs text-gray-500">Saisie administrateur : aucun justificatif n’est nécessaire.</p>
            </div>
            <div>
              <Label htmlFor="pricing-start-date">
                {serviceType === "DAY_CARE" ? "Première journée" : "Date de dépôt"}
              </Label>
              <Input
                id="pricing-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label htmlFor="pricing-end-date">
                {serviceType === "DAY_CARE" ? "Dernière journée" : "Date de reprise"}
              </Label>
              <Input
                id="pricing-end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label htmlFor="pricing-start-time">
                {serviceType === "DAY_CARE" ? "Arrivée quotidienne" : "Heure de dépôt"}
              </Label>
              <Input
                id="pricing-start-time"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label htmlFor="pricing-end-time">
                {serviceType === "DAY_CARE" ? "Départ quotidien" : "Heure de reprise"}
              </Label>
              <Input
                id="pricing-end-time"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Exemples rapides</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {simulatorExamples.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => applyExample(example)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          {invalidMessage ? (
            <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {invalidMessage}
            </p>
          ) : (
            <p className="mt-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600">
              {serviceType === "DAY_CARE"
                ? "Chaque date sélectionnée compte comme une journée de garde, avec 10 h maximum par jour."
                : "L’hébergement est calculé sur la durée réelle entre dépôt et reprise, par périodes de 24 h commencées."}
            </p>
          )}
        </section>

        <section aria-live="polite" className="rounded-lg border border-gray-200 bg-gray-950 p-5 text-white shadow-sm sm:p-6">
          {quote ? (
            <>
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <p className="text-sm font-bold">Tarif calculé</p>
              </div>
              <p className="mt-5 text-5xl font-extrabold tracking-tight">{formatAmount(quote.total)} €</p>
              <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-400">Formule</dt>
                  <dd className="text-right font-bold">
                    {serviceType === "DAY_CARE" ? "Garde de jour" : "Hébergement / nuit"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-400">Âge au début</dt>
                  <dd className="text-right font-bold">{isPuppy ? "Moins d’un an" : "Un an ou plus"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-400">Durée</dt>
                  <dd className="text-right font-bold">
                    {formatDuration(durationMinutes)}{serviceType === "DAY_CARE" ? " par jour" : ""}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-400">
                    {serviceType === "DAY_CARE" ? "Journées" : "Périodes commencées"}
                  </dt>
                  <dd className="font-bold">{billedQuantity}</dd>
                </div>
              </dl>

              <div className="mt-5 space-y-2 rounded-md bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-300">Tarif de base</span>
                  <span className="font-bold">{billedQuantity} × {unitBasePrice} € = {formatAmount(billedQuantity * unitBasePrice)} €</span>
                </div>
                {isPuppy ? (
                  <div className="flex items-center justify-between gap-4 text-orange-200">
                    <span>Supplément moins d’un an</span>
                    <span className="font-bold">{billedQuantity} × {YOUNG_ANIMAL_SURCHARGE} € = {formatAmount(billedQuantity * YOUNG_ANIMAL_SURCHARGE)} €</span>
                  </div>
                ) : null}
                {quote.lastMinuteFee > 0 ? (
                  <div className="flex items-center justify-between gap-4 text-orange-200">
                    <span>Supplément réservation de dernière minute</span>
                    <span className="font-bold">+ {formatAmount(quote.lastMinuteFee)} €</span>
                  </div>
                ) : null}
                {discountTotal > 0 ? (
                  <div className="flex items-center justify-between gap-4 text-emerald-200">
                    <span>Remise longue durée</span>
                    <span className="font-bold">− {formatAmount(discountTotal)} €</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-2">
                  <span className="font-bold">Total</span>
                  <span className="font-extrabold">{formatAmount(quote.total)} €</span>
                </div>
              </div>

              {hasPartialLastPeriod ? (
                <p className="mt-5 rounded-md bg-amber-400/15 px-4 py-3 text-sm leading-6 text-amber-100 ring-1 ring-amber-300/20">
                  La dernière période de 24 h est entamée : elle est donc facturée en entier.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Calculator className="h-9 w-9 text-gray-500" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold">En attente des informations</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-gray-400">
                Renseignez le service, la date de naissance, les dates et les horaires pour obtenir le détail du tarif.
              </p>
            </div>
          )}
        </section>
      </div>

      <p className="text-xs leading-5 text-gray-500">
        Simulation pour un chien. Les autres suppléments, réductions ponctuelles et offres promotionnelles ne sont pas inclus. Le tarif final d’une réservation reste recalculé côté serveur.
      </p>
      </>}
    </div>
  );
}
