import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as readline from "readline";
import dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config({ path: ".env.local" });

// Configuration du client Prisma avec adapter
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL n'est pas défini dans .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createAdmin() {
  console.log("\n🔐 === Création du compte Administrateur ResaDog ===\n");

  try {
    // Demander les informations
    const name = await question("Nom complet de l'admin: ");
    const email = await question("Email de l'admin: ");
    const password = await question("Mot de passe (min. 8 caractères): ");

    // Validation
    if (!name || !email || !password) {
      console.error("❌ Tous les champs sont requis!");
      process.exit(1);
    }

    if (password.length < 8) {
      console.error("❌ Le mot de passe doit contenir au moins 8 caractères!");
      process.exit(1);
    }

    // Vérifier si l'email existe déjà
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.error(`❌ Un utilisateur avec l'email ${email} existe déjà!`);
      process.exit(1);
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'admin
    const admin = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: "ADMIN",
      },
    });

    console.log("\n✅ Compte administrateur créé avec succès!\n");
    console.log("📋 Informations du compte:");
    console.log(`   Nom: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Rôle: ${admin.role}`);
    console.log(`   ID: ${admin.id}\n`);
    console.log("🔒 Gardez ces informations en sécurité!");
    console.log("🌐 Vous pouvez maintenant vous connecter sur votre site.\n");
  } catch (error) {
    console.error("❌ Erreur lors de la création de l'admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

createAdmin();
