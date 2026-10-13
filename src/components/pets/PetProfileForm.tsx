"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Image from "next/image";
import { UploadButton } from "@uploadthing/react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  Cat,
  Dog,
  FileText,
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

export type PetFormData = {
  name: string;
  species: "DOG" | "CAT";
  breed: string;
  birthDate: string;
  birthDateProofUrl: string;
  weight: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  spayedNeutered: boolean | null;
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
  birthDate: "",
  birthDateProofUrl: "",
  weight: "",
  gender: "UNKNOWN",
  spayedNeutered: null,
  imageUrl: "",
  medicalInfo: "",
  behaviorNotes: "",
  feedingSchedule: "",
  medications: "",
  vetInfo: "",
  emergencyContact: "",
};

export function toPetPayload(formData: PetFormData) {
  const parsedWeight = Number.parseFloat(formData.weight);
  const weight = Number.isNaN(parsedWeight) ? undefined : parsedWeight;

  return {
    ...formData,
    weight,
  };
}

type PetProfileFormProps = {
  formData: PetFormData;
  setFormData: Dispatch<SetStateAction<PetFormData>>;
  uploadButtonLabel: string;
  birthDateVerified?: boolean;
  birthDateProofRequired?: boolean;
};

export function PetProfileForm({
  formData,
  setFormData,
  uploadButtonLabel,
  birthDateVerified = false,
  birthDateProofRequired = true,
}: PetProfileFormProps) {
  const birthDateLocked = birthDateVerified && birthDateProofRequired;
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

            <Field label="Race" required>
              <Input
                placeholder={formData.species === "DOG" ? "Golden Retriever" : "Siamois"}
                className="h-12 rounded-md border-gray-200 bg-gray-50 text-base"
                value={formData.breed}
                onChange={(event) => updateField("breed", event.target.value)}
                required
              />
            </Field>

            <Field label="Sexe" required>
              <div className="grid grid-cols-2 gap-2">
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
              {formData.gender === "UNKNOWN" && (
                <p className="mt-2 text-xs font-semibold text-amber-700">Choisissez mâle ou femelle.</p>
              )}
            </Field>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-orange-600" />
                <Label className="font-bold text-gray-800">Date de naissance <span className="text-orange-600">*</span></Label>
              </div>
              <Input
                type="date"
                min={`${new Date().getFullYear() - 30}-01-01`}
                max={new Date().toISOString().split("T")[0]}
                className="h-12 rounded-md border-gray-200 bg-white text-base"
                value={formData.birthDate}
                onChange={(event) => updateField("birthDate", event.target.value)}
                disabled={birthDateLocked}
                required
              />
              <p className={`mt-2 text-xs ${birthDateLocked ? "font-semibold text-emerald-700" : "text-gray-500"}`}>
                {birthDateLocked
                  ? "Date vérifiée par l’équipe et désormais verrouillée."
                  : "L’âge sera calculé automatiquement. Pour un chien de moins d’un an, le supplément chiot concerne uniquement la garderie et l’hébergement."}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4 text-orange-600" />
                <Label className="font-bold text-gray-800">Poids <span className="text-orange-600">*</span></Label>
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
                  required
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  kg
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Même une estimation aide à adapter la prestation.</p>
            </div>

            <div className="md:col-span-2 flex min-h-14 flex-col gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 text-orange-700">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-bold text-gray-900">Stérilisé / castré <span className="text-orange-600">*</span></span>
                  <span className="block text-xs text-gray-500">Choisissez une réponse, même si la réponse est non.</span>
                </span>
              </span>
              <div className="grid min-w-40 grid-cols-2 gap-2">
                <ChoiceButton
                  active={formData.spayedNeutered === true}
                  label="Oui"
                  onClick={() => updateField("spayedNeutered", true)}
                />
                <ChoiceButton
                  active={formData.spayedNeutered === false}
                  label="Non"
                  onClick={() => updateField("spayedNeutered", false)}
                />
              </div>
            </div>

            {birthDateProofRequired ? (
              <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-amber-700">
                    {birthDateVerified ? <BadgeCheck className="h-5 w-5 text-emerald-600" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">
                      Justificatif de date de naissance <span className="text-orange-600">*</span>
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Carnet de santé, passeport ou certificat vétérinaire. Masquez l’adresse et les autres données personnelles inutiles.
                    </p>

                    {formData.birthDateProofUrl ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <a
                          href={formData.birthDateProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
                        >
                          <FileText className="h-4 w-4" />
                          Voir le justificatif
                        </a>
                        {!birthDateVerified && (
                          <button
                            type="button"
                            onClick={() => updateField("birthDateProofUrl", "")}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                            Remplacer
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3">
                        <UploadButton<OurFileRouter, "petAgeProof">
                          endpoint="petAgeProof"
                          onClientUploadComplete={(res) => res?.[0] && updateField("birthDateProofUrl", res[0].url)}
                          onUploadError={() => alert("Erreur lors de l’envoi du justificatif")}
                          appearance={{
                            container: "w-full",
                            button: "w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-bold text-white after:bg-amber-800 hover:bg-amber-800",
                            allowedContent: "text-xs text-gray-500",
                          }}
                          content={{
                            button: "Ajouter le justificatif",
                            allowedContent: "Image ou PDF · 4 Mo maximum",
                          }}
                        />
                      </div>
                    )}

                    {!birthDateVerified && formData.birthDateProofUrl && (
                      <p className="mt-2 text-xs font-semibold text-amber-800">En attente de vérification par l’équipe.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <StepTitle number="3" title="Santé & habitudes" />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextAreaField
            label="Maladies et informations médicales"
            icon={HeartPulse}
            placeholder="Allergies, maladies chroniques… Écrivez « Aucune connue » si nécessaire."
            value={formData.medicalInfo}
            onChange={(value) => updateField("medicalInfo", value)}
            required
          />
          <TextAreaField
            label="Médicaments"
            icon={Syringe}
            placeholder="Traitements, doses, horaires… Écrivez « Aucun » si nécessaire."
            value={formData.medications}
            onChange={(value) => updateField("medications", value)}
            required
          />
          <TextAreaField
            label="Comportement"
            icon={PawPrint}
            placeholder="Entente avec les animaux, enfants, peurs, habitudes..."
            value={formData.behaviorNotes}
            onChange={(value) => updateField("behaviorNotes", value)}
            required
          />
          <TextAreaField
            label="Repas"
            icon={Scale}
            placeholder="Quantité, fréquence, croquettes, pâtée..."
            value={formData.feedingSchedule}
            onChange={(value) => updateField("feedingSchedule", value)}
            required
          />
          <TextAreaField
            label="Vétérinaire"
            icon={Stethoscope}
            placeholder="Nom, clinique, téléphone"
            value={formData.vetInfo}
            onChange={(value) => updateField("vetInfo", value)}
            required
          />
          <TextAreaField
            label="Contact d'urgence"
            icon={Phone}
            placeholder="Personne à contacter en cas d'urgence"
            value={formData.emergencyContact}
            onChange={(value) => updateField("emergencyContact", value)}
            required
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

function ChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-11 rounded-md border px-4 text-sm font-bold transition ${
        active
          ? "border-orange-500 bg-orange-50 text-orange-800"
          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-200"
      }`}
    >
      {label}
    </button>
  );
}

function TextAreaField({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  label: string;
  icon: LucideIcon;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="mb-2 flex items-center gap-2 font-bold text-gray-800">
        <Icon className="h-4 w-4 text-orange-600" />
        {label} {required && <span className="text-orange-600">*</span>}
      </Label>
      <textarea
        className="min-h-28 w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  );
}
