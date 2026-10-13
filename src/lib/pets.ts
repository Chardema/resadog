export function formatPetAge(age?: number | null) {
  if (age === undefined || age === null || Number.isNaN(age)) return "Âge inconnu";

  if (age < 1) {
    const months = Math.max(1, Math.round(age * 12));
    return `${months} mois`;
  }

  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);

  if (months <= 0) {
    return years === 1 ? "1 an" : `${years} ans`;
  }

  return `${years} an${years > 1 ? "s" : ""} ${months} mois`;
}

export type PetProfileData = {
  name?: string | null;
  breed?: string | null;
  age?: number | null;
  birthDate?: Date | string | null;
  birthDateProofUrl?: string | null;
  birthDateVerifiedAt?: Date | string | null;
  weight?: number | null;
  gender?: "MALE" | "FEMALE" | "UNKNOWN" | string | null;
  spayedNeutered?: boolean | null;
  medicalInfo?: string | null;
  behaviorNotes?: string | null;
  feedingSchedule?: string | null;
  medications?: string | null;
  vetInfo?: string | null;
  emergencyContact?: string | null;
};

const REQUIRED_PET_PROFILE_FIELDS = [
  { key: "name", label: "nom" },
  { key: "breed", label: "race" },
  { key: "birthDate", label: "date de naissance" },
  { key: "birthDateProofUrl", label: "justificatif de date de naissance" },
  { key: "weight", label: "poids" },
  { key: "gender", label: "sexe" },
  { key: "spayedNeutered", label: "statut stérilisé/castré" },
  { key: "medicalInfo", label: "maladies et informations médicales" },
  { key: "medications", label: "médicaments" },
  { key: "behaviorNotes", label: "comportement" },
  { key: "feedingSchedule", label: "repas" },
  { key: "vetInfo", label: "vétérinaire" },
  { key: "emergencyContact", label: "contact d’urgence" },
] as const;

export type RequiredPetProfileField = (typeof REQUIRED_PET_PROFILE_FIELDS)[number]["key"];

const DAY_MS = 24 * 60 * 60 * 1000;
const TROPICAL_YEAR_DAYS = 365.2425;

function toValidDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculatePetAge(birthDate?: Date | string | null, referenceDate = new Date()) {
  const birth = toValidDate(birthDate);
  if (!birth || birth > referenceDate) return null;
  return (referenceDate.getTime() - birth.getTime()) / (DAY_MS * TROPICAL_YEAR_DAYS);
}

export function isValidPetBirthDate(birthDate?: Date | string | null) {
  const age = calculatePetAge(birthDate);
  return age !== null && age <= 30;
}

export function isPetUnderOneYearOn(birthDate?: Date | string | null, referenceDate?: Date | string | null) {
  const birth = toValidDate(birthDate);
  const reference = toValidDate(referenceDate) || new Date();
  if (!birth || birth > reference) return false;

  const firstBirthday = new Date(Date.UTC(
    birth.getUTCFullYear() + 1,
    birth.getUTCMonth(),
    birth.getUTCDate()
  ));
  return reference < firstBirthday;
}

export function isPetBirthDateVerified(pet: Pick<PetProfileData, "birthDateVerifiedAt">) {
  return Boolean(toValidDate(pet.birthDateVerifiedAt));
}

export function requiresPetBirthDateProof(role?: string | null) {
  return role !== "ADMIN";
}

function hasRequiredPetProfileValue(pet: PetProfileData, field: RequiredPetProfileField) {
  const value = pet[field];

  if (field === "weight") {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }

  if (field === "birthDate") {
    const age = calculatePetAge(value as Date | string | null);
    return age !== null && age <= 30;
  }

  if (field === "gender") {
    return value === "MALE" || value === "FEMALE";
  }

  if (field === "spayedNeutered") {
    return typeof value === "boolean";
  }

  return typeof value === "string" && value.trim().length > 0;
}

type PetProfileCompletionOptions = {
  requireBirthDateProof?: boolean;
};

export function getPetProfileCompletion(
  pet: PetProfileData,
  options: PetProfileCompletionOptions = {}
) {
  const requireBirthDateProof = options.requireBirthDateProof ?? !isPetBirthDateVerified(pet);
  const requiredFields = requireBirthDateProof
    ? REQUIRED_PET_PROFILE_FIELDS
    : REQUIRED_PET_PROFILE_FIELDS.filter(({ key }) => key !== "birthDateProofUrl");
  const missingFields = requiredFields
    .filter(({ key }) => !hasRequiredPetProfileValue(pet, key))
    .map(({ key, label }) => ({ key, label }));
  const completedFields = requiredFields.length - missingFields.length;

  return {
    isComplete: missingFields.length === 0,
    percentage: Math.round((completedFields / requiredFields.length) * 100),
    missingFields,
  };
}
