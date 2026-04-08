import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const reviews = [
  {
    source: "ALLOVOISINS" as const,
    author: "Gwendoline",
    rating: 5,
    date: "14 août 2024",
    content: "Mégane est très arrangeante et donne des nouvelles régulièrement. Je recommande les yeux fermés. À bientôt !!",
    order: 1,
  },
  {
    source: "ALLOVOISINS" as const,
    author: "Elodie",
    rating: 5,
    date: "02 août 2024",
    content: "Je recommande vivement Mégane, elle est très douce, et envoie très régulièrement des nouvelles de nos petits compagnons ! Encore merci à elle",
    order: 2,
  },
  {
    source: "ALLOVOISINS" as const,
    author: "Corinne",
    rating: 5,
    date: "22 juillet 2024",
    content: "Une très belle rencontre, Mégane est une personne douce, agréable et qui aime les animaux ça se ressent tout de suite. Je lui confierai mon compagnon les yeux fermés en toute confiance. Je recommande +++",
    order: 3,
  },
  {
    source: "ALLOVOISINS" as const,
    author: "Léa",
    rating: 5,
    date: "16 juin 2024",
    content: "Mégane est top ! Elle s'est très bien occupée de mon chat pendant mes vacances. Je recommande !",
    order: 4,
  },
  {
    source: "ALLOVOISINS" as const,
    author: "Benjamin",
    rating: 5,
    date: "02 juin 2024",
    content: "Mégane est très sérieuse et arrangeante ! Je recommande sans hésitation.",
    order: 5,
  },
];

async function main() {
  console.log("Insertion des avis...");

  for (const review of reviews) {
    await prisma.review.create({ data: review });
    console.log(`✓ ${review.author} (${review.source})`);
  }

  console.log(`\n${reviews.length} avis insérés.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
