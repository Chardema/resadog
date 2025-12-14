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

async function resetAdminPassword() {
  console.log("\n🔐 === Réinitialisation du mot de passe Admin ===\n");

  try {
    // Demander l'email de l'admin
    const email = await question("Email du compte admin: ");

    // Vérifier si l'admin existe
    const admin = await prisma.user.findUnique({
      where: { email },
    });

    if (!admin) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      process.exit(1);
    }

    if (admin.role !== "ADMIN" && admin.role !== "SITTER") {
      console.error(`❌ Cet utilisateur n'est pas un administrateur!`);
      console.log(`   Rôle actuel: ${admin.role}`);
      process.exit(1);
    }

    console.log(`\n✅ Compte trouvé: ${admin.name} (${admin.role})\n`);

    // Demander le nouveau mot de passe
    const newPassword = await question("Nouveau mot de passe (min. 8 caractères): ");

    if (newPassword.length < 8) {
      console.error("❌ Le mot de passe doit contenir au moins 8 caractères!");
      process.exit(1);
    }

    // Confirmation
    const confirm = await question("\n⚠️  Êtes-vous sûr de vouloir changer le mot de passe? (oui/non): ");

    if (confirm.toLowerCase() !== "oui") {
      console.log("❌ Opération annulée.");
      process.exit(0);
    }

    // Hash du nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: hashedPassword },
    });

    console.log("\n✅ Mot de passe réinitialisé avec succès!\n");
    console.log("📋 Informations du compte:");
    console.log(`   Nom: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Rôle: ${admin.role}\n`);
    console.log("🔒 Vous pouvez maintenant vous connecter avec le nouveau mot de passe.\n");
  } catch (error) {
    console.error("❌ Erreur lors de la réinitialisation:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

resetAdminPassword();
