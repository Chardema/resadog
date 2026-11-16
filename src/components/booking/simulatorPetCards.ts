import { PUPPY_AGE_LABEL, YOUNG_ANIMAL_AGE_LABEL } from "@/lib/pricing";

// Cartes de l'étape 1 du simulateur. Le supplément jeune animal ne concerne
// que les chiots (voir pricing.ts) : la carte chaton n'en mentionne aucun.
export const SIMULATOR_PET_CARDS = [
  {
    key: "adultDog",
    emoji: "🐕",
    label: "Chien adulte",
    subtitle: "1 an et +",
  },
  {
    key: "puppy",
    emoji: "🐶",
    label: "Chiot",
    subtitle: PUPPY_AGE_LABEL,
  },
  {
    key: "adultCat",
    emoji: "🐈",
    label: "Chat adulte",
    subtitle: "1 an et +",
  },
  {
    key: "kitten",
    emoji: "🐱",
    label: "Chaton",
    subtitle: YOUNG_ANIMAL_AGE_LABEL,
  },
] as const;
