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
  // --- ALLOVOISINS (Vrais avis extraits) ---
  {
    id: "av-1",
    source: "AlloVoisins",
    author: "Gwendoline",
    rating: 5,
    date: "14 août", // Année implicite 2024 selon contexte
    content: "Mégane est très arrangeante et donne des nouvelles régulièrement. Je recommande les yeux fermés. À bientôt !!",
  },
  {
    id: "av-2",
    source: "AlloVoisins",
    author: "Elodie",
    rating: 5,
    date: "02 août",
    content: "Je recommande vivement Mégane, elle est très douce, et envoie très régulièrement des nouvelles de nos petits compagnons ! Encore merci à elle",
  },
  {
    id: "av-3",
    source: "AlloVoisins",
    author: "Corinne",
    rating: 5,
    date: "22 juillet",
    content: "Une très belle rencontre, Mégane est une personne douce, agréable et qui aime les animaux ça se ressent tout de suite. Je lui confierai mon petit chien les yeux fermés en toute confiance. Je recommande +++",
  },
  {
    id: "av-4",
    source: "AlloVoisins",
    author: "Léa",
    rating: 5,
    date: "16 juin",
    content: "Mégane est top ! Elle s'est très bien occupée de mon chat pendant mes vacances. Je recommande !",
  },
  {
    id: "av-5",
    source: "AlloVoisins",
    author: "Benjamin",
    rating: 5,
    date: "02 juin",
    content: "Mégane est très sérieuse et arrangeante ! Je recommande sans hésitation.",
  },

  // --- ROVER (Placeholders en attente de vos textes réels) ---
  {
    id: "rov-1",
    source: "Rover",
    author: "Client Rover",
    rating: 5,
    date: "Récemment",
    content: "Mégane est une super dog sitter ! (Avis en attente de synchronisation)",
  },
];