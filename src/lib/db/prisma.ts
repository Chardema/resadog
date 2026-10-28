import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pour Prisma 7, un driver adapter est requis à l'instanciation de PrismaClient
const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/resadog_placeholder';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prismaInstance = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const prisma = globalForPrisma.prisma ?? prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
