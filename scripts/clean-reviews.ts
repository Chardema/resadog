import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Supprimer TOUS les avis existants
  const deleted = await prisma.review.deleteMany({});
  console.log(`${deleted.count} avis supprimés.`);
  console.log("\nLa table est vide. Ajoutez vos vrais avis depuis Admin > Avis.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
