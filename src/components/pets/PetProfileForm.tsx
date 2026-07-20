"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Image from "next/image";
import { UploadButton } from "@uploadthing/react";
import {
  Camera,
  Cat,
  Dog,
  HeartPulse,
  Mars,
  PawPrint,
  Phone,
  Scale,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Venus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export type AgeUnit = "YEARS" | "MONTHS";

export type PetFormData = {
  name: string;
  species: "DOG" | "CAT";
  breed: string;
  age: string;
  weight: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  spayedNeutered: boolean;
  imageUrl: string;
  medicalInfo: string;
  behaviorNotes: string;
  feedingSchedule: string;
  medications: string;
  vetInfo: string;
  emergencyContact: string;
};

export const emptyPetFormData: PetFormData = {
  name: "",
  species: "DOG",
  breed: "",
  age: "",
  weight: "",
  gender: "UNKNOWN",
  spayedNeutered: false,
  imageUrl: "",
  medicalInfo: "",
  behaviorNotes: "",
  feedingSchedule: "",
  medications: "",
  vetInfo: "",
  emergencyContact: "",
};

export function toPetPayload(formData: PetFormData, ageUnit: AgeUnit) {
  const parsedAge = Number.parseFloat(formData.age);
  const age = Number.isNaN(parsedAge)
    ? undefined
    : ageUnit === "MONTHS"
      ? Number.parseFloat((parsedAge / 12).toFixed(2))
      : parsedAge;

  const parsedWeight = Number.parseFloat(formData.weight);
  const weight = Number.isNaN(parsedWeight) ? undefined : parsedWeight;

  return {
    ...formData,
    age,
    weight,
  };
}

type PetProfileFormProps = {
  formData: PetFormData;
  setFormData: Dispatch<SetStateAction<PetFormData>>;
  ageUnit: AgeUnit;
  setAgeUnit: Dispatch<SetStateAction<AgeUnit>>;
  uploadButtonLabel: string;
};

export function PetProfileForm({
  formData,
  setFormData,
  ageUnit,
  setAgeUnit,
  uploadButtonLabel,
}: PetProfileFormProps) {
  const updateField = <K extends keyof PetFormData>(field: K, value: PetFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <StepTitle number="1" title="Type d'animal" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SpeciesButton
            active={formData.species === "DOG"}
            label="Chien"
            icon={Dog}
            onClick={() => updateField("species", "DOG")}
          />
          <SpeciesButton
            active={formData.species === "CAT"}
            label="Chat"
            icon={Cat}
            onClick={() => updateField("species", "CAT")}
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <StepTitle number="2" title="Identité" />

        <div className="mt-5 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 bg-white text-gray-300">
              {formData.imageUrl ? (
                <Image src={formData.imageUrl} alt="" fill sizes="144px" className="object-cover" />
              ) : (
                <Camera className="h-10 w-10" />
              )}
            </div>

            <div className="mt-4 space-y-2">
              <UploadButton<OurFileRouter, "petImage">
                endpoint="petImage"
                onClientUploadComplete={(res) => res?.[0] && updateField("imageUrl", res[0].url)}
                onUploadError={() => alert("Erreur upload")}
                appearance={{
                  container: "w-full",
                  button: "w-full rounded-md bg-gray-950 px-4 py-2 text-sm font-bold text-white after:bg-orange-600 hover:bg-orange-600",
                  allowedContent: "text-xs text-gray-500",
                }}
                content={{
                  button: uploadButtonLabel,
                  allowedContent: "Image JPG, PNG ou WebP",
                }}
              />
              {formData.imageUrl && (
                <button
                  type="button"
                  onClick={() => updateField("imageUrl", "")}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:border-red-200 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  Retirer la photo
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" label="Son petit nom" required>
              <Input
                placeholder="Ex : Rex, Luna..."
                className="h-12 rounded-md border-gray-200 bg-gray-50 text-base focus:border-orange-500 focus:ring-orange-500"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                required
              />
            </Field>

            <Field label="Race">
              <Input
                placeholder={formData.species === "DOG" ? "Golden Retriever" : "Siamois"}
                className="h-12 rounded-md border-gray-200 bg-gray-50 text-base"
                value={formData.breed}
                onChange={(event) => updateField("breed", event.target.value)}
              />
            </Field>

            <Field label="Genre">
              <div className="grid grid-cols-3 gap-2">
                <GenderButton
                  active={formData.gender === "UNKNOWN"}
                  label="?"
                  onClick={() => updateField("gender", "UNKNOWN")}
                />
                <GenderButton
                  active={formData.gender === "MALE"}
                  label="Mâle"
                  icon={Mars}
                  onClick={() => updateField("gender", "MALE")}
                />
                <GenderButton
                  active={formData.gender === "FEMALE"}
                  label="Femelle"
                  icon={Venus}
                  onClick={() => updateField("gender", "FEMALE")}
                />
              </div>
            </Field>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-orange-600" />
                <Label className="font-bold text-gray-800">Âge</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={ageUnit === "YEARS" ? 30 : 360}
                  placeholder={ageUnit === "YEARS" ? "Ex : 2" : "Ex : 8"}
                  step={ageUnit === "YEARS" ? "0.1" : "1"}
                  className="h-12 min-w-0 rounded-md border-gray-200 bg-white text-base"
                  value={formData.age}
                  onChange={(event) => updateField("age", event.target.value)}
                />
                <div className="grid h-12 grid-cols-2 rounded-md bg-gray-200 p-1">
                  <UnitButton active={ageUnit === "YEARS"} onClick={() => setAgeUnit("YEARS")}>
                    Ans
                  </UnitButton>
                  <UnitButton active={ageUnit === "MONTHS"} onClick={() => setAgeUnit("MONTHS")}>
                    Mois
                  </UnitButton>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">Utilisez les mois pour les chiots et chatons.</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4 text-orange-600" />
                <Label className="font-bold text-gray-800">Poids</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  placeholder="Ex : 12.5"
                  step="0.1"
                  className="h-12 rounded-md border-gray-200 bg-white pr-12 text-base"
                  value={formData.weight}
                  onChange={(event) => updateField("weight", event.target.value)}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  kg
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Même une estimation aide à adapter la prestation.</p>
            </div>

            <label className="md:col-span-2 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-orange-200 hover:bg-orange-50">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 text-orange-700">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-bold text-gray-900">Stérilisé / castré</span>
                  <span className="block text-xs text-gray-500">Information utile pour les gardes avec d'autres animaux.</span>
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                checked={formData.spayedNeutered}
                onChange={(event) => updateField("spayedNeutered", event.target.checked)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <StepTitle number="3" title="Santé & habitudes" />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextAreaField
            label="Informations médicales"
            icon={HeartPulse}
            placeholder="Allergies, maladies chroniques, vaccins..."
            value={formData.medicalInfo}
            onChange={(value) => updateField("medicalInfo", value)}
          />
          <TextAreaField
            label="Médicaments"
            icon={Syringe}
            placeholder="Traitements, doses, horaires..."
            value={formData.medications}
            onChange={(value) => updateField("medications", value)}
          />
          <TextAreaField
            label="Comportement"
            icon={PawPrint}
            placeholder="Entente avec les animaux, enfants, peurs, habitudes..."
            value={formData.behaviorNotes}
            onChange={(value) => updateField("behaviorNotes", value)}
          />
          <TextAreaField
            label="Repas"
            icon={Scale}
            placeholder="Quantité, fréquence, croquettes, pâtée..."
            value={formData.feedingSchedule}
            onChange={(value) => updateField("feedingSchedule", value)}
          />
          <TextAreaField
            label="Vétérinaire"
            icon={Stethoscope}
            placeholder="Nom, clinique, téléphone"
            value={formData.vetInfo}
            onChange={(value) => updateField("vetInfo", value)}
          />
          <TextAreaField
            label="Contact d'urgence"
            icon={Phone}
            placeholder="Personne à contacter en cas d'urgence"
            value={formData.emergencyContact}
            onChange={(value) => updateField("emergencyContact", value)}
          />
        </div>
      </section>
    </div>
  );
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-extrabold text-gray-950">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 text-sm font-extrabold text-orange-700">
        {number}
      </span>
      {title}
    </h2>
  );
}

function SpeciesButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-24 items-center justify-center gap-4 rounded-lg border p-4 text-left transition ${
        active
          ? "border-orange-500 bg-orange-50 text-orange-800 shadow-sm"
          : "border-gray-200 bg-white text-gray-700 hover:border-orange-200"
      }`}
    >
      <Icon className="h-8 w-8" />
      <span className="text-lg font-extrabold">{label}</span>
    </button>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block font-bold text-gray-800">
        {label} {required && <span className="text-orange-600">*</span>}
      </Label>
      {children}
    </div>
  );
}

function GenderButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-12 min-w-0 items-center justify-center gap-1 rounded-md border px-2 text-sm font-bold transition ${
        active
          ? "border-orange-500 bg-orange-50 text-orange-800"
          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-200"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function UnitButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded text-sm font-bold transition ${
        active ? "bg-white text-gray-950 shadow-sm" : "text-gray-600 hover:text-gray-950"
      }`}
    >
      {children}
    </button>
  );
}

function TextAreaField({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2 flex items-center gap-2 font-bold text-gray-800">
        <Icon className="h-4 w-4 text-orange-600" />
        {label}
      </Label>
      <textarea
        className="min-h-28 w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
