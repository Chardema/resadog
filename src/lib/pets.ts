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
