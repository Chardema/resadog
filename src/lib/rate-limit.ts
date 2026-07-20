import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/db/prisma";

/**
 * Rate limiter pour les endpoints sensibles.
 * Utilise Upstash Redis si les variables REST sont présentes.
 * Sinon, utilise PostgreSQL pour garder une limite distribuée entre fonctions Vercel.
 * La limite locale ne sert que de secours si le backend partagé est indisponible.
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let redis: Redis | null = null;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redis;
}

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000); // Toutes les 60 secondes

interface RateLimitOptions {
  /** Nombre max de requêtes dans la fenêtre */
  maxRequests: number;
  /** Durée de la fenêtre en secondes */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

export async function distributedRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const redisClient = getRedis();

  if (!redisClient) {
    return databaseRateLimit(key, options);
  }

  try {
    const result = await redisClient.eval(
      `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[2])
      end
      local ttl = redis.call("TTL", KEYS[1])
      if ttl < 0 then
        redis.call("EXPIRE", KEYS[1], ARGV[2])
        ttl = tonumber(ARGV[2])
      end
      return { current, ttl }
      `,
      [`rate-limit:${key}`],
      [options.maxRequests, options.windowSeconds]
    ) as [number, number];
    const [count, ttl] = result;

    return {
      success: count <= options.maxRequests,
      remaining: Math.max(options.maxRequests - count, 0),
      resetIn: ttl,
    };
  } catch (error) {
    console.error("Erreur rate limit distribué:", error);
    return databaseRateLimit(key, options);
  }
}

async function databaseRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const resetAt = new Date(Date.now() + options.windowSeconds * 1000);
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${`rate-limit:${key}`}, 1, ${resetAt}, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = NOW()
      RETURNING "count", "resetAt"
    `;

    const bucket = rows[0];
    const resetIn = Math.max(Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000), 0);

    return {
      success: bucket.count <= options.maxRequests,
      remaining: Math.max(options.maxRequests - bucket.count, 0),
      resetIn,
    };
  } catch (error) {
    console.error("Erreur rate limit PostgreSQL:", error);
    return localRateLimit(key, options);
  }
}

function localRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  const existing = rateLimitMap.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: options.maxRequests - 1, resetIn: options.windowSeconds };
  }

  if (existing.count >= options.maxRequests) {
    const resetIn = Math.ceil((existing.resetTime - now) / 1000);
    return { success: false, remaining: 0, resetIn };
  }

  existing.count++;
  return {
    success: true,
    remaining: options.maxRequests - existing.count,
    resetIn: Math.ceil((existing.resetTime - now) / 1000),
  };
}
