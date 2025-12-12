import { PrismaClient } from '@prisma/client';
import { Pool } from '@prisma/pg-worker';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pour Prisma 7, nous utilisons l'adapter PostgreSQL
const connectionString = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    adapter: connectionString
      ? new Pool({ connectionString })
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
