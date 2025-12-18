export interface Review {
  id: string;
  source: "AlloVoisins" | "Rover";
  author: string;
  rating: number; // 1 to 5
  date: string;
  content: string;
  avatar?: string;
}

export const reviews: Review[] = [
  // --- ALLOVOISINS (Données réelles extraites) ---
  {
    id: "av-1",
    source: "AlloVoisins",
    author: "Gwendoline",
    rating: 5,
    date: "14 août 2024",
    content: "Mégane est très arrangeante et donne des nouvelles régulièrement. Je recommande les yeux fermés. À bientôt !!",
  },
  {
    id: "av-2",
    source: "AlloVoisins",
    author: "Elodie",
    rating: 5,
    date: "02 août 2024",
    content: "Je recommande vivement Mégane, elle est très douce, et envoie très régulièrement des nouvelles de nos petits compagnons ! Encore merci à elle",
  },
  {
    id: "av-3",
    source: "AlloVoisins",
    author: "Corinne",
    rating: 5,
    date: "22 juillet 2024",
    content: "Une très belle rencontre, Mégane est une personne douce, agréable et qui aime les animaux ça se ressent tout de suite. Je lui confierai mon petit chien les yeux fermés en toute confiance. Je recommande +++",
  },
  {
    id: "av-4",
    source: "AlloVoisins",
    author: "Léa",
    rating: 5,
    date: "16 juin 2024",
    content: "Mégane est top ! Elle s'est très bien occupée de mon chat pendant mes vacances. Je recommande !",
  },

  // --- ROVER (Placeholders basés sur votre profil, à personnaliser) ---
  {
    id: "rov-1",
    source: "Rover",
    author: "Thomas B.",
    rating: 5,
    date: "Septembre 2024",
    content: "Mégane a été fantastique avec mon chien. Des photos tous les jours, des grandes balades... Il ne voulait plus partir ! Je recommande vivement.",
  },
  {
    id: "rov-2",
    source: "Rover",
    author: "Sarah L.",
    rating: 5,
    date: "Août 2024",
    content: "Super expérience. Mégane est très professionnelle et passionnée. Mon chat a été traité comme un roi. Merci encore !",
  },
];
